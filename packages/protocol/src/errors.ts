export type ProtocolErrorKind = 'contract' | 'rpc' | 'execution' | 'decode' | 'configuration' | 'unknown';

export interface NormalizedProtocolError {
  kind: ProtocolErrorKind;
  code?: string;
  retryable: boolean;
  userMessage: string;
  detail: string;
  statusCode?: number;
  retryAfterMs?: number;
}

const NON_RETRYABLE_CODES = new Set([
  'INVALID_PARAM',
  'INVALID_URL',
  'INVALID_PAGINATION',
  'UNKNOWN_FACT',
  'UNKNOWN_REQUEST',
  'UNKNOWN_POLICY',
  'UNKNOWN_TEMPLATE',
  'NOT_OWNER',
  'UNAUTHORIZED',
  'BINDING_MISMATCH',
]);

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

function extractCode(text: string): string | undefined {
  const match = text.match(/\b([A-Z][A-Z0-9_]{2,})\b/);
  return match?.[1];
}

function extractStatus(error: unknown, text: string): number | undefined {
  if (error && typeof error === 'object') {
    const candidate = (error as { status?: unknown; statusCode?: unknown }).statusCode ?? (error as { status?: unknown }).status;
    if (typeof candidate === 'number') return candidate;
  }
  const match = text.match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : undefined;
}

function extractRetryAfter(error: unknown, text: string): number | undefined {
  if (error && typeof error === 'object') {
    const candidate = (error as { retryAfterMs?: unknown; retryAfter?: unknown }).retryAfterMs ?? (error as { retryAfter?: unknown }).retryAfter;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate < 1000 ? candidate * 1000 : candidate;
  }
  const seconds = text.match(/retry[- _]?after[^\d]*(\d+)/i)?.[1] ?? text.match(/(\d+)\s*(?:seconds?|s)\b/i)?.[1];
  if (seconds) return Number(seconds) * 1000;
  if (text.toLowerCase().includes('rate limit')) return 60_000;
  return undefined;
}

export function normalizeProtocolError(error: unknown): NormalizedProtocolError {
  const detail = errorText(error);
  const code = extractCode(detail);
  const statusCode = extractStatus(error, detail);
  const retryAfterMs = extractRetryAfter(error, detail);
  const lower = detail.toLowerCase();
  const retryable = statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504
    || lower.includes('timeout') || lower.includes('rate limit') || lower.includes('temporarily unavailable');
  const kind: ProtocolErrorKind = code && NON_RETRYABLE_CODES.has(code)
    ? 'contract'
    : statusCode || retryable ? 'rpc' : lower.includes('decode') ? 'decode' : 'unknown';
  return {
    kind,
    ...(code ? { code } : {}),
    retryable: code ? !NON_RETRYABLE_CODES.has(code) && retryable : retryable,
    userMessage: code ? `Protocol operation failed (${code}).` : retryable ? 'The protocol read is temporarily unavailable.' : 'Protocol read failed.',
    detail,
    ...(statusCode ? { statusCode } : {}),
    ...(retryAfterMs ? { retryAfterMs } : {}),
  };
}

export class ProtocolReadError extends Error {
  readonly normalized: NormalizedProtocolError;

  constructor(error: unknown) {
    const normalized = normalizeProtocolError(error);
    super(normalized.userMessage);
    this.name = 'ProtocolReadError';
    this.normalized = normalized;
  }
}
