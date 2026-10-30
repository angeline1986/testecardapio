const encoder = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode64url(value) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  const p = s + "=".repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(p), c => c.charCodeAt(0));
}
async function sessionKey(secret, usage) {
  return crypto.subtle.importKey("raw", encoder.encode(secret),
    {name:"HMAC",hash:"SHA-256"}, false, usage);
}
async function createSession(secret) {
  const body = b64url(encoder.encode(JSON.stringify({exp: Date.now()+28800000})));
  const key = await sessionKey(secret, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return body+"."+b64url(new Uint8Array(sig));
}
async function validSession(token, secret) {
  if (!token || !secret) return false;
  const [body,sig,...extra] = token.split(".");
  if (!body || !sig || extra.length) return false;
  try {
    const key = await sessionKey(secret, ["verify"]);
    if (!await crypto.subtle.verify("HMAC",key,decode64url(sig),encoder.encode(body))) return false;
    const data = JSON.parse(new TextDecoder().decode(decode64url(body)));
    return Number(data.exp)>Date.now();
  } catch { return false; }
}
function cookie(req,name) {
  for (const part of (req.headers.get("Cookie")||"").split(";")) {
    const [k,...v]=part.trim().split("=");
    if(k===name) return v.join("=");
  }
  return "";
}
function safeText(value, max = 200) {
  return String(value ?? "").slice(0, max);
}
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);
}
const eventLabels = {
  menu_view: "Cardápios carregados",
  filter_click: "Filtros usados",
  product_open: "Produtos abertos",
  product_close: "Detalhes fechados",
  official_menu_click: "Cliques no cardápio oficial",
  catalog_error: "Erros ao carregar produtos",
  sauce_open: "Molhos abertos (histórico)",
  sauce_close: "Molhos fechados (histórico)"
};
function table(headers, rows) {
  if (!rows.length) return '<p class="empty">Ainda não há eventos neste período.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function loginPage(error="") {
  const msg=error?`<div class="error">${error}</div>`:"";
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analytics · Login</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ed;color:#292621;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px}.box{width:min(390px,100%);background:#fff;border:1px solid #e4dfd6;border-radius:16px;padding:30px;box-shadow:0 12px 35px #2d251a14}h1{font-size:23px;margin:14px 0 7px}p{color:#777065;font-size:14px;margin:0 0 22px}label{display:block;font-size:12px;font-weight:650;margin-bottom:7px}input{width:100%;padding:12px;border:1px solid #d9d3c9;border-radius:9px;font:inherit}button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:9px;background:#292621;color:#fff;font:inherit;font-weight:650}.error{background:#fff0ed;color:#9b3d2f;padding:9px 10px;border-radius:8px;font-size:12px;margin-bottom:15px}</style></head><body><main class="box"><div style="font-size:32px">📊</div><h1>Analytics do Cardápio</h1><p>Área administrativa. Informe a senha para continuar.</p>${msg}<form method="post" action="/analytics/login"><label for="password">Senha administrativa</label><input id="password" name="password" type="password" required autocomplete="current-password" autofocus><button>Entrar</button></form></main></body></html>`,{headers:{"Content-Type":"text/html; charset=UTF-8","Cache-Control":"no-store"}});
}
async function protectedPage(env, url) {
  const days = [1, 7, 30].includes(Number(url.searchParams.get("dias"))) ? Number(url.searchParams.get("dias")) : 7;
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const dataset = "events.analyticsEngine.cardapio_events";
  let events = [], productInteractions = [], filters = [], clickSources = [], productLinks = [], queryError = false;
  try {
    const queries = [
      `SELECT blob1 AS event_name, COUNT(*) AS total FROM ${dataset} WHERE timestamp >= $start GROUP BY blob1 ORDER BY total DESC LIMIT 20`,
      `SELECT blob2 AS product, blob8 AS open_source, COUNT(*) AS total FROM ${dataset} WHERE timestamp >= $start AND blob1 = 'product_open' AND blob2 != '' GROUP BY blob2, blob8 ORDER BY total DESC LIMIT 100`,
      `SELECT blob4 AS category_filter, COUNT(*) AS total FROM ${dataset} WHERE timestamp >= $start AND blob1 = 'filter_click' GROUP BY blob4 ORDER BY total DESC LIMIT 10`,
      `SELECT blob8 AS click_source, COUNT(*) AS total FROM ${dataset} WHERE timestamp >= $start AND blob1 = 'official_menu_click' GROUP BY blob8 ORDER BY total DESC LIMIT 10`,
      `SELECT blob2 AS modal_product, COUNT(*) AS total FROM ${dataset} WHERE timestamp >= $start AND blob1 = 'official_menu_click' AND blob8 = 'product_modal' AND blob2 != '' GROUP BY blob2 ORDER BY total DESC LIMIT 20`
    ];
    [events, productInteractions, filters, clickSources, productLinks] = await Promise.all(queries.map(async query => (await env.ANALYTICS_SQL.query({query, params:{start}})).data || []));
  } catch (error) {
    console.error(JSON.stringify({event:"analytics_query_error", message:safeText(error.message)}));
    queryError = true;
  }
  const totals = Object.fromEntries(events.map(row => [row.event_name, safeNumber(row.total)]));
  const formatter = new Intl.NumberFormat("pt-BR");
  const count = event => formatter.format(totals[event] || 0);
  const productCounts = new Map();
  let cardClickCount = 0;
  let detailsClickCount = 0;
  for (const row of productInteractions) {
    const amount = safeNumber(row.total);
    if (row.open_source !== "product_card" && row.open_source !== "details_button" && row.open_source !== "") continue;
    const counts = productCounts.get(row.product) || {card:0, details:0};
    if (row.open_source === "product_card") {
      counts.card += amount;
      cardClickCount += amount;
    } else {
      counts.details += amount;
      detailsClickCount += amount;
    }
    productCounts.set(row.product, counts);
  }
  const productRows = [...productCounts].sort((a,b) => (b[1].card+b[1].details)-(a[1].card+a[1].details)).map(([product, counts]) => [product,formatter.format(counts.card),formatter.format(counts.details)]);
  const modalLinkCount = formatter.format(safeNumber(clickSources.find(row => row.click_source === "product_modal")?.total));
  const metric = (label, value) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
  const tabs = [1,7,30].map(value => `<a href="/analytics?dias=${value}"${days===value?' aria-current="page"':''}>${value} ${value===1?'dia':'dias'}</a>`).join("");
  const content = queryError
    ? '<p class="error">Não foi possível consultar os eventos agora. Confira o Analytics SQL e os logs do Worker na Cloudflare.</p>'
    : `<div class="metrics">${metric("Cardápios carregados",count("menu_view"))}${metric("Produtos abertos",count("product_open"))}${metric("Cliques no produto",formatter.format(cardClickCount))}${metric("Cliques em Detalhes",formatter.format(detailsClickCount))}${metric("Cliques no link dentro de Detalhes",modalLinkCount)}${metric("Cliques no cardápio oficial",count("official_menu_click"))}${metric("Erros de catálogo",count("catalog_error"))}</div><section><h2>Interações por produto</h2><p>Cliques no cartão abrem o produto. A coluna Detalhes inclui os cliques registrados antes desta separação.</p>${table(["Produto","Clique no produto","Detalhes"],productRows)}</section><section><h2>Cliques no link oficial dentro de Detalhes</h2><p>Produtos com pelo menos um clique no link da janela de detalhes.</p>${table(["Produto","Cliques"],productLinks.map(row => [row.modal_product,formatter.format(safeNumber(row.total))]))}</section><section><h2>Filtros usados</h2>${table(["Categoria","Cliques"],filters.map(row => [row.category_filter || "Todos",formatter.format(safeNumber(row.total))]))}</section><section><h2>Origem dos cliques no cardápio oficial</h2>${table(["Origem","Cliques"],clickSources.map(row => [({menu_intro:"Apresentação do cardápio",closing_banner:"Banner final",product_modal:"Detalhes do produto"})[row.click_source] || row.click_source || "Não informada",formatter.format(safeNumber(row.total))]))}</section><section><h2>Todos os eventos</h2>${table(["Evento","Total"],events.map(row => [eventLabels[row.event_name] || row.event_name,formatter.format(safeNumber(row.total))]))}</section>`;
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Analytics · Chef Dani Teles</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f3ed;color:#292621;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1040px;margin:auto;padding:32px 20px 60px}header{display:flex;justify-content:space-between;align-items:center;gap:12px}h1{font-size:32px;margin:12px 0 4px}h2{font-size:21px;margin:0 0 16px}p{color:#675f55}a{color:#80451e}.tabs{display:flex;gap:8px;margin:26px 0}.tabs a{padding:8px 15px;border-radius:20px;background:white;text-decoration:none}.tabs a[aria-current]{background:#292621;color:white}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric,section{background:white;border:1px solid #e4dfd6;border-radius:14px;padding:20px}.metric strong{display:block;font-size:30px}.metric span{color:#675f55}section{margin-top:18px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e9e4dd}th:last-child,td:last-child{text-align:right}.empty{margin:0}.error{background:#fff0ed;color:#9b3d2f;padding:16px;border-radius:10px}</style></head><body><main class="wrap"><header><div><h1>Analytics do cardápio</h1><p>Chef Dani Teles · últimos ${days} ${days===1?'dia':'dias'}</p></div><a href="/analytics/logout">Sair</a></header><nav class="tabs" aria-label="Período">${tabs}</nav>${content}<p>Os números representam interações neste site. Cliques no cardápio oficial não confirmam pedidos ou vendas.</p></main></body></html>`,{headers:{"Content-Type":"text/html; charset=UTF-8","Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/analytics") {
      if (request.method !== "POST") return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST"}});
      try {
        const data=await request.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) return new Response("Invalid event",{status:400});
        const event=safeText(data.event,100);
        if(!Object.hasOwn(eventLabels,event)) return new Response("Invalid event",{status:400});
        env.ANALYTICS.writeDataPoint({
          blobs:[event,safeText(data.product_name ?? data.sauce),safeText(data.category,50),safeText(data.filter,50),safeText(data.close_method,50),safeText(data.path,200),safeText(data.product_id,50),safeText(data.source,50),safeText(data.availability,30),safeText(data.error_type,30)],
          doubles:[safeNumber(data.results),safeNumber(data.duration_seconds),safeNumber(data.product_count ?? data.sauces),safeNumber(data.price),safeNumber(data.available_count)],
          indexes:[event]
        });
        return new Response(null,{status:204});
      } catch(error) {
        console.error("Analytics error:",error);
        return new Response("Invalid request",{status:400});
      }
    }

    if (url.pathname==="/analytics/login" && request.method==="POST") {
      if(!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return new Response("Admin authentication is not configured.",{status:503});
      const form=await request.formData();
      if(String(form.get("password")||"")!==env.ADMIN_PASSWORD) return loginPage("Senha inválida.");
      const token=await createSession(env.SESSION_SECRET);
      return new Response(null,{status:303,headers:{
        Location:"/analytics",
        "Set-Cookie":`cardapio_admin=${token}; Path=/analytics; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
        "Cache-Control":"no-store"
      }});
    }
    if (url.pathname==="/analytics/logout") {
      return new Response(null,{status:303,headers:{
        Location:"/analytics",
        "Set-Cookie":"cardapio_admin=; Path=/analytics; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
        "Cache-Control":"no-store"
      }});
    }
    if (url.pathname==="/analytics" || url.pathname==="/analytics/") {
      const ok=await validSession(cookie(request,"cardapio_admin"),env.SESSION_SECRET);
      return ok?protectedPage(env,url):loginPage();
    }
    return env.ASSETS.fetch(request);
  }
};
