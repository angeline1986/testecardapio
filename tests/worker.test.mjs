import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { loadAnalyticsDashboard } from '../src/analytics.js';

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
        if (request.query.includes('AS event_name')) return { data: [
          { event_name: 'menu_view', total: 20 },
          { event_name: 'product_open', total: 18 },
          { event_name: 'official_menu_click', total: 9 },
          { event_name: 'catalog_error', total: 0 },
          { event_name: 'filter_click', total: 17 }
        ] };
        if (request.query.includes('AS category')) return { data: [{ category: 'doces', total: 4 }, { category: 'promocoes', total: 2 }] };
        if (request.query.includes('AS click_source')) return { data: [
          { click_source: 'product_modal', total: 8 },
          { click_source: 'closing_banner', total: 1 }
        ] };
        if (request.query.includes('AS product_id')) return { data: [
          { product_id: '42', product_name: 'Cocada Cremosa (Sem Açúcar & Sem Lactose) - 130ml', total: 2 },
          { product_id: '43', product_name: 'Torta', total: 1 }
        ] };
        return { data: [{ open_source: 'product_card', total: 6 }, { open_source: 'details_button', total: 12 }] };
      } },
      ASSETS: { fetch: () => new Response('asset') }
    }
  };
}

test('records product fields and preserves historical positions', async () => {
  const { env, points } = environment();
  const response = await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'product_open', product_id: 42, product_name: 'Torta', category: 'salgados', price: 19.9, availability: 'available', source: 'product_card' })
  }), env);
  assert.equal(response.status, 204);
  assert.deepEqual(points[0].blobs.slice(0, 3), ['product_open', 'Torta', 'salgados']);
  assert.equal(points[0].blobs[6], '42');
  assert.equal(points[0].blobs[7], 'product_card');
  assert.equal(points[0].doubles[3], 19.9);

  await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'sauce_open', sauces: 12, sauce: 'Legado' })
  }), env);
  assert.equal(points[1].blobs[1], 'Legado');
  assert.equal(points[1].doubles[2], 12);

  await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'official_menu_click', source: 'product_modal', product_id: 42, product_name: 'Torta' })
  }), env);
  assert.equal(points[2].blobs[1], 'Torta');
  assert.equal(points[2].blobs[6], '42');
  assert.equal(points[2].blobs[7], 'product_modal');
});

test('rejects unsupported events', async () => {
  const { env, points } = environment();
  const response = await worker.fetch(new Request(origin + '/api/analytics', {
    method: 'POST', body: JSON.stringify({ event: 'unknown' })
  }), env);
  assert.equal(response.status, 400);
  assert.equal(points.length, 0);
});

test('dashboard shell and data API require a session and return metrics for the selected period', async () => {
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
  assert.match(html, /Performance do Cardápio/);
  assert.match(html, /data-days="30"/);
  assert.match(html, /skeleton-card/);
  assert.match(html, /Nenhuma interação registrada neste período/);
  assert.match(html, /Interação com produtos/);
  assert.match(html, /Cliques no produto/);
  assert.match(html, /Cliques em Detalhes/);
  assert.match(html, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(min-width:768px\).*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(max-width:1023px\)/);
  assert.match(html, /@media\(min-width:1440px\)/);
  assert.match(html, /text-overflow:ellipsis/);
  assert.equal(queries.length, 0);

  const anonymousApi = await worker.fetch(new Request(origin + '/analytics/api/dashboard?dias=30'), env);
  assert.equal(anonymousApi.status, 401);
  assert.equal(queries.length, 0);

  const apiResponse = await worker.fetch(new Request(origin + '/analytics/api/dashboard?dias=30', {
    headers: { Cookie: cookie }
  }), env);
  const data = await apiResponse.json();
  assert.equal(apiResponse.status, 200);
  assert.equal(data.menu_id, 'chef-dani-teles');
  assert.equal(data.menu_name, 'Chef Dani Teles');
  assert.equal(data.period, '30d');
  assert.equal(data.summary.menus_loaded, 20);
  assert.equal(data.summary.products_opened, 18);
  assert.equal(data.summary.product_card_clicks, 6);
  assert.equal(data.summary.details_button_clicks, 12);
  assert.equal(data.summary.official_menu_clicks, 9);
  assert.equal(data.summary.catalog_errors, 0);
  assert.equal(data.summary.engagement_rate, 90);
  assert.equal(data.summary.conversion_rate, 45);
  assert.equal(data.total_events, 64);
  assert.equal(data.top_converted_products[0].name, 'Cocada Cremosa (Sem Açúcar & Sem Lactose) - 130ml');
  assert.equal(data.top_converted_products[0].clicks, 2);
  assert.deepEqual(data.filters_used[0], { category: 'doces', count: 4 });
  assert.deepEqual(data.conversion_origins[0], { origin: 'Detalhes do produto', clicks: 8, percentage: 88.9 });
  assert.deepEqual(data.conversion_origins[1], { origin: 'Banner final', clicks: 1, percentage: 11.1 });
  assert.equal(queries.length, 5);
  assert.ok(queries.every(({ query, params }) => query.includes('timestamp >= $start') && params.start));
  assert.ok(queries.some(({ query }) => query.includes('GROUP BY blob7, blob2')));
  assert.ok(queries.some(({ query }) => query.includes("blob1 = 'official_menu_click' AND blob8 = 'product_modal'")));
});

test('conversion rates return zero when the period has no menu loads', async () => {
  const { env } = environment();
  env.ANALYTICS_SQL.query = async request => {
    if (request.query.includes('AS event_name')) return { data: [
      { event_name: 'product_open', total: 3 },
      { event_name: 'official_menu_click', total: 2 }
    ] };
    return { data: [] };
  };
  const data = await loadAnalyticsDashboard(env, 1);
  assert.equal(data.summary.menus_loaded, 0);
  assert.equal(data.summary.engagement_rate, 0);
  assert.equal(data.summary.conversion_rate, 0);
});

test('dashboard data reports an empty period when no relevant events exist', async () => {
  const { env } = environment();
  env.ANALYTICS_SQL.query = async () => ({ data: [] });
  const data = await loadAnalyticsDashboard(env, 7);
  assert.equal(data.total_events, 0);
  assert.equal(data.summary.menus_loaded, 0);
  assert.deepEqual(data.top_converted_products, []);
  assert.deepEqual(data.filters_used, []);
  assert.deepEqual(data.conversion_origins, []);
});
