import type { Metadata } from 'next';

const brand = 'Evidra Protocol';

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const socialTitle = `${title} — ${brand}`;
  return {
    title: socialTitle,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: brand, title: socialTitle, description, url: path },
    twitter: { card: 'summary', title: socialTitle, description },
  };
}

export function cleanMetadataText(value: string, maxLength = 180): string {
  return value.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
