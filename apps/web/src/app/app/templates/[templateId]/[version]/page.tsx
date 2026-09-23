'use client';

import { use } from 'react';
import { useApi, asString } from '../../../../../lib/api';
import { formatDate } from '../../../../../lib/format';
import { ArrowRight } from '../../../../../components/icons';
import { ButtonLink, ErrorState, Hash, Skeleton, StatusPill } from '../../../../../components/ui';

export default function TemplateDetailPage({ params }: { params: Promise<{ templateId: string; version: string }> }) {
  const values = use(params); const result = useApi<{ template: Record<string, unknown> }>(`/templates/${encodeURIComponent(values.templateId)}/${values.version}`); const template = result.data?.template;
  if (result.error) return <ErrorState title="Template unavailable" detail={result.error.message} />;
  if (result.loading || !template) return <Skeleton className="skeleton-card" />;
  return <><div className="app-header"><div><span className="eyebrow">Template / {values.templateId} / v{values.version}</span><h1>{asString(template.name, values.templateId)}</h1><p>{asString(template.fact_type, 'Versioned fact template')} · existing requests retain this exact rule set.</p></div><ButtonLink href="/app/templates" variant="secondary">All templates <ArrowRight size={14} /></ButtonLink></div><div className="detail-grid"><div className="panel"><div className="panel-heading"><h2>Resolution instructions</h2><StatusPill tone={template.active && !template.deprecated ? 'positive' : 'warning'}>{template.deprecated ? 'Deprecated' : template.active ? 'Active' : 'Inactive'}</StatusPill></div><div className="panel-body"><p>{asString(template.resolution_instructions, 'No instructions published.')}</p><h3>Required fields</h3><p className="mono">{asString(template.required_fields, 'None declared')}</p></div></div><div className="panel"><div className="panel-heading"><h2>Identity</h2></div><div className="panel-body"><dl className="key-list"><div><dt>Template hash</dt><dd><Hash value={asString(template.template_hash)} /></dd></div><div><dt>Default policy</dt><dd>{asString(template.default_policy_id)} / v{asString(template.default_policy_version)}</dd></div><div><dt>Published</dt><dd>{formatDate(template.published_at)}</dd></div></dl></div></div></div></>;
}
