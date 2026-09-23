import { NextResponse, type NextRequest } from 'next/server';

const apiBase = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const notFoundHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Fact not found — Evidra Protocol</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f6f2e9;color:#20201d;font:16px/1.6 Arial,Helvetica,sans-serif}main{width:min(680px,100%);padding:clamp(28px,7vw,64px);border:1px solid rgba(32,32,29,.2);background:#fffdf8}a{color:inherit}nav{font-weight:800;letter-spacing:-.04em}p{max-width:48ch;color:#5d5b54}.eyebrow{margin-top:64px;color:#5d5b54;font:700 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}h1{margin:12px 0;font-size:clamp(36px,8vw,56px);line-height:1.02;letter-spacing:-.06em}.button{display:inline-block;margin-top:12px;padding:11px 17px;background:#20201d;color:#fffdf8;text-decoration:none;font-weight:700}</style></head><body><main><nav><a href="/">Evidra Protocol</a></nav><p class="eyebrow">404 / Public Fact</p><h1>Fact not found</h1><p>This Fact is not in the indexed public registry. Check the key or return to the registry to browse available Facts.</p><a class="button" href="/app/facts">Back to the Fact registry</a></main></body></html>`;

function notFound(method: string): Response {
  return new Response(method === 'HEAD' ? null : notFoundHtml, {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export async function middleware(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const factKey = segments[2];
  const childPath = segments.slice(3);
  if (!factKey || (childPath.length && childPath.some((part) => part !== 'history'))) return NextResponse.next();
  if (!/^[a-f0-9]{64}$/i.test(factKey)) return notFound(request.method);

  try {
    const response = await fetch(`${apiBase}/facts/${factKey}?source=cache`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (response.status === 404) return notFound(request.method);
  } catch { /* preserve the API-degraded page when existence cannot be checked */ }

  return NextResponse.next();
}

export const config = { matcher: ['/app/facts/:factKey/:path*'] };
