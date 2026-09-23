import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('Protocol activity', 'Review the public indexed record of finalized requests and resolutions.', '/app/activity');

export default function ActivityLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
