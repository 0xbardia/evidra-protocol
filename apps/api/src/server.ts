import { buildApp } from './app.js';
import { HealthMonitor } from './health.js';
import { ChainIndexer } from './indexer.js';
import { loadConfig } from '@evidra/config';
import { createDbPool, migrate, ProjectionRepository, closeDbPool } from '@evidra/db';
import { createProtocolClient, RpcScheduler } from '@evidra/protocol';

const config = loadConfig();
const pool = createDbPool(config.databaseUrl);
await migrate(pool);
const repository = new ProjectionRepository(pool);
const scheduler = new RpcScheduler({
  concurrency: config.indexer.concurrency,
  maxRetries: config.indexer.maxRetries,
  minIntervalMs: config.rpcMinIntervalMs,
  hardQuotaCooldownMs: config.rpcHardQuotaCooldownMs,
});
const syncCheckpoint = await repository.getSyncStatus();
if (syncCheckpoint.status === 'rate_limited' && syncCheckpoint.lastAttemptAt) {
  scheduler.restoreHardQuotaCooldown(Date.parse(syncCheckpoint.lastAttemptAt) + config.rpcHardQuotaCooldownMs);
}
const readinessProtocol = createProtocolClient({ rpcUrl: config.rpcUrl, scheduler, subsystem: 'readiness' });
const indexerProtocol = createProtocolClient({ rpcUrl: config.rpcUrl, scheduler, subsystem: 'indexer' });
const apiProtocol = createProtocolClient({ rpcUrl: config.rpcUrl, scheduler, subsystem: 'api' });
const logger = {
  info: (data: object, message?: string) => console.log(JSON.stringify({ level: 'info', ...data, message })),
  warn: (data: object, message?: string) => console.warn(JSON.stringify({ level: 'warn', ...data, message })),
  error: (data: object, message?: string) => console.error(JSON.stringify({ level: 'error', ...data, message })),
};
const indexer = new ChainIndexer(indexerProtocol, repository, logger, {
  enabled: config.indexer.enabled,
  intervalMs: config.indexer.intervalMs,
  maxRecords: config.indexer.maxRecords,
  maxMutableRequests: config.indexer.maxMutableRequests,
  configRefreshMs: config.indexer.configRefreshMs,
});
const health = new HealthMonitor(readinessProtocol, indexer, logger, config.rpcHealth);
const app = buildApp({ repository, protocol: apiProtocol, indexer, health, corsOrigins: config.corsOrigins });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown');
  health.stop();
  await indexer.stop();
  await app.close();
  await closeDbPool(pool);
  process.exit(0);
};
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

await app.listen({ port: config.port, host: '127.0.0.1' });
app.log.info({ port: config.port, chainId: config.chainId }, 'api started');
if (config.indexer.enabled) {
  void indexer.start().catch((error: unknown) => app.log.error({ error: error instanceof Error ? error.message : String(error) }, 'initial index sync failed'));
}
void health.start().catch((error: unknown) => app.log.error({ error: error instanceof Error ? error.message : String(error) }, 'initial RPC health verification failed'));
