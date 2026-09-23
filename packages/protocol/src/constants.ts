export const FROZEN_NETWORK = {
  name: 'GenLayer Studio Dev',
  chainId: 61997,
  rpcUrl: 'https://studio-dev.genlayer.com/api',
  explorerUrl: 'https://explorer-studio-dev.genlayer.com',
} as const;

export const CONTRACT_ADDRESSES = {
  policyRegistry: '0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71',
  registry: '0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6',
  resolver: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477',
  consumerProbe: '0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F',
} as const;

export const EXPECTED_SOURCE_HASHES = {
  consumerProbe: '8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36',
  policyRegistry: 'df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247',
  registry: '1b3a97ec340ad30c381404fecb76d3e4656d48dd550c2fdf02d4a7c2a50af8f7',
  resolver: '3c9007bd1414227193b4459d96fb565e42e0b712661d802caa9477dd91a30bfe',
} as const;

export type ContractName = keyof typeof CONTRACT_ADDRESSES;

const ADDRESS_RE = /^0x[0-9a-f]{40}$/i;

export function normalizeAddress(value: unknown): string {
  const text = String(value ?? '').trim().replace(/^addr#/i, '');
  if (!ADDRESS_RE.test(text)) {
    throw new Error(`Invalid GenLayer address: ${text || '<empty>'}`);
  }
  return text.toLowerCase();
}

export function assertAddress(value: unknown, field = 'address'): string {
  try {
    const text = String(value ?? '').trim().replace(/^addr#/i, '');
    if (!ADDRESS_RE.test(text)) throw new Error(`Invalid GenLayer address: ${text || '<empty>'}`);
    return text;
  } catch (error) {
    throw new Error(`${field}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function assertFrozenDeployment(addresses: Record<ContractName, string>): void {
  for (const name of Object.keys(CONTRACT_ADDRESSES) as ContractName[]) {
    if (normalizeAddress(addresses[name]) !== normalizeAddress(CONTRACT_ADDRESSES[name])) {
      throw new Error(`Frozen address mismatch for ${name}`);
    }
  }
}

export function explorerTransactionUrl(transactionId: string): string {
  return `${FROZEN_NETWORK.explorerUrl}/tx/${encodeURIComponent(transactionId)}`;
}

export function explorerAddressUrl(address: string): string {
  return `${FROZEN_NETWORK.explorerUrl}/address/${encodeURIComponent(assertAddress(address))}`;
}

export function explorerContractUrl(address: string): string {
  return `${FROZEN_NETWORK.explorerUrl}/contract/${encodeURIComponent(assertAddress(address))}`;
}
