'use client';

import { useApi, asString, type ApiPage } from '../../../lib/api';
import { activityDetail, activityLabel, formatDate } from '../../../lib/format';
import { EmptyState, ErrorState, SectionHeading, Skeleton } from '../../../components/ui';

interface ActivityItem { activity_type?: string; activity_id?: string; occurred_at?: string | number; status?: string | null; outcome?: string | null }
type ActivityResponse = ApiPage<ActivityItem>;

export default function ActivityPage() {
  const result = useApi<ActivityResponse>('/activity?limit=50&offset=0');
  return <>
    <div className="app-header"><div><span className="eyebrow">Protocol activity</span><h1>Activity</h1><p>A periodically updated record of finalized requests and resolutions.</p></div></div>
    <SectionHeading eyebrow="Finalized projection" title="What changed" />
    {result.error ? <ErrorState title="Activity is temporarily unavailable" detail={result.error.message} /> : <div className="panel"><div className="panel-body">
      {result.loading ? <Skeleton className="skeleton-row" /> : !result.data?.items.length ? <EmptyState title="No activity indexed" /> : <div className="timeline">{result.data.items.map((item, index) => <div className="timeline-item" key={`${asString(item.activity_type)}-${asString(item.activity_id)}-${index}`}><div className="timeline-node" /><div><h3>{activityLabel(item.activity_type)}</h3><p>{activityDetail(item)} · {formatDate(item.occurred_at)}</p></div></div>)}</div>}
    </div></div>}
  </>;
}
