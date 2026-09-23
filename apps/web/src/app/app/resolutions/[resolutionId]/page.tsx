'use client';

import { use } from 'react';
import { useApi, asBoolean, asString } from '../../../../lib/api';
import { formatDate } from '../../../../lib/format';
import { ErrorState, Hash, Skeleton, StatusPill } from '../../../../components/ui';

export default function ResolutionPage({ params }: { params: Promise<{ resolutionId: string }> }) {
  const { resolutionId } = use(params); const result = useApi<{ resolution: Record<string, unknown>; metadata?: Record<string, unknown> }>(`/resolutions/${resolutionId}`); const resolution = result.data?.resolution;
  if (result.error) return <ErrorState title="Resolution unavailable" detail={result.error.message} />;
  if (result.loading || !resolution) return <Skeleton className="skeleton-card" />;
  return <><div className="app-header"><div><span className="eyebrow">Resolution / {resolutionId}</span><h1>{asString(resolution.outcome, 'UNRESOLVED')}</h1><p>This record contains the committed outcome and informational evidence/reasoning references. Canonical status is determined by the Fact record.</p></div><StatusPill tone={asBoolean(resolution.policy_satisfied) ? 'positive' : 'warning'}>{asString(resolution.diagnostic_reason, 'No diagnostic')}</StatusPill></div><div className="detail-grid"><div className="panel"><div className="panel-heading"><h2>Consensus fields</h2></div><div className="panel-body"><dl className="key-list"><div><dt>Fact key</dt><dd><Hash value={asString(resolution.fact_key)} /></dd></div><div><dt>Policy satisfied</dt><dd>{asBoolean(resolution.policy_satisfied) ? 'Yes' : 'No'}</dd></div><div><dt>Resolution version</dt><dd>v{asString(resolution.resolution_version)}</dd></div><div><dt>Supersedes</dt><dd>{asString(resolution.supersedes_resolution_id, '0')}</dd></div></dl></div></div><div className="panel"><div className="panel-heading"><h2>Timing</h2></div><div className="panel-body"><dl className="key-list"><div><dt>Evaluated</dt><dd>{formatDate(resolution.evaluated_at)}</dd></div><div><dt>Committed</dt><dd>{formatDate(resolution.committed_at)}</dd></div><div><dt>Valid until</dt><dd>{Number(resolution.valid_until) === 0 ? 'No expiry' : formatDate(resolution.valid_until)}</dd></div></dl></div></div></div><div className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Evidence manifest reference</h2><StatusPill>Informational</StatusPill></div><div className="panel-body"><Hash value={asString(resolution.evidence_manifest_hash)} /></div></div></>;
}
