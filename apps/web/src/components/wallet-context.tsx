'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FROZEN_NETWORK } from '../lib/config';
import { connectWallet, getEthereumProvider, readWalletState, switchToFrozenNetwork, type EthereumProvider } from '../lib/wallet';
import { shortAddress } from '../lib/format';
import { friendlyWriteMessage, reconcilePendingWrite, readPendingWrite, type WriteProgress } from '../lib/writes';
import { Wallet } from './icons';

interface WalletContextValue {
  account: string | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  connected: boolean;
  rightNetwork: boolean;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = async () => { try { const state = await readWalletState(); setAccount(state.account); setChainId(state.chainId); } catch (cause) { setError(friendlyWriteMessage(cause)); } };
  useEffect(() => {
    void update();
    const provider: EthereumProvider | null = getEthereumProvider();
    if (!provider?.on) return;
    const accountsChanged = (...args: unknown[]) => { const accounts = Array.isArray(args[0]) ? args[0] : []; setAccount(typeof accounts[0] === 'string' ? accounts[0] : null); };
    const chainChanged = (...args: unknown[]) => { setChainId(typeof args[0] === 'string' ? Number.parseInt(args[0], 16) : null); };
    provider.on('accountsChanged', accountsChanged);
    provider.on('chainChanged', chainChanged);
    return () => { provider.removeListener?.('accountsChanged', accountsChanged); provider.removeListener?.('chainChanged', chainChanged); };
  }, []);
  const value = useMemo<WalletContextValue>(() => ({
    account, chainId, connecting, error, connected: Boolean(account), rightNetwork: chainId === FROZEN_NETWORK.chainId,
    connect: async () => { setConnecting(true); setError(null); try { const state = await connectWallet(); setAccount(state.account); setChainId(state.chainId); } catch (cause) { setError(friendlyWriteMessage(cause)); } finally { setConnecting(false); } },
    switchNetwork: async () => { setError(null); try { setChainId(await switchToFrozenNetwork()); } catch (cause) { setError(friendlyWriteMessage(cause)); } },
    disconnect: () => { setAccount(null); setError(null); },
  }), [account, chainId, connecting, error]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside WalletProvider');
  return value;
}

export function WalletButton() {
  const wallet = useWallet();
  if (!wallet.connected) return <button className="wallet-button" type="button" onClick={() => void wallet.connect()} disabled={wallet.connecting}><Wallet size={16} />{wallet.connecting ? 'Connecting…' : 'Connect wallet'}</button>;
  if (!wallet.rightNetwork) return <button className="wallet-button wallet-wrong" type="button" onClick={() => void wallet.switchNetwork()}>Switch to Studio Dev</button>;
  return <button className="wallet-button wallet-connected" type="button" onClick={wallet.disconnect}><span className="wallet-dot" />{shortAddress(wallet.account ?? '')}</button>;
}

export function WalletNotice() {
  const wallet = useWallet();
  if (!wallet.error) return null;
  return <div className="wallet-notice" role="status">{wallet.error}</div>;
}

export function PendingWriteNotice() {
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  useEffect(() => {
    if (!readPendingWrite()) return;
    let active = true;
    void reconcilePendingWrite((next) => { if (active) setProgress(next); });
    return () => { active = false; };
  }, []);
  if (!progress || progress.stage === 'finalized') return null;
  return <div className="wallet-notice" role="status"><strong>Pending protocol transaction</strong><br />{progress.detail ?? 'Reconnecting to the submitted transaction.'}<br /><code className="mono">{progress.txId}</code></div>;
}
