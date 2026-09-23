import type { MetadataRoute } from 'next';

const base = 'https://evidra-protocol.bydx.fun';
export const dynamic = 'force-dynamic';
const publicPaths = [
  '/', '/app', '/app/facts', '/app/create', '/app/policies', '/app/templates', '/app/activity',
  '/developers', '/docs', '/docs/quickstart', '/docs/concepts', '/docs/fact-specification',
  '/docs/source-policies', '/docs/templates', '/docs/evidence-provenance', '/docs/freshness',
  '/docs/reassessment', '/docs/callbacks', '/docs/transaction-lifecycle', '/docs/network',
  '/docs/contracts', '/docs/api', '/docs/developer-integration', '/docs/security-model', '/docs/troubleshooting',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = publicPaths.map((path) => ({ url: `${base}${path}` }));
  const apiBase = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
  try {
    const response = await fetch(`${apiBase}/facts?limit=50&offset=0&sort=recent`, { signal: AbortSignal.timeout(2000), next: { revalidate: 300 } });
    if (response.ok) {
      const body = await response.json() as { items?: Array<{ fact?: { fact_key?: string } }> };
      for (const item of body.items ?? []) {
        const key = item.fact?.fact_key;
        if (typeof key === 'string' && /^[a-f0-9]{64}$/i.test(key)) entries.push({ url: `${base}/app/facts/${key}` });
      }
    }
  } catch { /* static pages remain crawlable when the projection API is unavailable */ }
  return entries;
}
