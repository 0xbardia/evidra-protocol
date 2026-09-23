'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Copy, External } from './icons';
import { outcomeLabel, outcomeTone, safeExternalUrl } from '../lib/format';
import { friendlyApiMessage } from '../lib/api';

export function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const motionProps = reduced ? { initial: false as const } : { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.18 }, transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } };
  return <motion.div className={className} {...motionProps}>{children}</motion.div>;
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard permissions are optional; the value remains selectable */ }
  };
  return <button type="button" className="copy-button" aria-label={`${label} ${value}`} onClick={() => void copy()}><span>{copied ? 'Copied' : label}</span>{copied ? <Check size={14} /> : <Copy size={14} />}</button>;
}

export function Hash({ value, label }: { value: string; label?: string }) {
  return <span className="hash-line"><code title={value}>{value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '—'}</code>{value && <CopyButton value={value} label={label ?? 'Copy hash'} />}</span>;
}

export function OutcomeBadge({ value, compact = false }: { value: unknown; compact?: boolean }) {
  const tone = outcomeTone(value);
  return <span className={`outcome-badge outcome-${tone} ${compact ? 'outcome-compact' : ''}`}><span className="outcome-dot" />{outcomeLabel(value)}</span>;
}

export function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'positive' | 'warning' | 'negative' }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safe = safeExternalUrl(href);
  if (!safe) return <span>{children}</span>;
  return <a className="external-link" href={safe} target="_blank" rel="noreferrer noopener">{children}<External size={14} /></a>;
}

export function Skeleton({ className = '' }: { className?: string }) { return <div aria-hidden="true" className={`skeleton ${className}`} />; }

export function EmptyState({ eyebrow = 'Nothing here yet', title, children, action }: { eyebrow?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="eyebrow">{eyebrow}</span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function ErrorState({ title = 'Could not load this view', detail, retry }: { title?: string; detail?: string; retry?: () => void }) {
  return <div className="error-state"><span className="eyebrow">Read unavailable</span><h3>{title}</h3><p>{friendlyApiMessage(detail ? new Error(detail) : undefined)}</p>{retry && <button className="button button-secondary" type="button" onClick={retry}>Try again</button>}</div>;
}

export function ButtonLink({ href, children, variant = 'primary', external = false }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'quiet'; external?: boolean }) {
  return <a className={`button button-${variant}`} href={href} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{children}</a>;
}

export function SectionHeading({ eyebrow, title, children, align = 'left' }: { eyebrow?: string; title: string; children?: React.ReactNode; align?: 'left' | 'center' }) {
  return <div className={`section-heading align-${align}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{children && <p>{children}</p>}</div>;
}
