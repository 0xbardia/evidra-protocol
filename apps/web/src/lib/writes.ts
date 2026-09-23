'use client';

import { CONTRACT_ADDRESSES, FROZEN_NETWORK } from '@evidra/protocol/constants';
import { getEthereumProvider, type EthereumProvider } from './wallet';

export type UserWriteMethod = 'request_fact' | 'request_fact_by_template' | 'refresh_fact' | 'request_reassessment' | 'retry_resolution' | 'cancel_stale_request' | 'request_callback_retry' | 'withdraw_credit';
export type WriteStage = 'preparing' | 'wallet' | 'submitted' | 'consensus' | 'decided' | 'finalizing' | 'finalized' | 'failed';

export interface WriteProgress {
  method: UserWriteMethod;
  stage: WriteStage;
  txId?: string;
  detail?: string;
}

export interface WriteInvocation {
  method: UserWriteMethod;
  args: readonly unknown[];
  value?: bigint;
}

const PENDING_KEY = 'evidra.pending.write.v1';

export function friendlyWriteMessage(error: unknown): string {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(value.code ?? '');
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/install a browser wallet|connect a browser wallet/i.test(message)) return 'Connect a supported browser wallet to continue.';
  if (/did not return an account or chain/i.test(message)) return 'The wallet did not provide an account and network. Unlock it, then reconnect.';
  if (code === '4001' || /user rejected|request rejected/i.test(message)) return 'Wallet approval was cancelled. No transaction was submitted.';
  if (code === '4902' || /wrong network|chain id/i.test(message)) return 'Switch your wallet to GenLayer Studio Dev (chain 61997), then try again.';
  if (/already pending|reconcile it/i.test(message)) return 'A previous transaction is still pending. Check its status before submitting another write.';
  if (/did not reach an accepted decision|did not finalize successfully/i.test(message)) return 'GenLayer did not complete this transaction. Check its status in your wallet before trying again.';
  if (/429|rate.?limit|quota|hard quota/i.test(message)) return 'Studio Dev is temporarily rate-limiting requests. Wait before retrying; do not submit the transaction again if you already approved it.';
  if (/fetch failed|network|timeout|timed out|unavailable/i.test(message)) return 'The network could not confirm this operation. If you approved a transaction, verify its status before trying again.';
  return 'The operation could not be completed. If you approved a transaction, verify its status before trying again.';
}

function assertBrowserChain(chainId: number): void {
  if (chainId !== FROZEN_NETWORK.chainId) throw new Error(`Wrong network. Connect to ${FROZEN_NETWORK.name} (${FROZEN_NETWORK.chainId}).`);
}

function providerOrThrow(): EthereumProvider {
  const provider = getEthereumProvider();
  if (!provider) throw new Error('Connect a browser wallet before submitting a protocol write.');
  return provider;
}

function transactionId(value: unknown): string {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['transaction_hash', 'transactionHash', 'hash', 'txId']) if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  throw new Error('Wallet returned no transaction identifier. The submission outcome is unknown; do not resubmit automatically.');
}

function statusName(transaction: unknown): string {
  if (!transaction || typeof transaction !== 'object') return '';
  const record = transaction as Record<string, unknown>;
  const lifecycle = record.lifecycle && typeof record.lifecycle === 'object' ? record.lifecycle as Record<string, unknown> : {};
  return String(record.statusName ?? record.status_name ?? record.status ?? lifecycle.state ?? '').toUpperCase();
}

export function readPendingWrite(): { method: UserWriteMethod; txId: string; account: string; createdAt: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (typeof record.method !== 'string' || typeof record.txId !== 'string' || typeof record.account !== 'string') return null;
    return { method: record.method as UserWriteMethod, txId: record.txId, account: record.account, createdAt: String(record.createdAt ?? '') };
  } catch { return null; }
}

function persistPendingWrite(value: { method: UserWriteMethod; txId: string; account: string }): void {
  try { window.localStorage.setItem(PENDING_KEY, JSON.stringify({ ...value, createdAt: new Date().toISOString() })); } catch { /* storage is optional */ }
}

