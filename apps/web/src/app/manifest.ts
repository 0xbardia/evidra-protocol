import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Evidra Protocol',
    short_name: 'Evidra',
    description: 'Inspect policy-bound, consensus-backed fact records.',
    start_url: '/app',
    scope: '/',
    display: 'browser',
    background_color: '#f6f2e9',
    theme_color: '#f6f2e9',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
