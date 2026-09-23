import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import { AppNav } from '../../components/app-nav';
import { PendingWriteNotice, WalletButton, WalletNotice, WalletProvider } from '../../components/wallet-context';
import { pageMetadata } from '../../lib/seo';

export const metadata = pageMetadata('Protocol overview', 'Check network read status, recent Facts, and current protocol activity.', '/app');

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WalletProvider><div className="app-layout"><SiteHeader app walletControls={<WalletButton />} walletNotice={<WalletNotice />} /><PendingWriteNotice /><div className="app-nav-shell"><AppNav /><main className="app-content app-main">{children}</main></div><SiteFooter /></div></WalletProvider>;
}
