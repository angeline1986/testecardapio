import { analyticsDashboardPage, loadAnalyticsDashboard } from "./analytics.js";

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
function loginPage(error="") {
  const msg=error?`<div class="error">${error}</div>`:"";
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analytics · Login</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ed;color:#292621;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px}.box{width:min(390px,100%);background:#fff;border:1px solid #e4dfd6;border-radius:16px;padding:30px;box-shadow:0 12px 35px #2d251a14}h1{font-size:23px;margin:14px 0 7px}p{color:#777065;font-size:14px;margin:0 0 22px}label{display:block;font-size:12px;font-weight:650;margin-bottom:7px}input{width:100%;padding:12px;border:1px solid #d9d3c9;border-radius:9px;font:inherit}button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:9px;background:#292621;color:#fff;font:inherit;font-weight:650}.error{background:#fff0ed;color:#9b3d2f;padding:9px 10px;border-radius:8px;font-size:12px;margin-bottom:15px}</style></head><body><main class="box"><div style="font-size:32px">📊</div><h1>Analytics do Cardápio</h1><p>Área administrativa. Informe a senha para continuar.</p>${msg}<form method="post" action="/analytics/login"><label for="password">Senha administrativa</label><input id="password" name="password" type="password" required autocomplete="current-password" autofocus><button>Entrar</button></form></main></body></html>`,{headers:{"Content-Type":"text/html; charset=UTF-8","Cache-Control":"no-store"}});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/analytics/api/dashboard") {
      if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
      const authenticated = await validSession(cookie(request, "cardapio_admin"), env.SESSION_SECRET);
      if (!authenticated) {
        return new Response(JSON.stringify({ error: "Sessão administrativa inválida." }), {
          status: 401,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" }
        });
      }
      const days = [1, 7, 30].includes(Number(url.searchParams.get("dias"))) ? Number(url.searchParams.get("dias")) : 7;
      try {
        const data = await loadAnalyticsDashboard(env, days);
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
        });
      } catch (error) {
        console.error(JSON.stringify({ event: "analytics_query_error", message: safeText(error.message) }));
        return new Response(JSON.stringify({ error: "Não foi possível consultar as estatísticas." }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
        });
      }
    }

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
      if (!ok) return loginPage();
      const days = [1, 7, 30].includes(Number(url.searchParams.get("dias"))) ? Number(url.searchParams.get("dias")) : 7;
      return analyticsDashboardPage(days);
    }
    return env.ASSETS.fetch(request);
  }
};
