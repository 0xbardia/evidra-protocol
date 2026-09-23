'use client';

import { useEffect, useState } from 'react';
import { WEB_CONFIG } from './config';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function friendlyApiMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const status = error instanceof ApiError ? error.status : 0;
  if (code === 'rpc_unavailable' || code === 'protocol_read_failed') {
    return 'Finalized chain verification is temporarily delayed. Cached indexed data may still be available.';
  }
  if (code === 'fact_not_found') return 'This Fact is not in the indexed public registry.';
  if (code === 'request_not_found') return 'This request is not in the indexed public registry.';
  if (code === 'invalid_request') return 'The request parameters are not valid.';
  if (code === 'internal_error' || code === 'readiness_unavailable' || code === 'read_service_unavailable' || status >= 500 || error instanceof ApiError) {
    return 'The indexed read service is temporarily unavailable. Please try again shortly.';
  }
  if (error instanceof TypeError) return 'The public read service could not be reached. Check your connection and try again.';
  return 'The public read request could not be completed.';
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${WEB_CONFIG.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(response.status, String(body.error ?? 'api_error'), String(body.message ?? body.error ?? 'API request failed'));
  }
  return body as T;
}

export interface ApiPage<T> {
  items: T[];
  page: { offset: number; limit: number; total: number };
}

export interface FactEnvelope {
  fact: Record<string, unknown>;
  current_request?: Record<string, unknown> | null;
  canonical_resolution: Record<string, unknown> | null;
  latest_resolution: Record<string, unknown> | null;
  freshness: { is_fresh: boolean; source: 'cache' | 'chain' };
  projection: { source: 'cache' | 'chain'; synced_at: string; stale: boolean };
  history?: { items: Array<{ resolution: Record<string, unknown> }>; total: number };
}

export function useApi<T>(path: string | null): { data: T | null; error: ApiError | Error | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: ApiError | Error | null; loading: boolean }>({ data: null, error: null, loading: Boolean(path) });
  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    void fetchApi<T>(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ data: null, error: error instanceof Error ? error : new Error('Request failed'), loading: false });
      });
    return () => controller.abort();
  }, [path]);
  return state;
}

export const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? value as Record<string, unknown> : {});
export const asString = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : value == null ? fallback : String(value);
export const asBoolean = (value: unknown): boolean => value === true || value === 'true';
export const asBigInt = (value: unknown, fallback = 0n): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    try { return BigInt(value); } catch { return fallback; }
  }
  return fallback;
};
export const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
