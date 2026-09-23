'use client';

import { use } from 'react';
import { useApi, asString } from '../../../../../lib/api';
import { formatDate } from '../../../../../lib/format';
import { ArrowRight } from '../../../../../components/icons';
import { ButtonLink, ErrorState, Hash, Skeleton, StatusPill } from '../../../../../components/ui';

export default function PolicyDetailPage({ params }: { params: Promise<{ policyId: string; version: string }> }) {
  const values = use(params); const result = useApi<{ policy: Record<string, unknown> }>(`/policies/${encodeURIComponent(values.policyId)}/${values.version}`); const policy = result.data?.policy;
  if (result.error) return <ErrorState title="Policy unavailable" detail={result.error.message} />;
  if (result.loading || !policy) return <Skeleton className="skeleton-card" />;
  return <><div className="app-header"><div><span className="eyebrow">Policy / {values.policyId} / v{values.version}</span><h1>{asString(policy.name, values.policyId)}</h1><p>{asString(policy.semantic_rules, 'This version stores the source requirements used by the resolver.')}</p></div><ButtonLink href="/app/policies" variant="secondary">All policies <ArrowRight size={14} /></ButtonLink></div><div className="detail-grid"><div className="panel"><div className="panel-heading"><h2>Policy constraints</h2><StatusPill tone={policy.active && !policy.deprecated ? 'positive' : 'warning'}>{policy.deprecated ? 'Deprecated' : policy.active ? 'Active' : 'Inactive'}</StatusPill></div><div className="panel-body"><dl className="key-list"><div><dt>Allowed classes</dt><dd>{asString(policy.allowed_classes, 'Unrestricted by allow-list')}</dd></div><div><dt>Disallowed classes</dt><dd>{asString(policy.disallowed_classes, 'None declared')}</dd></div><div><dt>Primary sources</dt><dd>{asString(policy.min_primary_sources)}</dd></div><div><dt>Independent sources</dt><dd>{asString(policy.min_independent_sources)}</dd></div><div><dt>Cross-check</dt><dd>{policy.require_cross_check ? 'Required' : 'Not required'}</dd></div></dl></div></div><div className="panel"><div className="panel-heading"><h2>Identity</h2></div><div className="panel-body"><dl className="key-list"><div><dt>Policy hash</dt><dd><Hash value={asString(policy.policy_hash)} /></dd></div><div><dt>Published</dt><dd>{formatDate(policy.published_at)}</dd></div><div><dt>Version</dt><dd>v{asString(policy.version)}</dd></div></dl></div></div></div></>;
}
