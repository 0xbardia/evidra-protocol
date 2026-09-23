import { pageMetadata } from '../../../../lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ resolutionId: string }> }) {
  const { resolutionId } = await params;
  return pageMetadata(`Resolution ${resolutionId}`, 'Inspect a committed resolution and its evidence manifest reference.', `/app/resolutions/${encodeURIComponent(resolutionId)}`);
}

export default function ResolutionLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
