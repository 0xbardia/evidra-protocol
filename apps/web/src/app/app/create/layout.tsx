import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('Create a Fact', 'Specify a claim, choose its evidence policy and freshness rule, then review it before wallet approval.', '/app/create');

export default function CreateLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
