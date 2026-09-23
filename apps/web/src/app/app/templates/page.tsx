'use client';

import Link from 'next/link';
import { useApi, type ApiPage } from '../../../lib/api';
import { shortHash } from '../../../lib/format';
import { ArrowRight } from '../../../components/icons';
import { EmptyState, ErrorState, SectionHeading, Skeleton, StatusPill } from '../../../components/ui';

interface Template extends Record<string, unknown> { template_id: string; version: number; name: string; fact_type: string; template_hash: string; active: boolean; deprecated: boolean; required_fields: string }
type Response = ApiPage<Template>;

export default function TemplatesPage() {
  const result = useApi<Response>('/templates?limit=50&offset=0');
  return <><div className="app-header"><div><span className="eyebrow">Fact templates</span><h1>Templates</h1><p>Templates bind a fact type and resolution instructions to an exact version. A newer version never rewrites an existing Fact.</p></div></div><SectionHeading eyebrow="Template registry" title="Rules with an address" /><div className="panel"><div className="panel-heading"><h2>Published template versions</h2><span className="muted">{result.data?.page?.total ?? '—'} records</span></div>{result.error ? <ErrorState detail={result.error.message} /> : result.loading ? <div className="panel-body"><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /></div> : !result.data?.items.length ? <EmptyState title="No templates indexed" /> : <div className="table-scroll"><table className="detail-table"><thead><tr><th>Template</th><th>State</th><th>Fact type</th><th>Identity</th><th /></tr></thead><tbody>{result.data.items.map((template) => <tr key={`${template.template_id}-${template.version}`}><td><strong>{template.name || template.template_id}</strong><br /><span className="mono">{template.template_id} / v{template.version}</span></td><td><StatusPill tone={template.active && !template.deprecated ? 'positive' : 'warning'}>{template.deprecated ? 'Deprecated' : template.active ? 'Active' : 'Inactive'}</StatusPill></td><td>{template.fact_type || 'Custom-compatible'}</td><td><span className="mono">{shortHash(template.template_hash, 7)}</span></td><td><Link className="external-link" href={`/app/templates/${encodeURIComponent(template.template_id)}/${template.version}`}>Open <ArrowRight size={13} /></Link></td></tr>)}</tbody></table></div>}</div></>;
}
