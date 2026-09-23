import { z } from 'zod';
import { CONTRACT_ADDRESSES, FROZEN_NETWORK, assertAddress, assertFrozenDeployment } from '@evidra/protocol';

const booleanEnv = z.string().default('true').transform((value) => value.toLowerCase() === 'true');
const intervalInt = (fallback: number) => z.coerce.number().int().min(1_000).default(fallback);
const nonNegativeInt = (fallback: number) => z.coerce.number().int().min(0).default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  GENLAYER_RPC_URL: z.string().url().default(FROZEN_NETWORK.rpcUrl),
  GENLAYER_CHAIN_ID: z.coerce.number().int(),
  EVIDRA_POLICY_REGISTRY_ADDRESS: z.string(),
  EVIDRA_REGISTRY_ADDRESS: z.string(),
  EVIDRA_RESOLVER_ADDRESS: z.string(),
  EVIDRA_CONSUMER_PROBE_ADDRESS: z.string(),
  INDEXER_ENABLED: booleanEnv,
  INDEXER_INTERVAL_MS: intervalInt(300_000),
  INDEXER_CONCURRENCY: z.coerce.number().int().min(1).max(2).default(1),
  INDEXER_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  INDEXER_MAX_RECORDS: z.coerce.number().int().min(1).max(1_000_000).default(100_000),
  INDEXER_MAX_MUTABLE_REQUESTS: z.coerce.number().int().min(0).max(100).default(2),
  INDEXER_CONFIG_REFRESH_MS: intervalInt(21_600_000),
  RPC_MIN_INTERVAL_MS: nonNegativeInt(2400),
  RPC_HARD_QUOTA_COOLDOWN_MS: intervalInt(3_600_000),
  RPC_HEALTH_LIGHT_INTERVAL_MS: intervalInt(900_000),
  RPC_HEALTH_FULL_INTERVAL_MS: intervalInt(21_600_000),
  RPC_HEALTH_MAX_AGE_MS: intervalInt(1_800_000),
  RPC_CONTRACT_MAX_AGE_MS: intervalInt(86_400_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PUBLIC_APP_URL: z.string().url().default('https://evidra-protocol.bydx.fun'),
  CORS_ORIGINS: z.string().default('https://evidra-protocol.bydx.fun'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  rpcUrl: string;
  chainId: number;
  addresses: typeof CONTRACT_ADDRESSES;
  indexer: { enabled: boolean; intervalMs: number; concurrency: number; maxRetries: number; maxRecords: number; maxMutableRequests: number; configRefreshMs: number };
  rpcMinIntervalMs: number;
  rpcHardQuotaCooldownMs: number;
  rpcHealth: { lightIntervalMs: number; fullIntervalMs: number; maxAgeMs: number; contractMaxAgeMs: number };
  logLevel: string;
  publicAppUrl: string;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.parse(env);
  if (parsed.GENLAYER_CHAIN_ID !== FROZEN_NETWORK.chainId) throw new Error(`GENLAYER_CHAIN_ID must be ${FROZEN_NETWORK.chainId}`);
  if (parsed.GENLAYER_RPC_URL !== FROZEN_NETWORK.rpcUrl) throw new Error(`GENLAYER_RPC_URL must be ${FROZEN_NETWORK.rpcUrl}`);
  const addresses = {
    policyRegistry: assertAddress(parsed.EVIDRA_POLICY_REGISTRY_ADDRESS, 'EVIDRA_POLICY_REGISTRY_ADDRESS'),
    registry: assertAddress(parsed.EVIDRA_REGISTRY_ADDRESS, 'EVIDRA_REGISTRY_ADDRESS'),
    resolver: assertAddress(parsed.EVIDRA_RESOLVER_ADDRESS, 'EVIDRA_RESOLVER_ADDRESS'),
    consumerProbe: assertAddress(parsed.EVIDRA_CONSUMER_PROBE_ADDRESS, 'EVIDRA_CONSUMER_PROBE_ADDRESS'),
  } as typeof CONTRACT_ADDRESSES;
  assertFrozenDeployment(addresses);
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    rpcUrl: parsed.GENLAYER_RPC_URL,
    chainId: parsed.GENLAYER_CHAIN_ID,
    addresses,
    indexer: { enabled: parsed.INDEXER_ENABLED, intervalMs: parsed.INDEXER_INTERVAL_MS, concurrency: parsed.INDEXER_CONCURRENCY, maxRetries: parsed.INDEXER_MAX_RETRIES, maxRecords: parsed.INDEXER_MAX_RECORDS, maxMutableRequests: parsed.INDEXER_MAX_MUTABLE_REQUESTS, configRefreshMs: parsed.INDEXER_CONFIG_REFRESH_MS },
    rpcMinIntervalMs: parsed.RPC_MIN_INTERVAL_MS,
    rpcHardQuotaCooldownMs: parsed.RPC_HARD_QUOTA_COOLDOWN_MS,
    rpcHealth: { lightIntervalMs: parsed.RPC_HEALTH_LIGHT_INTERVAL_MS, fullIntervalMs: parsed.RPC_HEALTH_FULL_INTERVAL_MS, maxAgeMs: parsed.RPC_HEALTH_MAX_AGE_MS, contractMaxAgeMs: parsed.RPC_CONTRACT_MAX_AGE_MS },
    logLevel: parsed.LOG_LEVEL,
    publicAppUrl: parsed.PUBLIC_APP_URL,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean),
  };
}
