'use client';

import Link from 'next/link';
import { useApi, type ApiPage } from '../../../lib/api';
import { shortHash } from '../../../lib/format';
import { ArrowRight } from '../../../components/icons';
import { EmptyState, ErrorState, SectionHeading, Skeleton, StatusPill } from '../../../components/ui';

interface Policy extends Record<string, unknown> { policy_id: string; version: number; name: string; policy_hash: string; active: boolean; deprecated: boolean; min_primary_sources: number; min_independent_sources: number; require_cross_check: boolean }
type Response = ApiPage<Policy>;

export default function PoliciesPage() {
  const result = useApi<Response>('/policies?limit=50&offset=0');
  return <><div className="app-header"><div><span className="eyebrow">Evidence policy</span><h1>Policies</h1><p>Versioned rules decide which evidence can support a boolean outcome. Historical versions remain addressable.</p></div></div><SectionHeading eyebrow="Policy registry" title="Constraints before conclusions" /><div className="panel"><div className="panel-heading"><h2>Published policy versions</h2><span className="muted">{result.data?.page?.total ?? '—'} records</span></div>{result.error ? <ErrorState detail={result.error.message} /> : result.loading ? <div className="panel-body"><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /></div> : !result.data?.items.length ? <EmptyState title="No policies indexed" /> : <div className="table-scroll"><table className="detail-table"><thead><tr><th>Policy</th><th>State</th><th>Requirements</th><th>Hash</th><th /></tr></thead><tbody>{result.data.items.map((policy) => <tr key={`${policy.policy_id}-${policy.version}`}><td><strong>{policy.name || policy.policy_id}</strong><br /><span className="mono">{policy.policy_id} / v{policy.version}</span></td><td><StatusPill tone={policy.active && !policy.deprecated ? 'positive' : 'warning'}>{policy.deprecated ? 'Deprecated' : policy.active ? 'Active' : 'Inactive'}</StatusPill></td><td>{policy.min_primary_sources} primary · {policy.min_independent_sources} independent{policy.require_cross_check ? ' · cross-check' : ''}</td><td><span className="mono">{shortHash(policy.policy_hash, 7)}</span></td><td><Link className="external-link" href={`/app/policies/${encodeURIComponent(policy.policy_id)}/${policy.version}`}>Open <ArrowRight size={13} /></Link></td></tr>)}</tbody></table></div>}</div></>;
}
