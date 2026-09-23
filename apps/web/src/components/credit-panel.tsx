'use client';

import { createProtocolClient } from '@evidra/protocol';
import { useEffect, useState } from 'react';
import { FROZEN_NETWORK } from '../lib/config';
import { friendlyWriteMessage, registryWrite, submitUserWrite, type WriteProgress } from '../lib/writes';
import { useWallet } from './wallet-context';
import { StatusPill } from './ui';

export function CreditPanel() {
  const wallet = useWallet();
  const [credit, setCredit] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.account || !wallet.rightNetwork) { setCredit(null); return; }
    let active = true;
    setLoading(true);
    setError(null);
    void createProtocolClient({ rpcUrl: FROZEN_NETWORK.rpcUrl }).registry.getCredit(wallet.account)
      .then((value) => { if (active) setCredit(value); })
      .catch((cause) => { if (active) setError(friendlyWriteMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wallet.account, wallet.rightNetwork]);

  const withdraw = async () => {
    if (!wallet.account || !wallet.rightNetwork || credit === null || credit === 0n) return;
    try {
      setError(null);
      await submitUserWrite(wallet.account, registryWrite('withdraw_credit', []), setProgress);
      setCredit(0n);
    } catch (cause) {
      setError(friendlyWriteMessage(cause));
    }
  };

  return <div className="panel credit-panel"><div className="panel-heading"><div><span className="eyebrow">Wallet-owned balance</span><h2>Protocol credit</h2></div><StatusPill tone={credit && credit > 0n ? 'positive' : 'neutral'}>{!wallet.account ? 'Wallet required' : !wallet.rightNetwork ? 'Wrong network' : loading ? 'Reading' : 'Finalized read'}</StatusPill></div><div className="panel-body"><div className="credit-row"><div><strong>{!wallet.account ? '—' : credit === null ? '…' : credit.toString()}</strong><p>Credit is separate from the wallet’s network balance.</p></div>{wallet.account ? <button className="button button-secondary" type="button" onClick={() => void withdraw} disabled={!wallet.rightNetwork || credit === null || credit === 0n || loading || progress?.stage === 'submitted' || progress?.stage === 'consensus' || progress?.stage === 'finalizing'}>Withdraw credit</button> : <button className="button button-secondary" type="button" onClick={() => void wallet.connect}>Connect wallet</button>}</div>{progress && <p className="field-hint" role="status">{progress.detail ?? progress.stage}</p>}{error && <p className="field-error" role="alert">Credit read failed: {error}</p>}</div></div>;
}
