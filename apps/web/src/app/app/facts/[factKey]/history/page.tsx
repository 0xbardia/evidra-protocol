'use client';

import Link from 'next/link';
import { use } from 'react';
import { useApi, asRecord, asString } from '../../../../../lib/api';
import { formatDate } from '../../../../../lib/format';
import { ArrowRight } from '../../../../../components/icons';
import { ButtonLink, EmptyState, ErrorState, OutcomeBadge, Skeleton } from '../../../../../components/ui';

interface HistoryResponse { items: Array<{ resolution: Record<string, unknown> }>; page: { total: number } }

export default function FactHistoryPage({ params }: { params: Promise<{ factKey: string }> }) {
  const { factKey } = use(params); const result = useApi<HistoryResponse>(`/facts/${factKey}/resolutions?offset=0&limit=50`);
  if (result.error) return <ErrorState title="History unavailable" detail={result.error.message} />;
  return <><div className="app-header"><div><span className="eyebrow">Fact history</span><h1>Resolution history</h1><p>Every committed attempt remains addressable. Canonical advancement is shown by the Fact record, not inferred from recency.</p></div><ButtonLink href={`/app/facts/${factKey}`} variant="secondary">Back to Fact <ArrowRight size={14} /></ButtonLink></div><div className="panel"><div className="panel-heading"><h2>{result.data?.page?.total ?? '—'} recorded resolution{result.data?.page?.total === 1 ? '' : 's'}</h2></div><div className="panel-body">{result.loading ? <Skeleton className="skeleton-row" /> : !result.data?.items.length ? <EmptyState title="No resolution history" /> : <div className="timeline">{result.data.items.map((item, index) => { const resolution = asRecord(item.resolution); return <div className="timeline-item" key={asString(resolution.resolution_id, String(index))}><div className="timeline-node" /><div><h3>v{asString(resolution.resolution_version)} · <OutcomeBadge value={resolution.outcome} compact /></h3><p>{asString(resolution.diagnostic_reason, 'No diagnostic')} · {formatDate(resolution.committed_at)}</p><Link className="external-link" href={`/app/resolutions/${asString(resolution.resolution_id)}`}>Open resolution <ArrowRight size={13} /></Link></div></div>; })}</div>}</div></div></>;
}
