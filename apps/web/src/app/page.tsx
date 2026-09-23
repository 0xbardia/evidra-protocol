import Link from 'next/link';
import { ArrowRight, Book, External } from '../components/icons';
import { ButtonLink, Reveal } from '../components/ui';
import { ProtocolDiagram } from '../components/protocol-diagram';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { HomeData } from '../components/home-data';
import { FROZEN_NETWORK, explorerContractUrl, CONTRACT_ADDRESSES } from '../lib/config';

export default function HomePage() {
  return <div className="page-wrap"><SiteHeader /><main><section className="hero"><div className="container hero-grid"><div className="hero-copy"><span className="eyebrow">Evidra Protocol / Studio Dev</span><h1>Consensus for facts that <span>APIs can&apos;t answer.</span></h1><p>Turn a real-world fact specification into a canonical, inspectable on-chain verdict — with evidence policy, provenance, freshness, and history attached.</p><div className="hero-actions"><ButtonLink href="/app" variant="primary">Open app <ArrowRight size={16} /></ButtonLink><ButtonLink href="/docs" variant="secondary"><Book size={16} /> Read docs</ButtonLink><ButtonLink href="/app/facts" variant="quiet">Explore facts <External size={15} /></ButtonLink></div><div className="hero-meta"><span><i />Network: {FROZEN_NETWORK.name}</span><span>Chain: {FROZEN_NETWORK.chainId}</span></div><div className="hero-proof" aria-label="Protocol differentiators"><div><span>01</span><strong>Rules first</strong><small>Policy-bound evidence</small></div><div><span>02</span><strong>History intact</strong><small>Canonical ≠ latest</small></div><div><span>03</span><strong>Onchain record</strong><small>Inspectable outcome</small></div></div></div><Reveal><div className="hero-visual"><div className="diagram-label">A fact becomes durable when its path is inspectable</div><ProtocolDiagram /><div className="network-strip" style={{ marginTop: 27 }}><div><span>registry</span><span>resolver</span><span>evidence</span></div><Link href={explorerContractUrl(CONTRACT_ADDRESSES.registry)} target="_blank" rel="noreferrer noopener">View contract <External size={13} /></Link></div></div></Reveal></div></section><HomeData /></main><SiteFooter /></div>;
}
