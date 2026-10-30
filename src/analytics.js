function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const dashboardDataset = "events.analyticsEngine.cardapio_events";

export async function loadAnalyticsDashboard(env, days) {
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const queries = [
    `SELECT blob1 AS event_name, COUNT(*) AS total FROM ${dashboardDataset} WHERE timestamp >= $start GROUP BY blob1 ORDER BY total DESC LIMIT 30`,
    `SELECT blob4 AS category, COUNT(*) AS total FROM ${dashboardDataset} WHERE timestamp >= $start AND blob1 = 'filter_click' GROUP BY blob4 ORDER BY total DESC LIMIT 20`,
    `SELECT blob8 AS click_source, COUNT(*) AS total FROM ${dashboardDataset} WHERE timestamp >= $start AND blob1 = 'official_menu_click' GROUP BY blob8 ORDER BY total DESC LIMIT 20`,
    `SELECT blob7 AS product_id, blob2 AS product_name, COUNT(*) AS total FROM ${dashboardDataset} WHERE timestamp >= $start AND blob1 = 'official_menu_click' AND blob8 = 'product_modal' AND blob2 != '' GROUP BY blob7, blob2 ORDER BY total DESC LIMIT 20`,
    `SELECT blob8 AS open_source, COUNT(*) AS total FROM ${dashboardDataset} WHERE timestamp >= $start AND blob1 = 'product_open' GROUP BY blob8 ORDER BY total DESC LIMIT 10`,
    `SELECT blob7 AS opened_product_id, blob2 AS opened_product_name, COUNT(*) AS total FROM ${dashboardDataset} WHERE timestamp >= $start AND blob1 = 'product_open' AND blob2 != '' GROUP BY blob7, blob2 ORDER BY total DESC LIMIT 20`
  ];

  const [events, filters, origins, products, productOpenSources, openedProducts] = await Promise.all(
    queries.map(async query => (await env.ANALYTICS_SQL.query({ query, params: { start } })).data || [])
  );

  const totals = Object.fromEntries(events.map(row => [row.event_name, safeNumber(row.total)]));
  const menusLoaded = totals.menu_view || 0;
  const productsOpened = totals.product_open || 0;
  const officialMenuClicks = totals.official_menu_click || 0;
  const catalogErrors = totals.catalog_error || 0;
  const relevantEvents = new Set(["menu_view", "filter_click", "product_open", "product_close", "official_menu_click", "catalog_error"]);
  const totalEvents = events.reduce((sum, row) => sum + (relevantEvents.has(row.event_name) ? safeNumber(row.total) : 0), 0);
  const percent = (amount, denominator) => denominator > 0 ? Math.round((amount / denominator) * 1000) / 10 : 0;
  const totalOriginClicks = origins.reduce((sum, row) => sum + safeNumber(row.total), 0);
  const productOpenCounts = { product_card: 0, details_button: 0 };
  for (const row of productOpenSources) {
    if (row.open_source === "product_card") productOpenCounts.product_card += safeNumber(row.total);
    else if (row.open_source === "details_button" || row.open_source === "") productOpenCounts.details_button += safeNumber(row.total);
  }
  const originLabels = {
    product_modal: "Detalhes do produto",
    closing_banner: "Banner final",
    menu_intro: "Apresentação do cardápio"
  };

  return {
    menu_id: "chef-dani-teles",
    menu_name: "Chef Dani Teles",
    period: days === 1 ? "24h" : `${days}d`,
    total_events: totalEvents,
    summary: {
      menus_loaded: menusLoaded,
      products_opened: productsOpened,
      product_card_clicks: productOpenCounts.product_card,
      details_button_clicks: productOpenCounts.details_button,
      official_menu_clicks: officialMenuClicks,
      catalog_errors: catalogErrors,
      engagement_rate: percent(productsOpened, menusLoaded),
      conversion_rate: percent(officialMenuClicks, menusLoaded)
    },
    top_converted_products: products.map(row => ({
      id: String(row.product_id || row.product_name || ""),
      name: String(row.product_name || "Produto sem nome"),
      clicks: safeNumber(row.total)
    })),
    top_opened_products: openedProducts.map(row => ({
      id: String(row.opened_product_id || row.opened_product_name || ""),
      name: String(row.opened_product_name || "Produto sem nome"),
      clicks: safeNumber(row.total)
    })),
    filters_used: filters.map(row => ({
      category: String(row.category || "todos"),
      count: safeNumber(row.total)
    })),
    conversion_origins: origins.map(row => {
      const clicks = safeNumber(row.total);
      return {
        origin: originLabels[row.click_source] || String(row.click_source || "Origem não informada"),
        clicks,
        percentage: percent(clicks, totalOriginClicks)
      };
    })
  };
}

