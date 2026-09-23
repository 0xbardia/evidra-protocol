import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="page-wrap"><SiteHeader /><main className="section-tight"><div className="container">{children}</div></main><SiteFooter /></div>;
}
