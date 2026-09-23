'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useApi, asRecord, asString } from '../../lib/api';
import { activityDetail, activityLabel, factStatement, formatDate, shortHash } from '../../lib/format';
import { ArrowRight } from '../../components/icons';
import { ButtonLink, EmptyState, ErrorState, OutcomeBadge, Skeleton, StatusPill } from '../../components/ui';

const CreditPanel = dynamic(() => import('../../components/credit-panel').then((module) => module.CreditPanel), { ssr: false });

interface Protocol { network?: string; chain_id?: number; paused?: boolean; resolver_enabled?: boolean; sync?: { status?: string; lastFinalizedAt?: string | null; lastSuccessAt?: string | null }; indexer?: Record<string, unknown> }
interface Stats { stats?: Record<string, unknown> }
interface FactItem { fact: Record<string, unknown>; current_request?: Record<string, unknown> | null; canonical_resolution?: Record<string, unknown> | null; freshness?: { is_fresh: boolean } }
interface Facts { items: FactItem[]; page: { total: number } }
interface Activity { items: Array<Record<string, unknown>> }

export default function OverviewPage() {
  const [showCredit, setShowCredit] = useState(false);
  const protocol = useApi<Protocol>('/protocol');
  const stats = useApi<Stats>('/stats');
  const facts = useApi<Facts>('/facts?limit=5&sort=recent');
  const activity = useApi<Activity>('/activity?limit=5');
  const indexer = protocol.data?.indexer ?? {};
  const degraded = protocol.data?.sync?.status !== 'healthy' || Boolean(indexer.lastError);
  const readStatus = protocol.data?.paused ? 'Protocol paused' : degraded ? 'Finalized reads delayed' : protocol.data?.resolver_enabled ? 'Ready for requests' : 'Resolver unavailable';

  if (protocol.error && !protocol.data) return <ErrorState detail={protocol.error.message} />;
  return <>
    <div className="app-header"><div><span className="eyebrow">Protocol overview</span><h1>Overview</h1><p>See the current read status, recent Facts, and the actions available to you.</p></div><ButtonLink href="/app/create" variant="primary">Define a fact <ArrowRight size={15} /></ButtonLink></div>

    <div className="data-grid">
      <div className="data-card"><span className="data-label">Network</span><strong>{protocol.loading ? '…' : protocol.data?.chain_id ?? '—'}</strong><p>{protocol.data?.network ?? 'Studio Dev'}</p></div>
      <div className="data-card"><span className="data-label">Indexed facts</span><strong>{facts.loading ? '…' : facts.data?.page?.total ?? '—'}</strong><p>Public records in the registry</p></div>
      <div className="data-card"><span className="data-label">Resolutions</span><strong>{stats.loading ? '…' : asString(stats.data?.stats?.resolutions ?? stats.data?.stats?.resolution_count, '—')}</strong><p>Committed resolution history</p></div>
    </div>

    <section style={{ marginTop: 18 }} aria-label="Protocol credit">
      <div className="hero-actions" style={{ justifyContent: 'space-between' }}><div><h2>Protocol credit</h2><p className="muted">Wallet-owned balance, separate from your network balance.</p></div><button className="button button-quiet" type="button" aria-expanded={showCredit} onClick={() => setShowCredit((value) => !value)}>{showCredit ? 'Hide credit' : 'Check wallet credit'}</button></div>
      {showCredit && <CreditPanel />}
    </section>

    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading"><div><span className="eyebrow">Protocol status</span><h2>Read health</h2></div><StatusPill tone={degraded || protocol.data?.paused ? 'warning' : 'positive'}>{readStatus}</StatusPill></div>
      <div className="panel-body">
        {degraded && <div className="callout status-callout"><strong>Cached data remains available.</strong>Finalized chain verification is delayed. Existing records stay visible and are labeled as cached.</div>}
        <dl className="key-list"><div><dt>Network</dt><dd>{protocol.data?.network ?? 'GenLayer Studio Dev'} · chain {protocol.data?.chain_id ?? 61997}</dd></div><div><dt>Data last indexed</dt><dd>{formatDate(protocol.data?.sync?.lastFinalizedAt ?? protocol.data?.sync?.lastSuccessAt)}</dd></div></dl>
      </div>
    </div>

    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading"><h2>Recent facts</h2><Link className="external-link" href="/app/facts">Browse the registry <ArrowRight size={14} /></Link></div>
      <div className="fact-list">
        {facts.loading && [1, 2, 3].map((item) => <div className="fact-list-row" key={item}><Skeleton /><Skeleton /><Skeleton /></div>)}
        {facts.error && <ErrorState title="Facts are temporarily unavailable" detail={facts.error.message} />}
        {!facts.loading && !facts.error && !facts.data?.items.length && <EmptyState title="No facts indexed yet" action={<ButtonLink href="/app/create" variant="secondary">Create the first fact</ButtonLink>} />}
        {facts.data?.items.map((item) => <FactRow item={item} key={asString(item.fact.fact_key)} />)}
      </div>
    </div>

    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading"><h2>Recent activity</h2><Link className="external-link" href="/app/activity">Open activity <ArrowRight size={14} /></Link></div>
      <div className="panel-body">
        {activity.loading && <Skeleton className="skeleton-row" />}
        {activity.error && <ErrorState title="Activity is temporarily unavailable" detail={activity.error.message} />}
        {!activity.loading && !activity.error && !activity.data?.items.length && <EmptyState eyebrow="No indexed activity" title="The stream is quiet" />}
        {activity.data?.items.length ? <div className="timeline">{activity.data.items.slice(0, 4).map((item, index) => <div className="timeline-item" key={`${asString(item.activity_type)}-${asString(item.activity_id)}-${index}`}><div className="timeline-node" /><div><h3>{activityLabel(item.activity_type)}</h3><p>{activityDetail(item)} · {formatDate(item.occurred_at)}</p></div></div>)}</div> : null}
      </div>
    </div>
  </>;
}

function FactRow({ item }: { item: FactItem }) {
  const fact = asRecord(item.fact);
  const resolution = asRecord(item.canonical_resolution);
  const key = asString(fact.fact_key);
  const statement = factStatement(asRecord(item.current_request), shortHash(asString(fact.claim_key), 9));
  return <Link className="fact-list-row" href={`/app/facts/${key}`}><div><strong>{statement}</strong><small>{shortHash(key, 8)} · {asString(fact.mutability, 'Unknown')}</small></div><OutcomeBadge value={resolution.outcome ?? fact.current_outcome} compact /><StatusPill tone={item.freshness?.is_fresh ? 'positive' : 'warning'}>{item.freshness?.is_fresh ? 'Fresh' : 'Stale'}</StatusPill><small>{formatDate(resolution.committed_at ?? fact.resolved_at)}</small><ArrowRight size={14} /></Link>;
}
