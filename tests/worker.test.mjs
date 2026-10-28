import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const origin = 'https://cardapio.chefdaniteles.workers.dev';
function environment() {
  const points = [];
  const queries = [];
  return {
    points,
    queries,
    env: {
      ADMIN_PASSWORD: 'local-test-password',
      SESSION_SECRET: 'local-test-session-secret',
      ANALYTICS: { writeDataPoint: point => points.push(point) },
      ANALYTICS_SQL: { query: async request => {
        queries.push(request);
        if (request.query.includes('AS event_name')) return { data: [{ event_name: 'product_open', total: 3 }] };
        if (request.query.includes('AS product')) return { data: [{ product: '<script>alert(1)</script>', total: 2 }] };
        if (request.query.includes('AS category_filter')) return { data: [{ category_filter: 'doces', total: 1 }] };
        return { data: [{ click_source: 'product_modal', total: 1 }] };
      } },
      ASSETS: { fetch: () => new Response('asset') }
    }
  };
}

test('records product fields and preserves historical positions', async () => {
  const { env, points } = environment();
  const response = await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'product_open', product_id: 42, product_name: 'Torta', category: 'salgados', price: 19.9, availability: 'available' })
  }), env);
  assert.equal(response.status, 204);
  assert.deepEqual(points[0].blobs.slice(0, 3), ['product_open', 'Torta', 'salgados']);
  assert.equal(points[0].blobs[6], '42');
  assert.equal(points[0].doubles[3], 19.9);

  await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'sauce_open', sauces: 12, sauce: 'Legado' })
  }), env);
  assert.equal(points[1].blobs[1], 'Legado');
  assert.equal(points[1].doubles[2], 12);
});

test('rejects unsupported events', async () => {
  const { env, points } = environment();
  const response = await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', body: JSON.stringify({ event: 'unknown' })
  }), env);
  assert.equal(response.status, 400);
  assert.equal(points.length, 0);
});

test('dashboard requires a session, queries a bounded period, and escapes product names', async () => {
  const { env, queries } = environment();
  const anonymous = await worker.fetch(new Request(origin + '/analytics'), env);
  assert.match(await anonymous.text(), /Senha administrativa/);
  assert.equal(queries.length, 0);

  const login = await worker.fetch(new Request(origin + '/analytics/login', {
    method: 'POST', body: new URLSearchParams({ password: env.ADMIN_PASSWORD })
  }), env);
  assert.equal(login.status, 303);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  const dashboard = await worker.fetch(new Request(origin + '/analytics?dias=30', {
    headers: { Cookie: cookie }
  }), env);
  const html = await dashboard.text();
  assert.equal(dashboard.status, 200);
  assert.match(html, /últimos 30 dias/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.equal(queries.length, 4);
  assert.ok(queries.every(({ query, params }) => query.includes('timestamp >= $start') && params.start));
});
