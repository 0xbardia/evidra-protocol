import { closeDbPool, createDbPool, migrate, ProjectionRepository } from '../packages/db/src/index.ts';
import { ChainIndexer } from '../apps/api/src/indexer.ts';
import { createProtocolClient, FROZEN_NETWORK, RpcScheduler } from '../packages/protocol/src/index.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = createDbPool(databaseUrl);
await migrate(pool);
const repository = new ProjectionRepository(pool);
const protocol = createProtocolClient({
  rpcUrl: FROZEN_NETWORK.rpcUrl,
  scheduler: new RpcScheduler({ concurrency: 1, minIntervalMs: Number(process.env.RPC_MIN_INTERVAL_MS ?? 3000), maxRetries: 3 }),
});
const logger = {
  info: (data: object, message?: string) => console.log(JSON.stringify({ level: 'info', ...data, message })),
  warn: (data: object, message?: string) => console.warn(JSON.stringify({ level: 'warn', ...data, message })),
  error: (data: object, message?: string) => console.error(JSON.stringify({ level: 'error', ...data, message })),
};
const indexer = new ChainIndexer(protocol, repository, logger, { enabled: true, maxRecords: Number(process.env.INDEXER_MAX_RECORDS ?? 100_000) });
try {
  await indexer.syncOnce();
  console.log(JSON.stringify({ network: FROZEN_NETWORK, status: indexer.getStatus(), sync: await repository.getSyncStatus(), stats: await repository.getStats() }, null, 2));
} finally {
  await closeDbPool(pool);
}
