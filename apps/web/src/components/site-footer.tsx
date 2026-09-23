import Link from 'next/link';
import { CONTRACT_ADDRESSES, FROZEN_NETWORK, explorerAddressUrl } from '../lib/config';

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-top"><div><Link href="/" className="brand"><span className="brand-mark" /><span>Evidra <em>Protocol</em></span></Link><p>Consensus for facts that APIs can&apos;t answer.</p></div><div className="footer-links"><div><span className="footer-label">Explore</span><Link href="/app/facts">Fact registry</Link><Link href="/app/create">Create a fact</Link><Link href="/app/activity">Activity</Link></div><div><span className="footer-label">Learn</span><Link href="/docs">Documentation</Link><Link href="/app/developers">Developers</Link><Link href="/docs/security-model">Security model</Link></div></div></div><div className="footer-bottom"><span>Studio Dev · Chain {FROZEN_NETWORK.chainId}</span><div><a href={explorerAddressUrl(CONTRACT_ADDRESSES.registry)} target="_blank" rel="noreferrer noopener">Registry ↗</a><span>© {new Date().getFullYear()} Evidra Protocol</span></div></div></footer>;
}
