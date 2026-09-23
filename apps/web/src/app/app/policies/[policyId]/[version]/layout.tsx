import { pageMetadata } from '../../../../../lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ policyId: string; version: string }> }) {
  const { policyId, version } = await params;
  return pageMetadata(`Policy ${policyId} v${version}`, 'Inspect the immutable source requirements attached to this policy version.', `/app/policies/${encodeURIComponent(policyId)}/${version}`);
}

export default function PolicyDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