export function clearPendingWrite(): void {
  try { window.localStorage.removeItem(PENDING_KEY); } catch { /* storage is optional */ }
}

async function sdkClient(account?: string): Promise<{ writeContract: (args: Record<string, unknown>) => Promise<unknown>; waitForDecision: (args: Record<string, unknown>) => Promise<unknown>; waitForFinalization: (args: Record<string, unknown>) => Promise<unknown>; readContract: (args: Record<string, unknown>) => Promise<unknown>; estimateTransactionFees: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }> {
  const chain = (await import('genlayer-js')).chains.studioDevnet;
  const { createClient } = await import('genlayer-js');
  const provider = account ? providerOrThrow() : undefined;
  return createClient({ chain: chain as never, endpoint: FROZEN_NETWORK.rpcUrl, ...(account ? { account: account as `0x${string}`, provider } : {}) } as never) as never;
}

export async function quoteProtocolFee(reuseMode: string): Promise<bigint> {
  const client = await sdkClient();
  const result = await client.readContract({ address: CONTRACT_ADDRESSES.registry, functionName: 'quote_resolution_fee', args: [reuseMode], jsonSafeReturn: true });
  return BigInt(String(result));
}

export async function quoteRetryFee(): Promise<bigint> {
  const client = await sdkClient();
  const result = await client.readContract({ address: CONTRACT_ADDRESSES.registry, functionName: 'get_protocol_config', args: [], jsonSafeReturn: true }) as Record<string, unknown>;
  return BigInt(String(result.fee_per_attempt ?? '0'));
}

export interface FactIdentityInput {
  subject: string;
  predicate: string;
  objectValue: string;
  qualifiers: string;
  temporal: string;
  mutability: string;
  policyId: string;
  policyVersion: number;
  templateId?: string;
  templateVersion?: number;
}

export async function deriveFactKey(input: FactIdentityInput): Promise<string> {
  const client = await sdkClient();
  const claim = await client.readContract({ address: CONTRACT_ADDRESSES.registry, functionName: 'compute_claim_key', args: [input.subject, input.predicate, input.objectValue, input.qualifiers, input.temporal, input.mutability], jsonSafeReturn: true });
  let policyHash: unknown = await client.readContract({ address: CONTRACT_ADDRESSES.policyRegistry, functionName: 'get_policy_hash', args: [input.policyId, input.policyVersion], jsonSafeReturn: true });
  let templateHash = '';
  if (input.templateId) {
    const template = await client.readContract({ address: CONTRACT_ADDRESSES.policyRegistry, functionName: 'get_template', args: [input.templateId, input.templateVersion ?? 1], jsonSafeReturn: true }) as Record<string, unknown>;
    templateHash = String(template.template_hash ?? '');
    policyHash = await client.readContract({ address: CONTRACT_ADDRESSES.policyRegistry, functionName: 'get_policy_hash', args: [template.default_policy_id, template.default_policy_version], jsonSafeReturn: true });
  }
  const fact = await client.readContract({ address: CONTRACT_ADDRESSES.registry, functionName: 'compute_fact_key', args: [claim, policyHash, '1', templateHash], jsonSafeReturn: true });
  return String(fact);
}

