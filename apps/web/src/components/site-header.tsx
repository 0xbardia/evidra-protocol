'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu, X } from './icons';

const links = [{ href: '/app/facts', label: 'Explore facts' }, { href: '/docs', label: 'Docs' }, { href: '/developers', label: 'Developers' }];

export function SiteHeader({ app = false, walletControls, walletNotice }: { app?: boolean; walletControls?: ReactNode; walletNotice?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className={`site-header ${app ? 'site-header-app' : ''}`}>
      <Link href="/" className="brand" aria-label="Evidra Protocol home"><span className="brand-mark" /><span>Evidra <em>Protocol</em></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}<Link href="/app/create" className="nav-create">Create a fact <span>↗</span></Link></nav>
      <div className="header-actions">{walletControls}<button className="menu-button" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
      {open && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}<Link href="/app/create" onClick={() => setOpen(false)}>Create a fact <span>↗</span></Link></nav>}
    </header>
    {walletNotice}
  </>;
}
