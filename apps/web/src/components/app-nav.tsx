'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Book, Pulse, Search, Plus, Shield, Sliders } from './icons';

const groups = [
  { label: 'Workspace', items: [{ href: '/app', label: 'Overview', icon: Pulse }, { href: '/app/facts', label: 'Fact registry', icon: Search }, { href: '/app/create', label: 'Create fact', icon: Plus }, { href: '/app/activity', label: 'Activity', icon: Pulse }] },
  { label: 'Protocol', items: [{ href: '/app/policies', label: 'Policies', icon: Shield }, { href: '/app/templates', label: 'Templates', icon: Sliders }, { href: '/app/developers', label: 'Developers', icon: Book }] },
];

export function AppNav() {
  const pathname = usePathname();
  return <aside className="app-sidebar" aria-label="Application navigation">{groups.map((group) => <div key={group.label} className="nav-group"><span className="sidebar-label">{group.label}</span>{group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`)) ? 'active' : ''}><Icon size={15} />{label}</Link>)}</div>)}</aside>;
}
