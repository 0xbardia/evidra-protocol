import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('Source policies', 'Explore versioned source policies that define evidence classes, source counts, and cross-check rules.', '/app/policies');

export default function PoliciesLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
