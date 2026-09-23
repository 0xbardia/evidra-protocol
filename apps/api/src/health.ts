import { isHardQuotaError, type ProtocolClient, type ReadMode } from '@evidra/protocol';
import type { IndexerStatus } from './indexer.js';

export interface HealthLogger {
  info(data: object, message?: string): void;
  warn(data: object, message?: string): void;
}

export interface HealthSnapshot {
  state: 'unknown' | 'healthy' | 'degraded' | 'rate_limited';
  chainId: number | null;
  readMode: ReadMode | null;
  lastRpcSuccessAt: string | null;
  lastChainVerificationAt: string | null;
  lastContractVerificationAt: string | null;
  lastIndexerSuccessAt: string | null;
  lastError: string | null;
}

export interface HealthStatusProvider {
  getSnapshot(): HealthSnapshot;
  isReady(): boolean;
}

export interface HealthMonitorOptions {
  lightIntervalMs: number;
  fullIntervalMs: number;
  maxAgeMs: number;
  contractMaxAgeMs: number;
}

const initialSnapshot: HealthSnapshot = {
  state: 'unknown',
  chainId: null,
  readMode: null,
  lastRpcSuccessAt: null,
  lastChainVerificationAt: null,
  lastContractVerificationAt: null,
  lastIndexerSuccessAt: null,
  lastError: null,
};

function age(value: string | null): number {
  return value ? Math.max(0, Date.now() - Date.parse(value)) : Number.POSITIVE_INFINITY;
}

export class HealthMonitor implements HealthStatusProvider {
  private snapshot: HealthSnapshot = { ...initialSnapshot };
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly protocol: ProtocolClient,
    private readonly indexer: { getStatus(): IndexerStatus },
    private readonly logger: HealthLogger,
    private readonly options: HealthMonitorOptions,
  ) {}

  async start(): Promise<void> {
    if (this.timer) return;
    await this.runFull();
    this.timer = setInterval(() => { void this.tick(); }, this.options.lightIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  getSnapshot(): HealthSnapshot {
    const indexer = this.indexer.getStatus();
    return { ...this.snapshot, lastIndexerSuccessAt: indexer.lastSuccessAt };
  }

  isReady(): boolean {
    const snapshot = this.getSnapshot();
    const indexer = this.indexer.getStatus();
    const rpcFresh = age(snapshot.lastRpcSuccessAt) <= this.options.maxAgeMs;
    const contractsFresh = age(snapshot.lastContractVerificationAt) <= this.options.contractMaxAgeMs;
    const indexerReady = !indexer.enabled || (indexer.lastSuccessAt !== null && indexer.lastError === null && age(indexer.lastSuccessAt) <= this.options.maxAgeMs);
    return snapshot.state === 'healthy' && rpcFresh && contractsFresh && indexerReady;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    if (age(this.snapshot.lastContractVerificationAt) >= this.options.fullIntervalMs) await this.runFull();
    else await this.runLight();
  }

  private async runFull(): Promise<void> {
    if (this.running) return;
    if (this.protocol.isHardQuotaCoolingDown()) {
      this.recordFailure(new Error('RPC quota cooldown active'));
      return;
    }
    this.running = true;
    try {
      const verified = await this.protocol.verifyDeployment();
      const now = new Date().toISOString();
      this.snapshot = {
        ...this.snapshot,
        state: 'healthy',
        chainId: verified.chainId,
        readMode: verified.readMode,
        lastRpcSuccessAt: now,
        lastChainVerificationAt: now,
        lastContractVerificationAt: now,
        lastError: null,
      };
      this.logger.info({ rpcMetrics: this.protocol.getRpcMetrics() }, 'full RPC health verification complete');
    } catch (error) {
      this.recordFailure(error);
    } finally {
      this.running = false;
    }
  }

  private async runLight(): Promise<void> {
    if (this.running || this.protocol.isHardQuotaCoolingDown()) return;
    this.running = true;
    try {
      const [chainId] = await Promise.all([this.protocol.assertNetwork(), this.protocol.registry.getRegistryVersion()]);
      this.snapshot = { ...this.snapshot, state: 'healthy', chainId, lastRpcSuccessAt: new Date().toISOString(), lastChainVerificationAt: new Date().toISOString(), lastError: null };
    } catch (error) {
      this.recordFailure(error);
    } finally {
      this.running = false;
    }
  }

  private recordFailure(error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    const rateLimited = this.protocol.isHardQuotaCoolingDown() || isHardQuotaError(error);
    this.snapshot = { ...this.snapshot, state: rateLimited ? 'rate_limited' : 'degraded', lastError: detail };
    this.logger.warn({ error: detail, rateLimited, rpcMetrics: this.protocol.getRpcMetrics() }, 'RPC health verification failed');
  }
}
