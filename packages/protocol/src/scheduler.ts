import { normalizeProtocolError, ProtocolReadError } from './errors.js';

export interface SchedulerOptions {
  concurrency?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  hardQuotaCooldownMs?: number;
}

export interface RpcCallMeta {
  subsystem?: string;
  method?: string;
}

export interface RpcMetricBucket {
  total: number;
  success: number;
  rateLimited: number;
  serverErrors: number;
  retries: number;
  suppressed: number;
  hardQuota: number;
}

export interface RpcMetrics {
  totals: RpcMetricBucket;
  bySubsystem: Record<string, RpcMetricBucket>;
  byMethod: Record<string, RpcMetricBucket>;
  cooldownUntil: number | null;
}

interface Job<T> {
  run: () => Promise<T>;
  meta: RpcCallMeta;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function errorDetail(error: unknown): string {
  if (error && typeof error === 'object') {
    const normalized = (error as { normalized?: { detail?: unknown } }).normalized?.detail;
    if (typeof normalized === 'string') return normalized;
  }
  return error instanceof Error ? error.message : String(error);
}

export function isHardQuotaError(error: unknown): boolean {
  const detail = errorDetail(error);
  return /rate limit exceeded\s*:\s*\d+\s+requests?\s+per\s+(?:hour|day|week|month)/i.test(detail)
    || /daily\s+(?:rpc\s+)?quota/i.test(detail)
    || /quota.*(?:exhausted|exceeded)/i.test(detail);
}

function emptyBucket(): RpcMetricBucket {
  return { total: 0, success: 0, rateLimited: 0, serverErrors: 0, retries: 0, suppressed: 0, hardQuota: 0 };
}

export class RpcScheduler {
  private readonly concurrency: number;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly hardQuotaCooldownMs: number;
  private readonly queue: Job<unknown>[] = [];
  private readonly totals = emptyBucket();
  private readonly bySubsystem = new Map<string, RpcMetricBucket>();
  private readonly byMethod = new Map<string, RpcMetricBucket>();
  private active = 0;
  private lastStartedAt = 0;
  private pumpScheduled = false;
  private cooldownUntil: number | null = null;

  constructor(options: SchedulerOptions = {}) {
    this.concurrency = Math.max(1, Math.min(options.concurrency ?? 1, 2));
    this.minIntervalMs = Math.max(0, options.minIntervalMs ?? 2400);
    this.maxRetries = Math.max(0, Math.min(options.maxRetries ?? 3, 5));
    this.baseDelayMs = Math.max(25, options.baseDelayMs ?? 500);
    this.maxDelayMs = Math.max(this.baseDelayMs, options.maxDelayMs ?? 15_000);
    this.hardQuotaCooldownMs = Math.max(60_000, options.hardQuotaCooldownMs ?? 3_600_000);
  }

  schedule<T>(run: () => Promise<T>, meta: RpcCallMeta = {}): Promise<T> {
    if (this.isHardQuotaCoolingDown()) {
      this.record(meta, 'suppressed');
      return Promise.reject(this.cooldownError());
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run: async () => run(), meta, resolve: (value) => resolve(value as T), reject });
      this.pump();
    });
  }

  get pending(): number { return this.queue.length + this.active; }
  get hardQuotaCooldownUntil(): number | null { return this.isHardQuotaCoolingDown() ? this.cooldownUntil : null; }

  restoreHardQuotaCooldown(until: number): void {
    if (Number.isFinite(until) && until > Date.now()) this.cooldownUntil = Math.max(this.cooldownUntil ?? 0, until);
  }

  isHardQuotaCoolingDown(): boolean {
    if (this.cooldownUntil !== null && this.cooldownUntil <= Date.now()) this.cooldownUntil = null;
    return this.cooldownUntil !== null;
  }

  getMetrics(): RpcMetrics {
    const clone = (bucket: RpcMetricBucket): RpcMetricBucket => ({ ...bucket });
    const mapped = (source: Map<string, RpcMetricBucket>): Record<string, RpcMetricBucket> => Object.fromEntries([...source.entries()].map(([key, value]) => [key, clone(value)]));
    return { totals: clone(this.totals), bySubsystem: mapped(this.bySubsystem), byMethod: mapped(this.byMethod), cooldownUntil: this.hardQuotaCooldownUntil };
  }

  private pump(): void {
    if (this.pumpScheduled || this.active >= this.concurrency || this.queue.length === 0) return;
    this.pumpScheduled = true;
    const wait = Math.max(0, this.minIntervalMs - (Date.now() - this.lastStartedAt));
    setTimeout(() => {
      this.pumpScheduled = false;
      const job = this.queue.shift();
      if (!job) return;
      if (this.isHardQuotaCoolingDown()) {
        this.record(job.meta, 'suppressed');
        job.reject(this.cooldownError());
        this.pump();
        return;
      }
      this.active += 1;
      this.lastStartedAt = Date.now();
      void this.execute(job).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }, wait);
  }

  private async execute<T>(job: Job<T>): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        this.record(job.meta, 'total');
        job.resolve(await job.run());
        this.record(job.meta, 'success');
        return;
      } catch (error) {
        const normalized = normalizeProtocolError(error);
        if (normalized.statusCode === 429 || normalized.detail.toLowerCase().includes('rate limit')) this.record(job.meta, 'rateLimited');
        if (normalized.statusCode === 500 || normalized.statusCode === 502 || normalized.statusCode === 503 || normalized.statusCode === 504) this.record(job.meta, 'serverErrors');
        if (isHardQuotaError(error)) {
          this.cooldownUntil = Date.now() + this.hardQuotaCooldownMs;
          this.record(job.meta, 'hardQuota');
          const failure = new ProtocolReadError(error);
          job.reject(failure);
          for (const queued of this.queue.splice(0)) {
            this.record(queued.meta, 'suppressed');
            queued.reject(failure);
          }
          return;
        }
        if (!normalized.retryable || attempt >= this.maxRetries) {
          job.reject(new ProtocolReadError(error));
          return;
        }
        const retryAfter = normalized.retryAfterMs ?? 0;
        const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** attempt);
        const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponential / 4)));
        this.record(job.meta, 'retries');
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter, exponential + jitter)));
      }
    }
  }

  private cooldownError(): ProtocolReadError {
    return new ProtocolReadError(new Error('RPC quota cooldown active'));
  }

  private record(meta: RpcCallMeta, field: keyof RpcMetricBucket): void {
    const update = (bucket: RpcMetricBucket): void => { bucket[field] += 1; };
    update(this.totals);
    const subsystem = meta.subsystem ?? 'unspecified';
    const method = meta.method ?? 'unknown';
    const subsystemBucket = this.bySubsystem.get(subsystem) ?? emptyBucket();
    const methodBucket = this.byMethod.get(method) ?? emptyBucket();
    update(subsystemBucket);
    update(methodBucket);
    this.bySubsystem.set(subsystem, subsystemBucket);
    this.byMethod.set(method, methodBucket);
  }
}
