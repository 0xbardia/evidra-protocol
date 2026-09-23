'use client';

import Link from 'next/link';
import { useApi, asRecord, asString } from '../lib/api';
import { factStatement, shortHash } from '../lib/format';
import { ArrowRight } from './icons';
import { ButtonLink, EmptyState, OutcomeBadge, Reveal, SectionHeading, StatusPill } from './ui';
import { ProtocolDiagram } from './protocol-diagram';

interface FactListResponse {
  items: Array<{ fact: Record<string, unknown>; current_request?: Record<string, unknown> | null; canonical_resolution?: Record<string, unknown> | null; freshness?: { is_fresh: boolean } }>;
  page: { total: number };
}
interface ProtocolResponse { network: string; chain_id: number; paused: boolean; resolver_enabled: boolean; sync?: Record<string, unknown> }

export function HomeData() {
  const protocol = useApi<ProtocolResponse>('/protocol');
  const facts = useApi<FactListResponse>('/facts?limit=4&sort=recent');
  const factItems = facts.data?.items ?? [];
  const projectionDegraded = asString(protocol.data?.sync?.status) !== 'healthy';

  return <>
    <section className="section band">
      <div className="container">
        <SectionHeading eyebrow="The gap" title="Some facts have no API endpoint" children="A feed can report a number. It cannot, by itself, establish whether a product shipped, a grant cleared a milestone, or a policy changed." />
        <div className="example-grid">
          <Reveal><div className="example-card"><span className="card-index">01 / RELEASE</span><h3>Did the product ship?</h3><p>Define the claim, evidence requirements, and decision rule.</p></div></Reveal>
          <Reveal delay={.05}><div className="example-card"><span className="card-index">02 / GRANT</span><h3>Was the milestone met?</h3><p>Evidence may be real without being independent. Provenance matters.</p></div></Reveal>
          <Reveal delay={.1}><div className="example-card"><span className="card-index">03 / STATUS</span><h3>Is the service operational?</h3><p>A current answer needs a validity period, not a confidence badge.</p></div></Reveal>
          <Reveal delay={.15}><div className="example-card"><span className="card-index">04 / POLICY</span><h3>Did the rule change?</h3><p>Keep the exact source policy and version with the resulting record.</p></div></Reveal>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container lifecycle-grid">
        <div>
          <SectionHeading eyebrow="The protocol" title="From a question to a record" children="Evidra turns a precise fact specification into an inspectable state transition." />
          <div className="lifecycle-list">
            <Reveal><div className="lifecycle-item active"><span>01</span><div><strong>Specify</strong><p>Define the subject, predicate, value, time, and policy.</p></div><i /></div></Reveal>
            <Reveal delay={.05}><div className="lifecycle-item active"><span>02</span><div><strong>Collect</strong><p>Provide bounded HTTPS sources for evidence review.</p></div><i /></div></Reveal>
            <Reveal delay={.1}><div className="lifecycle-item active"><span>03</span><div><strong>Adjudicate</strong><p>GenLayer validators evaluate the rule against the evidence.</p></div><i /></div></Reveal>
            <Reveal delay={.15}><div className="lifecycle-item active"><span>04</span><div><strong>Commit</strong><p>The Registry preserves canonical and latest resolutions separately.</p></div><i /></div></Reveal>
          </div>
        </div>
        <Reveal><div className="hero-visual" style={{ minHeight: 0, marginTop: 18 }}><div className="diagram-label">A bounded protocol path</div><ProtocolDiagram compact /><div className="callout" style={{ marginTop: 22 }}><strong>Canonical is not the same as latest.</strong>An unresolved reassessment can be the newest attempt while a prior verified result remains canonical.</div></div></Reveal>
      </div>
    </section>

    <section className="section band">
      <div className="container">
        <SectionHeading eyebrow="Evidence policy" title="Sources are not votes" children="Evidra records source class, origin, provenance group, independence, and policy eligibility. Three copies of one article remain one lineage." />
        <div className="principles-grid">
          <Reveal><div className="principle"><h3>Classify</h3><p>Official, primary, independent secondary, community, derived, and unknown sources have distinct labels.</p></div></Reveal>
          <Reveal delay={.08}><div className="principle"><h3>Group</h3><p>Provenance groups prevent copied material from inflating independent-source counts.</p></div></Reveal>
          <Reveal delay={.16}><div className="principle"><h3>Fail closed</h3><p>If policy requirements are not met, the result can remain unresolved.</p></div></Reveal>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionHeading eyebrow="Canonical Fact registry" title="Read the record, not the headline" children="Each Fact separates its canonical resolution from the latest attempt and labels whether data came from cache or chain." />
        <div className="registry-preview">
          <div className="preview-table">
            <div className="preview-row header"><span>Proposition</span><span>Outcome</span><span>Freshness</span><span>Version</span></div>
            {facts.loading && [1, 2, 3].map((n) => <div className="preview-row" key={n}><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>)}
            {facts.error && <p className="muted">The indexed registry is temporarily unavailable.</p>}
            {!facts.loading && !facts.error && factItems.map((item) => {
              const fact = asRecord(item.fact);
              const resolution = asRecord(item.canonical_resolution);
              const factKey = asString(fact.fact_key);
              return <Link className="preview-row" href={`/app/facts/${factKey}`} key={factKey}><strong>{factStatement(asRecord(item.current_request), shortHash(asString(fact.claim_key), 7))}</strong><OutcomeBadge value={resolution.outcome ?? fact.current_outcome} compact /><StatusPill tone={item.freshness?.is_fresh ? 'positive' : 'warning'}>{item.freshness?.is_fresh ? 'Fresh' : 'Stale'}</StatusPill><span>v{asString(resolution.resolution_version ?? fact.resolution_version, '—')}</span></Link>;
            })}
            {!facts.loading && !facts.error && !factItems.length && <EmptyState eyebrow="Registry quiet" title="No indexed facts yet" action={<ButtonLink href="/app/create" variant="secondary">Define the first fact <ArrowRight size={15} /></ButtonLink>} />}
          </div>
          <div className="preview-aside">
            <span className="eyebrow">{projectionDegraded ? 'Cached projection' : 'Finalized projection'}</span>
            <h3>{protocol.data?.network ?? 'Studio Dev'}</h3>
            <p>{projectionDegraded ? 'Indexed records remain visible while finalized verification is delayed.' : 'Search the indexed records or verify a Fact against a finalized chain read.'}</p>
            <ul className="signal-list"><li><i />Chain {protocol.data?.chain_id ?? 61997}</li><li><i />Resolver {protocol.data?.resolver_enabled ? 'enabled' : 'status unavailable'}</li><li><i />{facts.data?.page?.total ?? '—'} indexed fact{facts.data?.page?.total === 1 ? '' : 's'}</li></ul>
            <ButtonLink href="/app/facts" variant="secondary">Explore registry <ArrowRight size={15} /></ButtonLink>
          </div>
        </div>
      </div>
    </section>

    <section className="section-tight">
      <div className="container"><div className="developer-callout">
        <div><span className="eyebrow">For builders</span><h2>Give agents a fact they can verify.</h2><p>Read the indexed API, verify finalized state with the shared client, and submit writes from the user&apos;s wallet.</p><ButtonLink href="/developers" variant="secondary">Developer entry point <ArrowRight size={15} /></ButtonLink></div>
        <pre className="code-panel" tabIndex={0}><code><span className="orange">const</span> response = <span className="orange">await</span> fetch(<span className="green">`/api/v1/facts/${'{'}factKey{'}'}`</span>);<br /><span className="orange">const</span> fact = <span className="orange">await</span> response.json();<br /><br /><span className="orange">if</span> (fact.canonical_resolution?.outcome === <span className="red">&apos;TRUE&apos;</span> &amp;&amp; fact.freshness.is_fresh) {'{'}<br />&nbsp;&nbsp;<span className="orange">return</span> fact.canonical_resolution;<br />{'}'}</code></pre>
      </div></div>
    </section>

    <section className="section-tight">
      <div className="container"><div className="network-strip"><div><span>Studio Dev</span><span>Chain {protocol.data?.chain_id ?? 61997}</span><span>Finalized reads {projectionDegraded ? 'delayed' : protocol.data ? 'available' : 'checking'}</span></div><div><Link href="/docs/network">Network details ↗</Link><Link href="/docs">Read the docs <ArrowRight size={13} /></Link></div></div></div>
    </section>
  </>;
}
