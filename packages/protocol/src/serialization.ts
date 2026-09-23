import type {
  Address,
  EvidenceEntry,
  EventPage,
  ProtocolEvent,
  ResolutionHistoryPage,
  U256,
} from './types.js';
import { assertAddress } from './constants.js';
import { MAX_PAGE_SIZE } from './pagination.js';

export const MAX_JSON_BYTES = 128 * 1024;

export function toBigInt(value: unknown, field = 'value'): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new Error(`Invalid integer for ${field}`);
}

export function toNumber(value: unknown, field = 'value'): number {
  const result = toBigInt(value, field);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field} exceeds safe integer range`);
  return Number(result);
}

export function toAddress(value: unknown, field = 'address'): Address {
  return assertAddress(value, field);
}

export function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]));
  }
  return value;
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(toJsonSafe(value));
}

export function parseJsonBounded<T>(value: string, field: string, maxBytes = MAX_JSON_BYTES): T {
  if (Buffer.byteLength(value, 'utf8') > maxBytes) throw new Error(`${field} exceeds ${maxBytes} bytes`);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${field} is not valid JSON`);
  }
}

export function parseStringArray(value: string, field: string, maxItems = 50): string[] {
  const parsed = parseJsonBounded<unknown>(value, field);
  if (!Array.isArray(parsed) || parsed.length > maxItems || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} must be a bounded string array`);
  }
  return parsed;
}

export function parsePageItems(value: string): unknown[] {
  const parsed = parseJsonBounded<unknown>(value, 'items_json');
  if (!Array.isArray(parsed) || parsed.length > MAX_PAGE_SIZE) throw new Error('items_json must be a bounded array');
  return parsed;
}

export function normalizeEventPage(raw: Record<string, unknown>): EventPage {
  const items = parsePageItems(String(raw.items_json ?? '[]')).map((item) => normalizeEvent(item));
  return {
    offset: toNumber(raw.offset, 'offset'),
    limit: toNumber(raw.limit, 'limit'),
    total: toNumber(raw.total, 'total'),
    items,
  };
}

export function normalizeEvent(raw: unknown): ProtocolEvent {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid event record');
  const value = raw as Record<string, unknown>;
  return {
    index: toBigInt(value.index, 'event.index'),
    topic: String(value.topic ?? ''),
    payload: String(value.payload ?? '{}'),
    timestamp: toBigInt(value.timestamp, 'event.timestamp'),
  };
}

export function normalizeHistoryPage(raw: Record<string, unknown>): ResolutionHistoryPage {
  const ids = parseJsonBounded<unknown>(String(raw.resolution_ids_json ?? '[]'), 'resolution_ids_json');
  if (!Array.isArray(ids) || ids.length > MAX_PAGE_SIZE) throw new Error('resolution_ids_json must be bounded');
  return {
    fact_key: String(raw.fact_key ?? ''),
    offset: toNumber(raw.offset, 'offset'),
    limit: toNumber(raw.limit, 'limit'),
    total: toNumber(raw.total, 'total'),
    resolution_ids: ids.map((id) => toBigInt(id, 'resolution_id')),
  };
}

export function normalizeEvidenceManifest(raw: Record<string, unknown>): {
  exists: boolean;
  resolution_id: U256;
  manifest_hash: string;
  manifest_json: string;
  entries: EvidenceEntry[];
} {
  const manifestJson = String(raw.manifest_json ?? '');
  let entries: EvidenceEntry[] = [];
  if (manifestJson) {
    const parsed = parseJsonBounded<unknown>(manifestJson, 'manifest_json');
    const sourceItems = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { sources?: unknown }).sources) ? (parsed as { sources: unknown[] }).sources : [];
    entries = sourceItems.map((item) => {
      const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        url: String(value.url ?? ''),
        ...(value.canonical ? { canonical: String(value.canonical) } : {}),
        ...(value.host ? { host: String(value.host) } : {}),
        status: String(value.status ?? value.fetch_status ?? ''),
        ...(value.error ? { error: String(value.error) } : {}),
        origin: String(value.origin ?? value.source_origin ?? ''),
        ...(value.category ? { category: String(value.category) } : {}),
        provenance_group: String(value.provenance_group ?? ''),
        source_class: String(value.source_class ?? ''),
        is_primary: Boolean(value.is_primary),
        is_independent: Boolean(value.is_independent),
        policy_eligible: Boolean(value.policy_eligible),
        evidence_hash: String(value.evidence_hash ?? ''),
        ...(value.relevant_timestamp ? { relevant_timestamp: String(value.relevant_timestamp) } : {}),
      };
    });
  }
  return {
    exists: Boolean(raw.exists),
    resolution_id: toBigInt(raw.resolution_id, 'resolution_id'),
    manifest_hash: String(raw.manifest_hash ?? ''),
    manifest_json: manifestJson,
    entries,
  };
}
