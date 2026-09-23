import type { Page } from './types.js';

export const MAX_PAGE_SIZE = 50;

export function boundedPage(input: { offset?: unknown; limit?: unknown }): { offset: number; limit: number } {
  const offset = input.offset === undefined ? 0 : Number(input.offset);
  const limit = input.limit === undefined ? 20 : Number(input.limit);
  if (!Number.isInteger(offset) || offset < 0) throw new Error('offset must be a non-negative integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) throw new Error(`limit must be 1-${MAX_PAGE_SIZE}`);
  return { offset, limit };
}

export function pageOf<T>(items: T[], offset: number, limit: number, total = items.length): Page<T> {
  return { items, pagination: { offset, limit, total, hasMore: offset + items.length < total } };
}
