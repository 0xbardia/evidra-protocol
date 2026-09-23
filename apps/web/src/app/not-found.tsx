import type { Metadata } from 'next';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { ButtonLink } from '../components/ui';

export const metadata: Metadata = {
  title: 'Page not found — Evidra Protocol',
  description: 'The page you requested could not be found. Browse the public Fact registry or return to Evidra Protocol.',
  alternates: null,
  openGraph: null,
  robots: { index: false, follow: true },
  twitter: null,
};

export default function NotFound() {
  return <div className="page-wrap">
    <SiteHeader />
    <main className="section">
      <div className="narrow hero-copy">
        <span className="eyebrow">404 / Not found</span>
        <h1>This page could not be found.</h1>
        <p>Check the address, or browse the public Fact registry.</p>
        <div className="hero-actions">
          <ButtonLink href="/app/facts" variant="primary">Browse facts</ButtonLink>
          <ButtonLink href="/" variant="secondary">Return home</ButtonLink>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
