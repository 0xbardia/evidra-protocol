import { pageMetadata } from '../../../../lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return pageMetadata(`Request ${requestId}`, 'Inspect request execution state, policy binding, and the associated Fact.', `/app/requests/${encodeURIComponent(requestId)}`);
}

export default function RequestLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
