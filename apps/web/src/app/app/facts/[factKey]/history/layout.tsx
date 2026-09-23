import { pageMetadata } from '../../../../../lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ factKey: string }> }) {
  const { factKey } = await params;
  return pageMetadata('Resolution history', 'Review committed resolution attempts without inferring canonical state from recency.', `/app/facts/${factKey}/history`);
}

export default function FactHistoryLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
