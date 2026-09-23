import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('Fact templates', 'Explore versioned fact types and the exact source policy bound to each template.', '/app/templates');

export default function TemplatesLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
