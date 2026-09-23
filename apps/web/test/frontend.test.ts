import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activityDetail, activityLabel, factStatement, formatDate, formatTtl, outcomeLabel, outcomeTone, protocolStatusLabel, safeExternalUrl, shortHash } from '../src/lib/format';
import { fetchApi, ApiError, friendlyApiMessage } from '../src/lib/api';
import { WEB_CONFIG } from '../src/lib/config';
import { pageMetadata } from '../src/lib/seo';
import { connectWallet, readWalletState, switchToFrozenNetwork, toChainHex, type EthereumProvider } from '../src/lib/wallet';
import { parseStringArray, templateMutabilityRule, templateRequiredFieldsLabel, validateEvidenceUrl, validateTemplateRequiredFields, validateUrlList } from '../src/lib/validation';
import { friendlyWriteMessage, registryWrite } from '../src/lib/writes';

test('evidence URL preflight follows the frozen strict domain-only UX rule', () => {
  assert.equal(validateEvidenceUrl('https://example.com/report').valid, true);
  assert.equal(validateEvidenceUrl('https://example.com:443/report').valid, true);
  for (const value of ['http://example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://user@example.com/', 'https://example.com:8080/', 'https://example.com/#fragment']) {
    assert.equal(validateEvidenceUrl(value).valid, false, value);
  }
});

test('source list validation is bounded and reports the first concrete failure', () => {
  assert.equal(validateUrlList(['https://example.com'], 1), null);
  assert.match(validateUrlList(['https://example.com', 'https://other.example'], 1) ?? '', /no more than 1/);
  assert.match(validateUrlList(['https://localhost'], 8) ?? '', /Localhost/);
});

test('template requirements and mutability match the frozen Registry rules', () => {
  assert.equal(templateMutabilityRule('immutable_launch'), 'IMMUTABLE');
  assert.equal(templateMutabilityRule('mutable_with_ttl'), 'MUTABLE_WITH_TTL');
  assert.equal(templateMutabilityRule('general'), null);
  assert.equal(templateRequiredFieldsLabel('subject,temporal,object_value'), 'subject, temporal constraint, object / value');
  assert.match(validateTemplateRequiredFields('subject,temporal', { subject: 'example.org', temporal: '' }) ?? '', /temporal constraint/);
  assert.equal(validateTemplateRequiredFields('subject,temporal', { subject: 'example.org', temporal: 'as of 2026-09-23' }), null);
  assert.match(validateTemplateRequiredFields('chain_only_field', {}) ?? '', /form cannot collect/);
});

test('display helpers preserve unknown outcomes without treating them as success', () => {
  assert.equal(outcomeLabel('TRUE'), 'Verified true');
  assert.equal(outcomeTone('UNRESOLVED'), 'warning');
  assert.equal(outcomeTone('FUTURE_STATE'), 'neutral');
  assert.equal(shortHash('a'.repeat(64), 5), 'aaaaa…aaaaa');
});

test('timestamps accept both chain seconds and API ISO timestamps', () => {
  assert.notEqual(formatDate('2026-09-22T02:20:45.000Z'), 'Not recorded');
  assert.equal(formatDate('0'), 'Not recorded');
  assert.equal(formatDate('9'.repeat(90)), 'Out of range');
  assert.equal(formatTtl(86400n), '1 day');
  assert.match(formatTtl(86401n), /86,401 seconds/);
  assert.match(formatTtl(86400n * 365n), /365 days/);
});

test('page titles carry the brand at nested App Router depths', () => {
  assert.equal(pageMetadata('Fact registry', 'Find public records.', '/app/facts').title, 'Fact registry — Evidra Protocol');
});

