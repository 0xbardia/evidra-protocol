import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Evidra Protocol — Consensus for facts that APIs can’t answer',
  description: 'Turn real-world fact specifications into canonical on-chain verdicts using GenLayer consensus.',
  metadataBase: new URL('https://evidra-protocol.bydx.fun'),
  applicationName: 'Evidra Protocol',
  alternates: { canonical: '/' },
  icons: { icon: '/icon.svg' },
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Evidra Protocol',
    title: 'Evidra Protocol — Consensus for facts that APIs can’t answer',
    description: 'Turn real-world fact specifications into canonical on-chain verdicts using GenLayer consensus.',
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'Evidra Protocol — Consensus for facts that APIs can’t answer',
    description: 'Turn real-world fact specifications into canonical on-chain verdicts using GenLayer consensus.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
