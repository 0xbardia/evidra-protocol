import { pageMetadata } from '../../../../../lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ templateId: string; version: string }> }) {
  const { templateId, version } = await params;
  return pageMetadata(`Template ${templateId} v${version}`, 'Inspect this versioned fact template and its bound source policy.', `/app/templates/${encodeURIComponent(templateId)}/${version}`);
}

export default function TemplateDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
