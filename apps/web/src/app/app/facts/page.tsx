'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApi, asRecord, asString, type ApiPage } from '../../../lib/api';
import { factStatement, formatDate, shortHash } from '../../../lib/format';
import { ArrowRight, Filter, Search } from '../../../components/icons';
import { ButtonLink, EmptyState, ErrorState, OutcomeBadge, SectionHeading, Skeleton, StatusPill } from '../../../components/ui';

interface FactItem { fact: Record<string, unknown>; current_request?: Record<string, unknown> | null; canonical_resolution?: Record<string, unknown> | null; latest_resolution?: Record<string, unknown> | null; freshness?: { is_fresh: boolean } }
interface FactResponse extends ApiPage<FactItem> { source?: string }
interface PolicyOption { policy_id: string; version: number; name?: string; policy_hash?: string }
interface TemplateOption { template_id: string; version: number; name?: string; template_hash?: string }

export default function FactsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState('');
  const [fresh, setFresh] = useState('');
  const [policy, setPolicy] = useState('');
  const [template, setTemplate] = useState('');
  const [mutability, setMutability] = useState('');
  const [sort, setSort] = useState<'recent' | 'request'>('recent');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setOffset(0); }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const policies = useApi<ApiPage<PolicyOption>>('/policies?limit=50&offset=0');
  const templates = useApi<ApiPage<TemplateOption>>('/templates?limit=50&offset=0');
  const params = new URLSearchParams({ limit: '20', offset: String(offset), sort });
  if (query) params.set('search', query);
  if (outcome) params.set('outcome', outcome);
  if (fresh) params.set('fresh', fresh);
  if (policy) params.set('policy', policy);
  if (template) params.set('template', template);
  if (mutability) params.set('mutability', mutability);
  const result = useApi<FactResponse>(`/facts?${params.toString()}`);
  const total = result.data?.page?.total ?? 0;
  const hasNext = offset + 20 < total;
  const filterActive = Boolean(search || query || outcome || fresh || policy || template || mutability);
  const clearFilters = () => { setSearch(''); setQuery(''); setOutcome(''); setFresh(''); setPolicy(''); setTemplate(''); setMutability(''); setOffset(0); };

  return <>
    <div className="app-header"><div><span className="eyebrow">Public registry</span><h1>Fact registry</h1><p>Find a claim, compare its canonical result with the latest attempt, and check when it was last updated.</p></div><ButtonLink href="/app/create" variant="primary">Create a fact <ArrowRight size={15} /></ButtonLink></div>
    <SectionHeading eyebrow="Indexed protocol records" title="Search the registry" />
    <div className="filter-row">
      <label className="list-control"><Search size={15} /><input aria-label="Search facts" placeholder="Search proposition or key" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="list-control"><Filter size={15} /><select aria-label="Filter outcome" value={outcome} onChange={(event) => { setOutcome(event.target.value); setOffset(0); }}><option value="">All outcomes</option><option value="TRUE">True</option><option value="FALSE">False</option><option value="UNRESOLVED">Unresolved</option></select></label>
      <label className="list-control"><select aria-label="Filter freshness" value={fresh} onChange={(event) => { setFresh(event.target.value); setOffset(0); }}><option value="">Freshness</option><option value="true">Fresh</option><option value="false">Stale</option></select></label>
      <label className="list-control"><select aria-label="Filter policy" value={policy} onChange={(event) => { setPolicy(event.target.value); setOffset(0); }}><option value="">All policies</option>{policies.data?.items.map((item) => <option key={`${item.policy_id}-${item.version}`} value={item.policy_hash ?? item.policy_id}>{item.name || item.policy_id} · v{item.version}</option>)}</select></label>
      <label className="list-control"><select aria-label="Filter template" value={template} onChange={(event) => { setTemplate(event.target.value); setOffset(0); }}><option value="">All templates</option>{templates.data?.items.map((item) => <option key={`${item.template_id}-${item.version}`} value={item.template_hash ?? item.template_id}>{item.name || item.template_id} · v{item.version}</option>)}</select></label>
      <label className="list-control"><select aria-label="Filter mutability" value={mutability} onChange={(event) => { setMutability(event.target.value); setOffset(0); }}><option value="">All mutability</option><option value="IMMUTABLE">Immutable</option><option value="MUTABLE_WITH_TTL">Mutable with TTL</option></select></label>
      <label className="list-control"><select aria-label="Sort facts" value={sort} onChange={(event) => { setSort(event.target.value as 'recent' | 'request'); setOffset(0); }}><option value="recent">Recently resolved</option><option value="request">Recently requested</option></select></label>
      <button className="button button-quiet" type="button" onClick={clearFilters} disabled={!filterActive}>Clear filters</button>
    </div>

    {result.error ? <ErrorState detail={result.error.message} /> : <div className="panel fact-list">
      <div className="fact-list-head"><span>Proposition</span><span>Canonical</span><span>Freshness</span><span>Last committed</span><span /></div>
      {result.loading && [1, 2, 3, 4].map((item) => <div className="fact-list-row" key={item}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}
      {!result.loading && !result.data?.items.length && <EmptyState eyebrow={filterActive ? 'No matches' : 'Registry quiet'} title={filterActive ? 'No facts match these filters' : 'No indexed facts yet'} action={filterActive ? <button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button> : undefined}>{filterActive ? 'Try a broader search or clear the filters.' : 'Define a fact to start a new protocol request.'}</EmptyState>}
      {result.data?.items.map((item) => {
        const fact = asRecord(item.fact);
        const canonical = asRecord(item.canonical_resolution);
        const factKey = asString(fact.fact_key);
        const statement = factStatement(asRecord(item.current_request), shortHash(asString(fact.claim_key), 9));
        return <Link href={`/app/facts/${factKey}`} className="fact-list-row" key={factKey}>
          <div><strong>{statement}</strong><small>{shortHash(factKey, 8)} · {asString(fact.mutability, 'Unknown')} · {asString(item.current_request?.policy_id, 'Policy unavailable')}</small></div>
          <OutcomeBadge value={canonical.outcome ?? fact.current_outcome} compact />
          <StatusPill tone={item.freshness?.is_fresh ? 'positive' : 'warning'}>{item.freshness?.is_fresh ? 'Fresh' : 'Stale'}</StatusPill>
          <small>{formatDate(canonical.committed_at ?? fact.resolved_at)}</small>
          <ArrowRight size={14} />
        </Link>;
      })}
      <div className="pager"><span>{total ? `${offset + 1}–${Math.min(offset + 20, total)} of ${total}` : '0 results'}</span><div className="pager-actions"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button><button type="button" disabled={!hasNext} onClick={() => setOffset(offset + 20)}>Next</button></div></div>
    </div>}
  </>;
}
