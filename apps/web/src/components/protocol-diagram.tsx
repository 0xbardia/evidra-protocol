'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight } from './icons';

function Node({ index, label, sub, accent, active, onActivate }: { index: string; label: string; sub: string; accent: string; active?: boolean; onActivate?: () => void }) {
  return <motion.div className={`protocol-node ${active ? 'protocol-node-active' : ''}`} onPointerEnter={onActivate} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 360, damping: 25 }}><span className="node-index" style={{ color: accent }}>{index}</span><strong>{label}</strong><span>{sub}</span></motion.div>;
}

export function ProtocolDiagram({ compact = false }: { compact?: boolean }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (reduced || compact) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % 4), 2400);
    return () => window.clearInterval(timer);
  }, [compact, reduced]);
  const path = { initial: { pathLength: 0, opacity: 0 }, whileInView: { pathLength: 1, opacity: 1 }, viewport: { once: true }, transition: { duration: 1.1, ease: 'easeInOut' as const } };
  return <div className={`protocol-diagram ${compact ? 'protocol-diagram-compact' : ''}`} aria-label="Fact specification flows through evidence and GenLayer consensus to a canonical verdict">
    {!compact && <div className="diagram-readout"><span>Protocol path</span><strong>Stage {String(active + 1).padStart(2, '0')} / 04</strong><small>{['Specify the claim', 'Group evidence', 'Adjudicate the rule', 'Commit the record'][active]}</small></div>}
    <div className="diagram-track">{!compact && <svg className="diagram-lines" viewBox="0 0 700 190" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M102 95H218M290 95H405M477 95H596" {...(reduced ? {} : path)} /><motion.path d="M197 87l12 8-12 8M386 87l12 8-12 8M577 87l12 8-12 8" {...(reduced ? {} : path)} /></svg>}{compact ? <><Node index="01" label="Specify" sub="claim" accent="#e55536" /><ArrowRight /><Node index="02" label="Resolve" sub="evidence" accent="#f0a43c" /><ArrowRight /><Node index="03" label="Record" sub="verdict" accent="#c8d94f" /></> : <><Node index="01" label="Fact specification" sub="what should be known" accent="#e55536" active={active === 0} onActivate={() => setActive(0)} /><ArrowDown className="diagram-mobile-arrow" /><Node index="02" label="Evidence" sub="sources with provenance" accent="#f0a43c" active={active === 1} onActivate={() => setActive(1)} /><ArrowDown className="diagram-mobile-arrow" /><Node index="03" label="GenLayer consensus" sub="independent adjudication" accent="#50624a" active={active === 2} onActivate={() => setActive(2)} /><ArrowDown className="diagram-mobile-arrow" /><Node index="04" label="Canonical verdict" sub="a durable on-chain record" accent="#c8d94f" active={active === 3} onActivate={() => setActive(3)} /></>}</div>
  </div>;
}
