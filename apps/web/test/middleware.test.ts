import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

const validFactKey = 'a'.repeat(64);

test('malformed Fact keys receive a noindex HTTP 404 without an API request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not fetch malformed keys'); };
  try {
    const response = await middleware(new NextRequest('https://evidra-protocol.bydx.fun/app/facts/not-a-key'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.match(await response.text(), /Fact not found/);
  } finally { globalThis.fetch = originalFetch; }
});

test('missing indexed Facts receive an HTTP 404; degraded API reads continue to the app', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 404 });
    const missing = await middleware(new NextRequest(`https://evidra-protocol.bydx.fun/app/facts/${validFactKey}`));
    assert.equal(missing.status, 404);

    globalThis.fetch = async () => new Response(null, { status: 503 });
    const degraded = await middleware(new NextRequest(`https://evidra-protocol.bydx.fun/app/facts/${validFactKey}`));
    assert.equal(degraded.headers.get('x-middleware-next'), '1');
  } finally { globalThis.fetch = originalFetch; }
});
