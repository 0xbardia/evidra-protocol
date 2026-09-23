import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
}

export const ArrowUpRight = (props: IconProps) => <Icon {...props}><path d="M7 17 17 7M8 7h9v9" /></Icon>;
export const ArrowRight = (props: IconProps) => <Icon {...props}><path d="M4 12h15M13 6l6 6-6 6" /></Icon>;
export const ArrowLeft = (props: IconProps) => <Icon {...props}><path d="M20 12H5M11 6l-6 6 6 6" /></Icon>;
export const ArrowDown = (props: IconProps) => <Icon {...props}><path d="M12 4v15M6 13l6 6 6-6" /></Icon>;
export const Check = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>;
export const Copy = (props: IconProps) => <Icon {...props}><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></Icon>;
export const External = (props: IconProps) => <Icon {...props}><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 13v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5H10" /></Icon>;
export const Menu = (props: IconProps) => <Icon {...props}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const X = (props: IconProps) => <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
export const Search = (props: IconProps) => <Icon {...props}><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></Icon>;
export const ChevronDown = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
export const ChevronLeft = (props: IconProps) => <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>;
export const ChevronRight = (props: IconProps) => <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>;
export const Refresh = (props: IconProps) => <Icon {...props}><path d="M20 11a8 8 0 0 0-14.7-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14m0 5v-5h-5" /></Icon>;
export const Shield = (props: IconProps) => <Icon {...props}><path d="M12 3 19 6v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></Icon>;
export const Sliders = (props: IconProps) => <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" /></Icon>;
export const Book = (props: IconProps) => <Icon {...props}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></Icon>;
export const Wallet = (props: IconProps) => <Icon {...props}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 8h14a2 2 0 0 1 2 2v2h-5a2 2 0 0 0 0 4h5" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></Icon>;
export const Pulse = (props: IconProps) => <Icon {...props}><path d="M3 12h4l2.2-6 5.2 12 2.2-6H21" /></Icon>;
export const Plus = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
export const Filter = (props: IconProps) => <Icon {...props}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>;
export const CircleInfo = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7.5v.1" /></Icon>;
