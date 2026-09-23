import type { Metadata } from 'next';
import DevelopersPage from '../app/developers/page';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata('Developers', 'Build with the frozen Evidra deployment, normalized read API, protocol client, and user-approved wallet transactions.', '/developers');

export default function PublicDevelopersPage() {
  return <div className="page-wrap"><SiteHeader /><main className="section-tight"><div className="container"><DevelopersPage /></div></main><SiteFooter /></div>;
}
