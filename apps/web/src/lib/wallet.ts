'use client';

import { FROZEN_NETWORK } from './config';

export interface EthereumProvider {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window { ethereum?: EthereumProvider; }
}

export function getEthereumProvider(): EthereumProvider | null {
  return typeof window !== 'undefined' ? window.ethereum ?? null : null;
}

export function toChainHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

export async function readWalletState(): Promise<{ account: string | null; chainId: number | null }> {
  const provider = getEthereumProvider();
  if (!provider) return { account: null, chainId: null };
  const [accounts, chainHex] = await Promise.all([
    provider.request<string[]>({ method: 'eth_accounts' }),
    provider.request<string>({ method: 'eth_chainId' }),
  ]);
  return { account: accounts[0] ?? null, chainId: Number.parseInt(chainHex, 16) };
}

export async function connectWallet(): Promise<{ account: string; chainId: number }> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error('Install a browser wallet to connect.');
  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  const state = await readWalletState();
  if (!accounts[0] || !state.chainId) throw new Error('The wallet did not return an account or chain.');
  return { account: accounts[0], chainId: state.chainId };
}

export async function switchToFrozenNetwork(): Promise<number> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error('Install a browser wallet to switch networks.');
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toChainHex(FROZEN_NETWORK.chainId) }] });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : 0;
    if (code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: toChainHex(FROZEN_NETWORK.chainId), chainName: FROZEN_NETWORK.name, nativeCurrency: { name: 'Gen', symbol: 'GEN', decimals: 18 }, rpcUrls: [FROZEN_NETWORK.rpcUrl], blockExplorerUrls: [FROZEN_NETWORK.explorerUrl] }] });
  }
  return (await readWalletState()).chainId ?? 0;
}