export function analyticsDashboardPage(days) {
  const period = days === 1 ? "24h" : `${days} dias`;
  return new Response(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#f8fafc">
  <title>Performance do Cardápio · Chef Dani Teles</title>
  <style>
    :root{color-scheme:light;--page:#f8fafc;--surface:#fff;--line:#e2e8f0;--ink:#0f172a;--muted:#64748b;--green:#059669;--green-bg:#ecfdf5;--green-line:#a7f3d0;--red:#dc2626;--red-bg:#fef2f2;--red-line:#fecaca;--blue:#2563eb;--indigo:#4f46e5;--skeleton:#e2e8f0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,a{font:inherit}a{color:inherit}.wrap{width:min(100% - 32px,1152px);margin:0 auto;padding:32px 0 56px}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:24px;border-bottom:1px solid var(--line)}.heading{min-width:0}.status-row{display:flex;align-items:center;flex-wrap:wrap;gap:9px;min-height:26px}.status{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--green-line);border-radius:999px;background:var(--green-bg);color:#047857;font-size:12px;font-weight:700}.status.bad{border-color:var(--red-line);background:var(--red-bg);color:#b91c1c}.status-detail{color:var(--muted);font-size:12px}.status.loading{width:125px;height:24px;border:0}.h1{margin:12px 0 3px;font-size:clamp(23px,3vw,30px);line-height:1.2;letter-spacing:-.03em}.subtitle{margin:0;color:var(--muted);font-size:14px}.logout{flex:0 0 auto;color:var(--muted);text-decoration:none;font-size:13px}.logout:hover{color:var(--ink);text-decoration:underline}.periods{display:flex;gap:4px;margin:22px 0 18px;padding:4px;width:max-content;max-width:100%;border:1px solid var(--line);border-radius:12px;background:white;box-shadow:0 1px 2px #0f172a0a}.period{min-height:36px;padding:7px 15px;border:0;border-radius:8px;background:transparent;color:#475569;font-size:13px;font-weight:650;cursor:pointer}.period:hover{color:var(--ink);background:#f1f5f9}.period[aria-pressed="true"]{background:var(--ink);color:white;box-shadow:0 1px 2px #0f172a1a}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.kpi{min-width:0;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 1px 2px #0f172a08}.kpi-label{display:block;color:var(--muted);font-size:11px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}.kpi-main{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px 10px;margin:9px 0 4px}.kpi-value{min-width:0;font-size:clamp(25px,4vw,32px);font-weight:750;line-height:1.1;letter-spacing:-.04em;overflow-wrap:anywhere}.kpi-value.good{color:var(--green)}.kpi-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:var(--green-bg);color:#047857;font-size:11px;font-weight:700;white-space:normal}.kpi-badge.blue{background:#eff6ff;color:var(--blue)}.kpi-badge.bad{background:var(--red-bg);color:#b91c1c}.kpi-foot{margin:9px 0 0;color:var(--muted);font-size:12px}.dashboard-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);align-items:start;gap:20px;margin-top:20px}.panel-stack{display:grid;gap:20px;min-width:0}.panel{min-width:0;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 1px 2px #0f172a08}.panel-heading{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:7px}.panel h2{margin:0;font-size:15px;line-height:1.35;font-weight:750;letter-spacing:-.01em}.panel-caption{color:var(--muted);font-size:11px}.product-list,.filter-list,.origin-list{margin:0;padding:0;list-style:none}.product-row{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f1f5f9}.product-row:last-child,.filter-row:last-child,.origin-row:last-child{border-bottom:0}.product-info{flex:1;min-width:0}.product-name{overflow:hidden;color:#1e293b;font-size:13px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.progress-track{height:6px;margin-top:9px;overflow:hidden;border-radius:999px;background:#f1f5f9}.progress-fill{height:100%;border-radius:inherit;background:var(--indigo);transition:width .25s ease}.count-badge{flex:0 0 auto;padding:5px 9px;border:1px solid #f1f5f9;border-radius:9px;background:#f8fafc;color:#334155;font-size:12px;font-weight:700;white-space:nowrap}.filter-row,.origin-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f8fafc;color:#475569;font-size:13px}.filter-name{text-transform:capitalize}.filter-count,.origin-count{flex:0 0 auto;color:var(--ink);font-weight:700}.origin-label{min-width:0}.origin-meter{height:5px;margin-top:5px;overflow:hidden;border-radius:999px;background:#f1f5f9}.origin-fill{height:100%;border-radius:inherit;background:#60a5fa}.origin-copy{flex:1;min-width:0}.empty-list{padding:18px 0;color:var(--muted);font-size:13px}.empty-state{display:grid;justify-items:center;gap:8px;min-height:270px;align-content:center;padding:32px 20px;border:1px solid var(--line);border-radius:16px;background:white;text-align:center}.empty-icon{display:grid;width:48px;height:48px;place-items:center;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:25px}.empty-state h2{margin:5px 0 0;font-size:17px}.empty-state p{margin:0;color:var(--muted);font-size:13px}.load-error{padding:20px;border:1px solid var(--red-line);border-radius:14px;background:var(--red-bg);color:#991b1b}.load-error p{margin:0 0 12px}.retry{padding:8px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fff;color:#991b1b;font-weight:700;cursor:pointer}.skeleton{position:relative;overflow:hidden;background:var(--skeleton);animation:pulse 1.6s ease-in-out infinite}.skeleton:after{position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,#ffffff70,transparent);content:"";animation:shine 1.5s infinite}.skeleton-card{height:126px;border-radius:16px}.skeleton-row{height:47px;margin:12px 0;border-radius:8px}.skeleton-title{width:46%;height:17px;border-radius:5px}.skeleton-line{width:75%;height:11px;margin-top:14px;border-radius:5px}.metrics[aria-busy="true"] .kpi{padding:0;border:0;background:transparent;box-shadow:none}.footnote{margin:20px 0 0;color:var(--muted);font-size:12px}.logout:focus-visible,.period:focus-visible,.retry:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}[hidden]{display:none!important}@keyframes pulse{50%{opacity:.58}}@keyframes shine{100%{transform:translateX(100%)}}
    @media(min-width:768px){.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.kpi{padding:18px 16px}}
    @media(max-width:1023px){.dashboard-grid{grid-template-columns:1fr}.side-panels{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){.wrap{width:min(100% - 24px,1152px);padding-top:20px}.topbar{align-items:center;padding-bottom:18px}.h1{font-size:24px}.subtitle{font-size:13px}.logout{font-size:12px}.periods{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:17px 0 14px}.period{padding:7px 8px}.metrics{gap:9px}.kpi{padding:13px 12px;border-radius:13px}.kpi-label{font-size:9px;letter-spacing:.06em}.kpi-main{gap:5px;margin:8px 0 3px}.kpi-value{font-size:25px}.kpi-badge{font-size:10px;padding:3px 6px}.kpi-foot{font-size:11px;line-height:1.35}.dashboard-grid{gap:12px;margin-top:12px}.side-panels{grid-template-columns:1fr}.panel{padding:16px;border-radius:14px}.product-row{gap:8px}.product-name{font-size:12px}.count-badge{padding:5px 7px;font-size:11px}.status-detail{font-size:11px}}
    @media(min-width:1440px){.wrap{padding-top:40px}.kpi{padding:22px}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="topbar">
      <div class="heading">
        <div class="status-row"><span class="status loading skeleton" id="health-status" aria-label="Carregando estado do catálogo"></span><span class="status-detail" id="health-detail">Carregando dados…</span></div>
        <h1 class="h1">Performance do Cardápio</h1>
        <p class="subtitle" id="period-subtitle">Chef Dani Teles · métricas consolidadas dos últimos ${period}</p>
      </div>
      <a class="logout" href="/analytics/logout">Sair</a>
    </header>

    <nav class="periods" aria-label="Selecionar período">
      <button class="period" type="button" data-days="1" aria-pressed="false">24h</button>
      <button class="period" type="button" data-days="7" aria-pressed="false">7 dias</button>
      <button class="period" type="button" data-days="30" aria-pressed="false">30 dias</button>
    </nav>

    <div class="metrics" id="kpi-grid" aria-live="polite" aria-busy="true">
      <div class="skeleton skeleton-card" aria-hidden="true"></div><div class="skeleton skeleton-card" aria-hidden="true"></div>
      <div class="skeleton skeleton-card" aria-hidden="true"></div><div class="skeleton skeleton-card" aria-hidden="true"></div>
    </div>

    <section class="empty-state" id="empty-state" hidden>
      <div class="empty-icon" aria-hidden="true">◌</div>
      <h2>Nenhuma interação registrada neste período.</h2>
      <p>Tente selecionar um intervalo maior de datas.</p>
    </section>

    <section class="load-error" id="load-error" role="alert" hidden>
      <p>Não foi possível carregar as estatísticas. Verifique sua conexão e tente novamente.</p>
      <button class="retry" id="retry-button" type="button">Tentar novamente</button>
    </section>

    <div class="dashboard-grid" id="dashboard-grid">
      <section class="panel">
        <div class="panel-heading"><h2>Produtos com mais detalhes abertos</h2><span class="panel-caption">Toques ou cliques para ver os detalhes</span></div>
        <ul class="product-list" id="opened-product-list" aria-live="polite">
          <li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li>
          <li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li>
        </ul>
      </section>
      <section class="panel">
        <div class="panel-heading"><h2>Produtos mais acessados no InstaDelivery</h2><span class="panel-caption">Cliques em “Ver cardápio oficial” dentro dos detalhes</span></div>
        <p class="panel-note">Este número conta quem saiu do cardápio para abrir o InstaDelivery. Abrir os detalhes do produto, por si só, não entra nesta lista.</p>
        <ul class="product-list" id="product-list" aria-live="polite">
          <li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li>
          <li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li>
        </ul>
      </section>
      <div class="panel-stack side-panels">
        <section class="panel"><h2>Filtros Mais Utilizados</h2><ul class="filter-list" id="filter-list"><li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li></ul></section>
        <section class="panel"><h2>Aberturas dos detalhes</h2><p class="panel-note">Total de vezes que alguém abriu a janela de detalhes. As duas formas abaixo somam esse total.</p><ul class="filter-list" id="product-open-list"><li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li></ul></section>
        <section class="panel"><h2>Origem da Conversão</h2><ul class="origin-list" id="origin-list"><li class="skeleton skeleton-row" aria-hidden="true"></li><li class="skeleton skeleton-row" aria-hidden="true"></li></ul></section>
      </div>
    </div>
    <p class="footnote">Os números mostram interações registradas neste cardápio; cliques no cardápio oficial não confirmam pedidos ou vendas.</p>
  </main>
  <script>
    const initialDays = ${days};
    const kpiGrid = document.querySelector('#kpi-grid');
    const dashboardGrid = document.querySelector('#dashboard-grid');
    const emptyState = document.querySelector('#empty-state');
    const loadError = document.querySelector('#load-error');
    const healthStatus = document.querySelector('#health-status');
    const healthDetail = document.querySelector('#health-detail');
    const periodSubtitle = document.querySelector('#period-subtitle');
    const productList = document.querySelector('#product-list');
    const openedProductList = document.querySelector('#opened-product-list');
    const filterList = document.querySelector('#filter-list');
    const productOpenList = document.querySelector('#product-open-list');
    const originList = document.querySelector('#origin-list');
    let selectedDays = initialDays;
    let activeRequest = 0;

    function formatCount(value) {
      return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
    }

    function formatPercent(value) {
      return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value) || 0) + '%';
    }

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function metricCard(label, value, badge, foot, options) {
      const card = element('section', 'kpi');
      card.append(element('span', 'kpi-label', label));
      const main = element('div', 'kpi-main');
      main.append(element('strong', 'kpi-value' + (options.good ? ' good' : ''), formatCount(value)));
      if (badge) main.append(element('span', 'kpi-badge' + (options.badgeClass ? ' ' + options.badgeClass : ''), badge));
      card.append(main, element('p', 'kpi-foot', foot));
      return card;
    }

    function setLoading() {
      kpiGrid.setAttribute('aria-busy', 'true');
      kpiGrid.hidden = false;
      kpiGrid.replaceChildren(...Array.from({ length: 4 }, () => element('div', 'skeleton skeleton-card')));
      productList.replaceChildren(...Array.from({ length: 4 }, () => element('li', 'skeleton skeleton-row')));
      filterList.replaceChildren(...Array.from({ length: 3 }, () => element('li', 'skeleton skeleton-row')));
      productOpenList.replaceChildren(...Array.from({ length: 2 }, () => element('li', 'skeleton skeleton-row')));
      originList.replaceChildren(...Array.from({ length: 2 }, () => element('li', 'skeleton skeleton-row')));
      dashboardGrid.hidden = false;
      emptyState.hidden = true;
      loadError.hidden = true;
      healthStatus.className = 'status loading skeleton';
      healthStatus.textContent = '';
      healthStatus.setAttribute('aria-label', 'Carregando estado do catálogo');
      healthDetail.textContent = 'Carregando dados…';
    }

    function setPeriodButtons(days) {
      document.querySelectorAll('.period').forEach(button => {
        button.setAttribute('aria-pressed', Number(button.dataset.days) === days ? 'true' : 'false');
      });
      const label = days === 1 ? '24h' : days + ' dias';
      periodSubtitle.textContent = 'Chef Dani Teles · métricas consolidadas dos últimos ' + label;
    }

    function categoryName(value) {
      const labels = { todos: 'Todos', promocoes: 'Promoções', salgados: 'Salgados', doces: 'Doces' };
      const category = String(value || 'todos');
      return labels[category] || category.charAt(0).toLocaleUpperCase('pt-BR') + category.slice(1);
    }

    function renderProducts(products, list = productList, emptyMessage = 'Nenhum clique no link oficial dos produtos neste período.') {
      list.replaceChildren();
      if (!products.length) {
        list.append(element('li', 'empty-list', emptyMessage));
        return;
      }
      const maxClicks = Math.max(0, ...products.map(item => Number(item.clicks) || 0));
      products.forEach(item => {
        const row = element('li', 'product-row');
        const info = element('div', 'product-info');
        const name = element('p', 'product-name', item.name || 'Produto sem nome');
        name.title = item.name || 'Produto sem nome';
        name.setAttribute('aria-label', item.name || 'Produto sem nome');
        const track = element('div', 'progress-track');
        track.setAttribute('aria-hidden', 'true');
        const fill = element('div', 'progress-fill');
        const clicks = Math.max(0, Number(item.clicks) || 0);
        fill.style.width = (maxClicks > 0 ? Math.min(100, clicks / maxClicks * 100) : 0) + '%';
        track.append(fill);
        info.append(name, track);
        row.append(info, element('span', 'count-badge', formatCount(clicks) + (clicks === 1 ? ' clique' : ' cliques')));
        list.append(row);
      });
    }

    function renderFilters(filters) {
      filterList.replaceChildren();
      if (!filters.length) {
        filterList.append(element('li', 'empty-list', 'Nenhum filtro usado neste período.'));
        return;
      }
      filters.forEach(item => {
        const row = element('li', 'filter-row');
        row.append(element('span', 'filter-name', categoryName(item.category)));
        row.append(element('span', 'filter-count', formatCount(item.count) + (Number(item.count) === 1 ? ' uso' : ' usos')));
        filterList.append(row);
      });
    }

    function renderOrigins(origins) {
      originList.replaceChildren();
      if (!origins.length) {
        originList.append(element('li', 'empty-list', 'Nenhum clique de conversão neste período.'));
        return;
      }
      origins.forEach(item => {
        const row = element('li', 'origin-row');
        const copy = element('div', 'origin-copy');
        copy.append(element('span', 'origin-label', item.origin));
        const meter = element('div', 'origin-meter');
        meter.setAttribute('aria-hidden', 'true');
        const fill = element('div', 'origin-fill');
        fill.style.width = Math.max(0, Math.min(100, Number(item.percentage) || 0)) + '%';
        meter.append(fill);
        copy.append(meter);
        row.append(copy, element('span', 'origin-count', formatCount(item.clicks) + ' · ' + formatPercent(item.percentage)));
        originList.append(row);
      });
    }

    function renderProductOpenSources(summary) {
      productOpenList.replaceChildren();
      [
        ['Pelo cartão do produto', summary.product_card_clicks],
        ['Pelo botão “Detalhes”', summary.details_button_clicks]
      ].forEach(([label, count]) => {
        const row = element('li', 'filter-row');
        row.append(element('span', 'filter-name', label));
        row.append(element('span', 'filter-count', formatCount(count)));
        productOpenList.append(row);
      });
    }

    function renderDashboard(data) {
      const summary = data.summary;
      kpiGrid.replaceChildren(
        metricCard('Acessos totais', summary.menus_loaded, '', 'Cardápios carregados', {}),
        metricCard('Aberturas dos detalhes', summary.products_opened, formatPercent(summary.engagement_rate) + ' engaj.', 'Vezes que a janela de um produto foi aberta', {}),
        metricCard('Intenção de compra', summary.official_menu_clicks, formatPercent(summary.conversion_rate) + ' conv.', 'Cliques no cardápio oficial', { badgeClass: 'blue' }),
        metricCard('Saúde do catálogo', summary.catalog_errors, summary.catalog_errors === 0 ? '100% funcional' : summary.catalog_errors + (summary.catalog_errors === 1 ? ' incidente' : ' incidentes'), summary.catalog_errors === 0 ? 'Zero falhas de renderização' : 'Falhas registradas no período', { good: summary.catalog_errors === 0, badgeClass: summary.catalog_errors === 0 ? '' : 'bad' })
      );
      kpiGrid.setAttribute('aria-busy', 'false');
      healthStatus.className = 'status' + (summary.catalog_errors > 0 ? ' bad' : '');
      healthStatus.textContent = summary.catalog_errors > 0 ? '● ' + summary.catalog_errors + (summary.catalog_errors === 1 ? ' incidente' : ' incidentes') : '● Sistema Estável';
      healthStatus.removeAttribute('aria-label');
      healthDetail.textContent = summary.catalog_errors + (summary.catalog_errors === 1 ? ' erro no período' : ' erros no período');
      renderProducts(data.top_converted_products || []);
      renderProducts(data.top_opened_products || [], openedProductList, 'Nenhum detalhe de produto foi aberto neste período.');
      renderFilters(data.filters_used || []);
      renderProductOpenSources(summary);
      renderOrigins(data.conversion_origins || []);
      const hasEvents = Number(data.total_events) > 0;
      dashboardGrid.hidden = !hasEvents;
      kpiGrid.hidden = !hasEvents;
      emptyState.hidden = hasEvents;
      loadError.hidden = true;
    }

    async function loadDashboard(days) {
      const requestNumber = ++activeRequest;
      selectedDays = days;
      setPeriodButtons(days);
      setLoading();
      try {
        const response = await fetch('/analytics/api/dashboard?dias=' + days, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (response.status === 401) {
          if (requestNumber !== activeRequest) return;
          window.location.assign('/analytics');
          return;
        }
        if (!response.ok) throw new Error('Dashboard indisponível');
        const data = await response.json();
        if (requestNumber !== activeRequest) return;
        renderDashboard(data);
      } catch {
        if (requestNumber !== activeRequest) return;
        kpiGrid.hidden = true;
        dashboardGrid.hidden = true;
        emptyState.hidden = true;
        loadError.hidden = false;
        healthStatus.className = 'status bad';
        healthStatus.textContent = '● Dados indisponíveis';
        healthDetail.textContent = 'Não foi possível consultar o período';
      }
    }

    document.querySelectorAll('.period').forEach(button => {
      button.addEventListener('click', () => {
        const days = Number(button.dataset.days);
        if (days === selectedDays) return;
        window.history.pushState({}, '', '/analytics?dias=' + days);
        loadDashboard(days);
      });
    });
    window.addEventListener('popstate', () => {
      const queryDays = Number(new URLSearchParams(window.location.search).get('dias'));
      loadDashboard([1, 7, 30].includes(queryDays) ? queryDays : 7);
    });
    document.querySelector('#retry-button').addEventListener('click', () => loadDashboard(selectedDays));
    loadDashboard(initialDays);
  </script>
</body>
</html>`, { headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
