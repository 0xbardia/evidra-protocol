'use client';

import Link from 'next/link';
import { use } from 'react';
import { useApi, asBigInt, asBoolean, asRecord, asString, type FactEnvelope } from '../../../../lib/api';
import { factStatement, formatDate, formatTtl, safeExternalUrl, shortHash } from '../../../../lib/format';
import { ArrowRight, External } from '../../../../components/icons';
import { ButtonLink, EmptyState, ErrorState, Hash, OutcomeBadge, Skeleton, StatusPill } from '../../../../components/ui';
import { FactActions } from '../../../../components/fact-actions';

interface EvidenceResponse { items: Array<Record<string, unknown>>; informational?: boolean }

export default function FactDetailPage({ params }: { params: Promise<{ factKey: string }> }) {
  const { factKey } = use(params);
  const detail = useApi<FactEnvelope>(`/facts/${factKey}?source=cache`);
  const fact = asRecord(detail.data?.fact);
  const request = asRecord(detail.data?.current_request);
  const canonical = detail.data?.canonical_resolution ? asRecord(detail.data.canonical_resolution) : null;
  const latest = detail.data?.latest_resolution ? asRecord(detail.data.latest_resolution) : null;
  const evidenceId = asString((latest ?? canonical)?.resolution_id);
  const evidence = useApi<EvidenceResponse>(evidenceId ? `/resolutions/${evidenceId}/evidence` : null);
  const statement = factStatement(request, `Fact ${shortHash(factKey, 9)}`);

  if (detail.error || detail.loading) return <>
    <div className="detail-hero">
      <span className="eyebrow">Public Fact / {shortHash(factKey, 9)}</span>
      <h1>{statement}</h1>
      {detail.error ? <ErrorState title="Fact unavailable" detail={detail.error.message} /> : <><p>Loading the indexed Fact record.</p><Skeleton className="skeleton" /></>}
    </div>
    {detail.loading && <div className="panel" style={{ marginTop: 18 }}><Skeleton className="skeleton-row" /></div>}
  </>;
  if (!detail.data || !fact.exists) return <EmptyState eyebrow="Not found" title="This Fact is not indexed" action={<ButtonLink href="/app/facts" variant="secondary">Back to registry</ButtonLink>} />;

  const outcome = canonical?.outcome ?? fact.current_outcome;
  const latestDiffers = Boolean(latest && asString(latest.resolution_id) !== asString(fact.current_resolution_id));
  const requestId = asString(fact.current_request_id);
  const expiry = asBigInt(fact.valid_until);
  const ttl = request.ttl_seconds ?? (expiry > 0n ? expiry - asBigInt(fact.resolved_at) : 0n);

  return <>
    <div className="detail-hero">
      <span className="eyebrow">Public Fact / {shortHash(factKey, 9)}</span>
      <h1>{statement}</h1>
      {asString(request.description) && <p>{asString(request.description)}</p>}
      <p>The canonical outcome is shown first. A newer attempt does not replace it unless the Registry advances the canonical head.</p>
      <div className="detail-meta">
        <OutcomeBadge value={outcome} />
        <StatusPill tone={detail.data.freshness.is_fresh ? 'positive' : 'warning'}>{detail.data.freshness.is_fresh ? 'Fresh canonical state' : 'Stale canonical state'}</StatusPill>
        <StatusPill>{asString(fact.mutability, 'Mutability unknown') === 'IMMUTABLE' ? 'Immutable' : 'Mutable with TTL'}</StatusPill>
      </div>
    </div>

    <div className="detail-grid" style={{ marginTop: 18 }}>
      <div>
        <div className="resolution-split">
          <ResolutionCard label="Canonical resolution" resolution={canonical} accent="canonical" />
          <ResolutionCard label="Latest attempt" resolution={latest} accent="latest" />
        </div>
        {latestDiffers && <div className="callout" style={{ marginTop: 13 }}><strong>Latest is not canonical.</strong>The newest resolution attempt has not replaced the canonical head. Its outcome is an attempt state; the canonical result remains the Registry's current value.</div>}

        <div className="panel" style={{ marginTop: 18 }}>
          <div className="panel-heading"><h2>Fact specification</h2><StatusPill>{asString(fact.schema_version, 'Schema 1')}</StatusPill></div>
          <div className="panel-body"><dl className="key-list">
            <div><dt>Subject</dt><dd>{asString(request.subject, 'Not indexed')}</dd></div>
            <div><dt>Predicate</dt><dd>{asString(request.predicate, 'Not indexed')}</dd></div>
            {asString(request.object_value) && <div><dt>Object / value</dt><dd>{asString(request.object_value)}</dd></div>}
            {asString(request.qualifiers) && <div><dt>Qualifiers</dt><dd>{asString(request.qualifiers)}</dd></div>}
            {asString(request.temporal) && <div><dt>Time scope</dt><dd>{asString(request.temporal)}</dd></div>}
            <div><dt>Source policy</dt><dd>{asString(request.policy_id, 'Policy')} / v{asString(request.policy_version, '—')}</dd></div>
            {asString(request.template_id) && <div><dt>Template</dt><dd>{asString(request.template_id)} / v{asString(request.template_version, '—')}</dd></div>}
            <div><dt>Fact key</dt><dd><Hash value={factKey} /></dd></div>
            <div><dt>Claim key</dt><dd><Hash value={asString(fact.claim_key)} /></dd></div>
            <div><dt>Policy hash</dt><dd><Hash value={asString(fact.policy_hash)} /></dd></div>
            <div><dt>Template hash</dt><dd><Hash value={asString(fact.template_hash)} /></dd></div>
          </dl></div>
        </div>

        <div className="panel" style={{ marginTop: 18 }}>
          <div className="panel-heading"><h2>Resolution history</h2><Link className="external-link" href={`/app/facts/${factKey}/history`}>Open history <ArrowRight size={14} /></Link></div>
          <div className="panel-body">{detail.data.history?.items?.length ? <div className="timeline">{detail.data.history.items.map((item, index) => {
            const resolution = asRecord(item.resolution);
            return <div className="timeline-item" key={asString(resolution.resolution_id, String(index))}><div className="timeline-node" /><div><h3>Resolution v{asString(resolution.resolution_version, '—')} · <OutcomeBadge value={resolution.outcome} compact /></h3><p>{asString(resolution.diagnostic_reason, 'No diagnostic')} · committed {formatDate(resolution.committed_at)}</p></div></div>;
          })}</div> : <EmptyState eyebrow="No history indexed" title="No resolution history is available" />}</div>
        </div>
      </div>

      <aside className="detail-aside">
        <div className="panel"><div className="panel-heading"><h2>Freshness</h2></div><div className="panel-body"><dl className="key-list">
          <div><dt>Resolved at</dt><dd>{formatDate(fact.resolved_at)}</dd></div>
          <div><dt>Valid until</dt><dd>{expiry === 0n ? 'No expiry' : formatDate(expiry)}</dd></div>
          <div><dt>Validity period</dt><dd>{formatTtl(ttl)}</dd></div>
          <div><dt>Projection</dt><dd>{detail.data.projection.source === 'chain' ? 'Direct chain read' : `Cached · indexed ${formatDate(detail.data.projection.synced_at)}`}{detail.data.projection.stale ? ' · older than five minutes' : ''}</dd></div>
        </dl></div></div>

        <div className="panel"><div className="panel-heading"><h2>Evidence manifest</h2><StatusPill>Informational metadata</StatusPill></div><div className="panel-body">
          {evidence.loading ? <Skeleton className="skeleton-row" /> : evidence.error ? <p className="muted">Evidence index unavailable. The manifest hash remains on-chain.</p> : evidence.data?.items?.length ? <div className="evidence-grid">{evidence.data.items.map((entry, index) => <EvidenceItem entry={entry} key={`${asString(entry.url)}-${index}`} />)}</div> : <EmptyState title="No evidence entries indexed" />}
        </div></div>
        {requestId && Object.keys(request).length > 0 && <FactActions factKey={factKey} requestId={requestId} req={request} />}
      </aside>
    </div>
  </>;
}

function ResolutionCard({ label, resolution, accent }: { label: string; resolution: Record<string, unknown> | null; accent: 'canonical' | 'latest' }) {
  if (!resolution) return <div className={`resolution-card ${accent}`}><span className="eyebrow">{label}</span><h2>No resolution</h2><p>The record does not currently expose a committed resolution.</p></div>;
  return <div className={`resolution-card ${accent}`}><span className="eyebrow">{label}</span><div className="big-outcome"><OutcomeBadge value={resolution.outcome} /></div><p>{asString(resolution.diagnostic_reason, 'No diagnostic')} · policy {asBoolean(resolution.policy_satisfied) ? 'satisfied' : 'not satisfied'}</p><dl><dt>Resolution ID</dt><dd className="mono">{asString(resolution.resolution_id)}</dd><dt>Version</dt><dd>v{asString(resolution.resolution_version)} · supersedes {asString(resolution.supersedes_resolution_id, '0')}</dd><dt>Committed</dt><dd>{formatDate(resolution.committed_at)}</dd><dt>Evidence manifest</dt><dd><Hash value={asString(resolution.evidence_manifest_hash)} /></dd></dl></div>;
}

function EvidenceItem({ entry }: { entry: Record<string, unknown> }) {
  const url = asString(entry.url);
  const safeUrl = safeExternalUrl(url);
  let host = '';
  try { if (safeUrl) host = new URL(safeUrl).hostname; } catch { host = asString(entry.origin); }
  return <div className="evidence-card"><div className="evidence-top"><div>{safeUrl ? <a className="evidence-url" href={safeUrl} target="_blank" rel="noreferrer noopener">{url} <External size={12} /></a> : <span className="evidence-url">{url || 'Invalid evidence URL'}</span>}<p className="evidence-host">{host || 'Untrusted URL'} · {asString(entry.origin, 'unknown origin')}</p></div><StatusPill tone={asBoolean(entry.policy_eligible) ? 'positive' : 'warning'}>{asString(entry.status, 'Unknown')}</StatusPill></div><div className="evidence-tags"><span>{asString(entry.source_class, 'UNKNOWN')}</span><span>{asBoolean(entry.is_primary) ? 'Primary' : 'Secondary'}</span><span>{asBoolean(entry.is_independent) ? 'Independent' : 'Not independent'}</span><span>Group {asString(entry.provenance_group, '—')}</span></div></div>;
}
