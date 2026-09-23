import {
  CONTRACT_ADDRESSES,
  FROZEN_NETWORK,
  assertAddress,
  assertFrozenDeployment,
  explorerAddressUrl,
  explorerContractUrl,
  explorerTransactionUrl,
} from '@evidra/protocol/constants';

const configuredChainId = process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? '';
if (configuredChainId && Number(configuredChainId) !== FROZEN_NETWORK.chainId) {
  throw new Error(`Evidra web is configured for chain ${configuredChainId}, expected ${FROZEN_NETWORK.chainId}`);
}

const configuredAddresses = {
  policyRegistry: process.env.NEXT_PUBLIC_EVIDRA_POLICY_REGISTRY_ADDRESS || CONTRACT_ADDRESSES.policyRegistry,
  registry: process.env.NEXT_PUBLIC_EVIDRA_REGISTRY_ADDRESS || CONTRACT_ADDRESSES.registry,
  resolver: process.env.NEXT_PUBLIC_EVIDRA_RESOLVER_ADDRESS || CONTRACT_ADDRESSES.resolver,
  consumerProbe: process.env.NEXT_PUBLIC_EVIDRA_CONSUMER_PROBE_ADDRESS || CONTRACT_ADDRESSES.consumerProbe,
};
assertFrozenDeployment(configuredAddresses);

export const WEB_CONFIG = {
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, ''),
  rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || FROZEN_NETWORK.rpcUrl,
  chainId: FROZEN_NETWORK.chainId,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || FROZEN_NETWORK.explorerUrl,
  addresses: configuredAddresses,
} as const;

export { FROZEN_NETWORK, CONTRACT_ADDRESSES, assertAddress, explorerAddressUrl, explorerContractUrl, explorerTransactionUrl };

export function explorerTx(txId: string): string {
  return explorerTransactionUrl(txId);
}
