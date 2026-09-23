import { notFound } from 'next/navigation';
import { DOC_TOPICS } from '../topics';
import DocsClient from './docs-client';
import { pageMetadata } from '../../../lib/seo';

const topicDescriptions: Record<string, string> = {
  overview: 'How a fact specification becomes a policy-bound, consensus-backed protocol record.',
  quickstart: 'Connect to Studio Dev, read a Fact, and understand the user-approved write flow.',
  concepts: 'Definitions for Fact identity, canonical resolution, latest attempt, policy, and freshness.',
  'fact-specification': 'The fields that define a semantic claim and its stable protocol identity.',
  'source-policies': 'How evidence classes, provenance counts, and cross-check requirements are versioned.',
  templates: 'How versioned templates bind fact types and their default source policies.',
  'evidence-provenance': 'How source metadata, provenance groups, and policy eligibility are represented.',
  freshness: 'How immutable records and TTL-bound Facts determine whether a result is current.',
  reassessment: 'How new evidence creates an attempt while preserving the existing resolution history.',
  callbacks: 'How callback delivery status differs from the canonical protocol result.',
  'transaction-lifecycle': 'How wallet approval, consensus, finalization, and indexed reads differ.',
  network: 'The frozen GenLayer Studio Dev network and chain configuration.',
  contracts: 'The authoritative contract addresses for the frozen V1 deployment.',
  api: 'Read routes, filters, pagination, and canonical/latest response semantics.',
  'developer-integration': 'Integration guidance for the API and shared protocol client.',
  'security-model': 'Trust boundaries for evidence URLs, wallets, chain reads, and cached data.',
  troubleshooting: 'How to interpret delayed indexing, unresolved attempts, stale Facts, and wallet issues.',
};

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: parts = [] } = await params;
  const slug = parts.join('/') || 'overview';
  const topic = DOC_TOPICS.find(([key]) => key === slug);
  if (!topic) return pageMetadata('Not found', 'This documentation topic does not exist.', '/docs');
  const path = slug === 'overview' ? '/docs' : `/docs/${slug}`;
  const title = slug === 'overview' ? 'Protocol documentation' : topic[1];
  return pageMetadata(title, topicDescriptions[slug] ?? `Documentation for ${topic[1]} in Evidra Protocol.`, path);
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const current = slug.join('/') || 'overview';
  if (!DOC_TOPICS.some(([key]) => key === current)) notFound();
  return <DocsClient slug={slug} />;
}