export async function submitUserWrite(account: string, invocation: WriteInvocation, onProgress?: (progress: WriteProgress) => void): Promise<{ txId: string; finalized: unknown }> {
  const provider = providerOrThrow();
  const chainHex = await provider.request<string>({ method: 'eth_chainId' });
  assertBrowserChain(Number.parseInt(chainHex, 16));
  const pending = readPendingWrite();
  if (pending) throw new Error(`A protocol transaction is already pending (${pending.txId}). Reconcile it before submitting another write.`);
  onProgress?.({ method: invocation.method, stage: 'preparing' });
  const client = await sdkClient(account);
  const executionFees = await client.estimateTransactionFees({});
  onProgress?.({ method: invocation.method, stage: 'wallet', detail: 'Approve the transaction in your wallet.' });
  const raw = await client.writeContract({ address: CONTRACT_ADDRESSES.registry, functionName: invocation.method, args: invocation.args, fees: executionFees, ...(invocation.value !== undefined ? { value: invocation.value } : {}) });
  const txId = transactionId(raw);
  persistPendingWrite({ method: invocation.method, txId, account });
  onProgress?.({ method: invocation.method, stage: 'submitted', txId, detail: 'Transaction submitted. Waiting for GenLayer consensus.' });
  onProgress?.({ method: invocation.method, stage: 'consensus', txId, detail: 'GenLayer is reaching a decision. Keep this tab open or return later to reconcile.' });
  const decided = await client.waitForDecision({ hash: txId });
  const decidedName = statusName(decided);
  if (decidedName.includes('UNDETERMINED') || decidedName.includes('TIMEOUT') || decidedName.includes('CANCELED')) {
    onProgress?.({ method: invocation.method, stage: 'failed', txId, detail: 'GenLayer did not accept this transaction. Check its status before trying again.' });
    throw new Error('Transaction did not reach an accepted decision.');
  }
  onProgress?.({ method: invocation.method, stage: 'decided', txId, detail: 'Decision accepted. Waiting for finalization.' });
  onProgress?.({ method: invocation.method, stage: 'finalizing', txId });
  const finalized = await client.waitForFinalization({ hash: txId });
  const finalizedName = statusName(finalized);
  if (finalizedName.includes('CANCELED') || finalizedName.includes('UNDETERMINED') || finalizedName.includes('TIMEOUT')) {
    onProgress?.({ method: invocation.method, stage: 'failed', txId, detail: 'The transaction did not finalize. Check its status before trying again.' });
    throw new Error('Transaction did not finalize successfully.');
  }
  clearPendingWrite();
  onProgress?.({ method: invocation.method, stage: 'finalized', txId, detail: 'Transaction finalized. Reconcile the resulting protocol state before declaring completion.' });
  return { txId, finalized };
}

export async function reconcilePendingWrite(onProgress?: (progress: WriteProgress) => void): Promise<WriteProgress | null> {
  const pending = readPendingWrite();
  if (!pending) return null;
  const progress = (stage: WriteStage, detail?: string): WriteProgress => ({ method: pending.method, stage, txId: pending.txId, ...(detail === undefined ? {} : { detail }) });
  try {
    const client = await sdkClient();
    onProgress?.(progress('consensus', 'Reconnecting to the submitted transaction.'));
    const decided = await client.waitForDecision({ hash: pending.txId });
    const decidedName = statusName(decided);
    if (decidedName.includes('UNDETERMINED') || decidedName.includes('TIMEOUT') || decidedName.includes('CANCELED')) {
      const result = progress('failed', 'The transaction has not reached an accepted decision. Do not submit it again while its status is uncertain.');
      onProgress?.(result);
      return result;
    }
    onProgress?.(progress('decided', 'Decision accepted. Waiting for finalization.'));
    onProgress?.(progress('finalizing'));
    const finalized = await client.waitForFinalization({ hash: pending.txId });
    const finalizedName = statusName(finalized);
    if (finalizedName.includes('CANCELED') || finalizedName.includes('UNDETERMINED') || finalizedName.includes('TIMEOUT')) {
      const result = progress('failed', 'The transaction has not finalized. Do not submit it again while its status is uncertain.');
      onProgress?.(result);
      return result;
    }
    clearPendingWrite();
    const result = progress('finalized', 'Transaction finalized. Re-read protocol state before taking another action.');
    onProgress?.(result);
    return result;
  } catch (cause) {
    const result = progress('failed', friendlyWriteMessage(cause));
    onProgress?.(result);
    return result;
  }
}

export const registryWrite = (method: UserWriteMethod, args: readonly unknown[], value?: bigint): WriteInvocation => ({ method, args, ...(value === undefined ? {} : { value }) });
