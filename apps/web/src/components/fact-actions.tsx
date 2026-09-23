'use client';

import { useState } from 'react';
import { asString } from '../lib/api';
import { friendlyWriteMessage, quoteProtocolFee, quoteRetryFee, registryWrite, submitUserWrite, type UserWriteMethod, type WriteProgress } from '../lib/writes';
import { validateUrlList } from '../lib/validation';
import { useWallet } from './wallet-context';
import { ArrowRight, Refresh } from './icons';
import { StatusPill } from './ui';
import { protocolStatusLabel } from '../lib/format';

const pendingStages = ['preparing', 'wallet', 'submitted', 'consensus', 'decided', 'finalizing'] as const;

export function FactActions({ factKey, requestId, req }: { factKey: string; requestId: string; req: Record<string, unknown> }) {
  const wallet = useWallet();
  const [urls, setUrls] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = asString(req.status);
  const callback = asString(req.callback_status);
  const canRetry = status === 'PENDING' || status === 'DISPATCHED';
  const canCallbackRetry = (status === 'RESOLVED' || status === 'REUSED') && (callback === 'DISPATCHED' || callback === 'FAILED_REPORTED');
  const sourceList = (): string[] => urls.split('\n').map((value) => value.trim()).filter(Boolean);
  const writeBusy = progress !== null && pendingStages.includes(progress.stage as (typeof pendingStages)[number]);

  const run = async (method: UserWriteMethod, args: readonly unknown[], payable: boolean) => {
    setError(null);
    if (!wallet.account || !wallet.rightNetwork) { setError('Connect a wallet on Studio Dev before submitting.'); return; }
    if (method === 'request_reassessment' || method === 'refresh_fact') {
      const issue = validateUrlList(sourceList(), 8);
      if (issue) { setError(issue); return; }
    }
    try {
      const fee = payable ? method === 'retry_resolution' ? await quoteRetryFee() : await quoteProtocolFee('FORCE_FRESH_RESOLUTION') : undefined;
      await submitUserWrite(wallet.account, registryWrite(method, args, fee), setProgress);
    } catch (cause) {
      const message = friendlyWriteMessage(cause);
      setError(message);
      setProgress((current) => current?.stage === 'failed' ? current : { method, stage: 'failed', ...(current?.txId ? { txId: current.txId } : {}), detail: message });
    }
  };

  return <div className="panel"><div className="panel-heading"><h2>Protocol actions</h2><StatusPill>{protocolStatusLabel(status)}</StatusPill></div><div className="panel-body"><div className="form-stack"><div className="form-field"><label htmlFor="supplemental-evidence">New evidence URLs</label><textarea id="supplemental-evidence" value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="One HTTPS source per line" /><span className="field-hint">A reassessment is for new real-world evidence, not a validator appeal.</span></div><div className="form-field"><label htmlFor="reassessment-notes">Reassessment note</label><input id="reassessment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional context" /></div><div className="hero-actions"><button className="button button-secondary" type="button" disabled={!wallet.rightNetwork || writeBusy} onClick={() => void run('request_reassessment', [factKey, JSON.stringify(sourceList()), notes, ''], true)}>Request reassessment <Refresh size={14} /></button>{req.mutability === 'MUTABLE_WITH_TTL' && <button className="button button-secondary" type="button" disabled={!wallet.rightNetwork || writeBusy} onClick={() => void run('refresh_fact', [factKey, JSON.stringify(sourceList()), ''], true)}>Refresh mutable fact <Refresh size={14} /></button>}{canRetry && <button className="button button-secondary" type="button" disabled={!wallet.rightNetwork || writeBusy} onClick={() => void run('retry_resolution', [BigInt(requestId)], true)}>Retry resolution <ArrowRight size={14} /></button>}{canRetry && <button className="button button-quiet" type="button" disabled={!wallet.rightNetwork || writeBusy} onClick={() => void run('cancel_stale_request', [BigInt(requestId)], false)}>Cancel if stale</button>}{canCallbackRetry && <button className="button button-quiet" type="button" disabled={!wallet.rightNetwork || writeBusy} onClick={() => void run('request_callback_retry', [BigInt(requestId)], false)}>Retry callback</button>}</div>{progress && <div className="tx-panel" role="status"><StatusPill tone={progress.stage === 'finalized' ? 'positive' : progress.stage === 'failed' ? 'negative' : 'warning'}>{protocolStatusLabel(progress.stage)}</StatusPill><p>{progress.detail ?? 'Processing protocol transaction.'}</p>{progress.txId && <code className="terminal">{progress.txId}</code>}</div>}{error && <p className="field-error" role="alert">{error}</p>}</div></div></div>;
}
