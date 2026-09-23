import { factStatement, outcomeLabel } from '../../../../lib/format';
import { cleanMetadataText, pageMetadata } from '../../../../lib/seo';
import { notFound } from 'next/navigation';

const apiBase = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');

export async function generateMetadata({ params }: { params: Promise<{ factKey: string }> }) {
  const { factKey } = await params;
  if (!/^[a-f0-9]{64}$/i.test(factKey)) notFound();
  const fallback = `Fact ${factKey.slice(0, 10)}`;
  let title = fallback;
  let description = 'Inspect the Fact specification, canonical resolution, latest attempt, evidence provenance, and freshness in Evidra Protocol.';
  let missing = false;
  try {
    const response = await fetch(`${apiBase}/facts/${factKey}?source=cache`, { signal: AbortSignal.timeout(2000), next: { revalidate: 300 } });
    if (response.status === 404) missing = true;
    else if (response.ok) {
      const data = await response.json() as Record<string, unknown>;
      const request = data.current_request && typeof data.current_request === 'object'
        ? data.current_request as Record<string, unknown>
        : {};
      const statement = cleanMetadataText(factStatement(request, fallback), 96);
      title = `Fact: ${statement}`;
      const canonical = data.canonical_resolution && typeof data.canonical_resolution === 'object'
        ? data.canonical_resolution as Record<string, unknown>
        : {};
      const outcome = canonical.outcome ? ` Canonical outcome: ${outcomeLabel(canonical.outcome)}.` : '';
      description = cleanMetadataText(`${statement}.${outcome} Public record with source policy, evidence provenance, and freshness.`, 180);
    }
  } catch { /* hashed fallback metadata keeps the page shareable during API outages */ }
  if (missing) notFound();
  return pageMetadata(title, description, `/app/facts/${encodeURIComponent(factKey)}`);
}

export default function FactLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
