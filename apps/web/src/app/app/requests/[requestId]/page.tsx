'use client';

import { use } from 'react';
import { useApi, asString } from '../../../../lib/api';
import { formatDate } from '../../../../lib/format';
import { ArrowRight } from '../../../../components/icons';
import { ButtonLink, ErrorState, Hash, Skeleton, StatusPill } from '../../../../components/ui';

export default function RequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params); const result = useApi<{ request: Record<string, unknown> }>(`/requests/${requestId}`); const request = result.data?.request;
  if (result.error) return <ErrorState title="Request unavailable" detail={result.error.message} />;
  if (result.loading || !request) return <Skeleton className="skeleton-card" />;
  return <><div className="app-header"><div><span className="eyebrow">Request / {requestId}</span><h1>{asString(request.status, 'Unknown')}</h1><p>Request lifecycle state for the user-originated protocol operation.</p></div><StatusPill tone={request.status === 'RESOLVED' || request.status === 'REUSED' ? 'positive' : request.status === 'FAILED' ? 'negative' : 'warning'}>{asString(request.callback_status, 'No callback')}</StatusPill></div><div className="detail-grid"><div className="panel"><div className="panel-heading"><h2>Binding</h2></div><div className="panel-body"><dl className="key-list"><div><dt>Fact key</dt><dd><Hash value={asString(request.fact_key)} /></dd></div><div><dt>Claim key</dt><dd><Hash value={asString(request.claim_key)} /></dd></div><div><dt>Policy</dt><dd>{asString(request.policy_id)} / v{asString(request.policy_version)}</dd></div><div><dt>Created</dt><dd>{formatDate(request.created_at)}</dd></div></dl></div></div><div className="panel"><div className="panel-heading"><h2>Execution</h2></div><div className="panel-body"><dl className="key-list"><div><dt>Attempt</dt><dd>{asString(request.active_attempt_id)} / {asString(request.attempt_count)} used</dd></div><div><dt>Resolver</dt><dd className="address">{asString(request.assigned_resolver)}</dd></div><div><dt>Reuse</dt><dd>{asString(request.reuse_mode)}</dd></div><div><dt>Callback</dt><dd>{asString(request.callback_status)}</dd></div></dl></div></div></div><div className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Fact page</h2></div><div className="panel-body"><ButtonLink href={`/app/facts/${asString(request.fact_key)}`} variant="secondary">Open Fact detail <ArrowRight size={14} /></ButtonLink></div></div></>;
}
