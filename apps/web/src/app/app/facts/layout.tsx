import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('Fact registry', 'Search public Fact propositions by outcome, freshness, policy, template, or mutability.', '/app/facts');

export default function FactsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