test('Fact social metadata does not call the client-only API module on the server', async () => {
  const source = await readFile(new URL('../src/app/app/facts/[factKey]/layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"].*lib\/api['"];/);
  assert.match(source, /factStatement\(request, fallback\)/);
  assert.match(source, /outcomeLabel\(canonical\.outcome\)/);
});

test('Fact statements read naturally and protocol states are humanized', () => {
  assert.equal(factStatement({ subject: 'example.com', predicate: 'publishes Example Domain', object_value: 'Example Domain' }), 'example.com publishes Example Domain');
  assert.equal(protocolStatusLabel('FAILED_REPORTED'), 'Failed reported');
  assert.equal(safeExternalUrl('https://user:password@example.com') , null);
});

test('activity helpers render the normalized projection fields', () => {
  assert.equal(activityLabel('request_created'), 'Fact request created');
  assert.equal(activityDetail({ activity_type: 'request_created', activity_id: '4', status: 'DISPATCHED' }), 'Request #4 · Dispatched');
  assert.equal(activityDetail({ activity_type: 'resolution_committed', activity_id: '3', outcome: 'TRUE' }), 'Resolution #3 · Verified true');
});

test('degraded API codes become actionable read messages', () => {
  assert.match(friendlyApiMessage(new ApiError(503, 'rpc_unavailable')), /Finalized chain verification is temporarily delayed/);
  assert.match(friendlyApiMessage(new ApiError(500, 'internal_error')), /indexed read service is temporarily unavailable/);
  assert.match(friendlyApiMessage('rpc_unavailable'), /Cached indexed data may still be available/);
  assert.match(friendlyApiMessage(new Error('internal_error')), /indexed read service is temporarily unavailable/);
  assert.match(friendlyApiMessage(new Error('read_service_unavailable')), /indexed read service is temporarily unavailable/);
  assert.doesNotMatch(friendlyApiMessage(new Error('PostgreSQL connection refused')), /PostgreSQL/);
});

test('user write adapter produces only the named Registry invocation', () => {
  const call = registryWrite('retry_resolution', [4n], 0n);
  assert.equal(call.method, 'retry_resolution');
  assert.deepEqual(call.args, [4n]);
  assert.equal(call.value, 0n);
});

test('wallet and RPC failures have safe recovery guidance', () => {
  assert.match(friendlyWriteMessage(Object.assign(new Error('User rejected request'), { code: 4001 })), /cancelled/);
  assert.match(friendlyWriteMessage(new Error('Install a browser wallet to connect.')), /supported browser wallet/);
  assert.match(friendlyWriteMessage(new Error('429 hard quota')), /do not submit the transaction again/);
  assert.doesNotMatch(friendlyWriteMessage(new Error('secret stack trace')), /secret stack trace/);
});

test('Create Fact disables submission during preparation to prevent double writes', async () => {
  const source = await readFile(new URL('../src/app/app/create/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /\['preparing', 'wallet', 'submitted', 'consensus', 'decided', 'finalizing'\]/);
});

test('user writes include the separate GenLayer execution-fee estimate', async () => {
  const source = await readFile(new URL('../src/lib/writes.ts', import.meta.url), 'utf8');
  assert.match(source, /estimateTransactionFees\(\{\}\)/);
  assert.match(source, /fees: executionFees/);
});

test('wallet helpers enforce the frozen chain and add a missing Studio Dev network', async () => {
  assert.equal(toChainHex(61997), '0xf22d');
  const calls: string[] = [];
  const provider: EthereumProvider = {
    request: async <T = unknown>({ method }: { method: string; params?: unknown[] }): Promise<T> => {
      calls.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0x1111111111111111111111111111111111111111'] as T;
      if (method === 'eth_chainId') return '0xf22d' as T;
      if (method === 'wallet_switchEthereumChain') throw Object.assign(new Error('unknown chain'), { code: 4902 });
      if (method === 'wallet_addEthereumChain') return null as T;
      throw new Error(`unexpected ${method}`);
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { ethereum: provider } });
  try {
    assert.deepEqual(await readWalletState(), { account: '0x1111111111111111111111111111111111111111', chainId: 61997 });
    assert.deepEqual(await connectWallet(), { account: '0x1111111111111111111111111111111111111111', chainId: 61997 });
    assert.equal(await switchToFrozenNetwork(), 61997);
    assert.ok(calls.includes('wallet_addEthereumChain'));
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test('API errors preserve status and normalized code without exposing transport internals', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'protocol_read_failed', message: 'Finalized read unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(() => fetchApi('/facts'), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === 'protocol_read_failed' && error.message === 'Finalized read unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('URL and serialization boundaries reject malformed JSON and unsafe external schemes', () => {
  assert.deepEqual(parseStringArray('["https://example.com"]'), ['https://example.com']);
  assert.throws(() => parseStringArray('{"url":"https://example.com"}'), /at most/);
  assert.equal(safeExternalUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl('https://user:password@example.com/'), null);
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
});

test('production web defaults API reads to the same origin', () => {
  assert.equal(WEB_CONFIG.apiBaseUrl, process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1');
});
