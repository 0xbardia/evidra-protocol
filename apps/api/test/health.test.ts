import assert from 'node:assert/strict';
import test from 'node:test';
import { ProtocolReadError } from '@evidra/protocol';
import { HealthMonitor } from '../src/health.ts';

const options = { lightIntervalMs: 60_000, fullIntervalMs: 60 * 60_000, maxAgeMs: 60_000, contractMaxAgeMs: 60 * 60_000 };
const indexer = { getStatus: () => ({ enabled: false, running: false, lastStartedAt: null, lastSuccessAt: null, lastError: null, lastDurationMs: null, lagSeconds: null }) };
const logger = { info: () => {}, warn: () => {} };

test('health monitor performs full verification once, then light probes', async () => {
  const calls = { full: 0, chain: 0, version: 0 };
  const protocol = {
    isHardQuotaCoolingDown: () => false,
    getRpcMetrics: () => ({ totals: {}, bySubsystem: {}, byMethod: {}, cooldownUntil: null }),
    verifyDeployment: async () => { calls.full += 1; return { chainId: 61997, readMode: 'latest-final' as const, config: {} }; },
    assertNetwork: async () => { calls.chain += 1; return 61997; },
    registry: { getRegistryVersion: async () => { calls.version += 1; return 'v1'; } },
  };
  const monitor = new HealthMonitor(protocol as never, indexer as never, logger, options);
  await monitor.start();
  try {
    assert.equal(calls.full, 1);
    await (monitor as unknown as { tick(): Promise<void> }).tick();
    assert.deepEqual(calls, { full: 1, chain: 1, version: 1 });
    assert.equal(monitor.isReady(), true);
  } finally {
    monitor.stop();
  }
});

test('hard quota cooldown prevents health probes from consuming more RPC', async () => {
  let full = 0;
  const protocol = {
    isHardQuotaCoolingDown: () => true,
    getRpcMetrics: () => ({ totals: {}, bySubsystem: {}, byMethod: {}, cooldownUntil: Date.now() + 60_000 }),
    verifyDeployment: async () => { full += 1; throw new Error('must not run'); },
    assertNetwork: async () => { throw new Error('must not run'); },
    registry: { getRegistryVersion: async () => { throw new Error('must not run'); } },
  };
  const monitor = new HealthMonitor(protocol as never, indexer as never, logger, options);
  await monitor.start();
  try {
    await (monitor as unknown as { tick(): Promise<void> }).tick();
    assert.equal(full, 0);
    assert.equal(monitor.isReady(), false);
    assert.equal(monitor.getSnapshot().state, 'rate_limited');
  } finally {
    monitor.stop();
  }
});

test('hourly quota errors put readiness into rate-limited state', async () => {
  const protocol = {
    isHardQuotaCoolingDown: () => false,
    getRpcMetrics: () => ({ totals: {}, bySubsystem: {}, byMethod: {}, cooldownUntil: null }),
    verifyDeployment: async () => { throw new ProtocolReadError(new Error('Rate limit exceeded: 500 requests per hour')); },
    assertNetwork: async () => 61997,
    registry: { getRegistryVersion: async () => 'v1' },
  };
  const monitor = new HealthMonitor(protocol as never, indexer as never, logger, options);
  await monitor.start();
  try {
    assert.equal(monitor.getSnapshot().state, 'rate_limited');
    assert.match(monitor.getSnapshot().lastError ?? '', /temporarily unavailable/);
  } finally {
    monitor.stop();
  }
});
