import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/index.ts';

const base = {
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/db',
  GENLAYER_CHAIN_ID: '61997',
  EVIDRA_POLICY_REGISTRY_ADDRESS: '0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71',
  EVIDRA_REGISTRY_ADDRESS: '0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6',
  EVIDRA_RESOLVER_ADDRESS: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477',
  EVIDRA_CONSUMER_PROBE_ADDRESS: '0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F',
};

test('loads only the frozen network and addresses', () => {
  const config = loadConfig(base);
  assert.equal(config.chainId, 61997);
  assert.equal(config.addresses.registry.toLowerCase(), base.EVIDRA_REGISTRY_ADDRESS.toLowerCase());
});

test('rejects wrong chain and address', () => {
  assert.throws(() => loadConfig({ ...base, GENLAYER_CHAIN_ID: '61999' }));
  assert.throws(() => loadConfig({ ...base, EVIDRA_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000001' }));
});
