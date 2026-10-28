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
function loginPage(error="") {
  const msg=error?`<div class="error">${error}</div>`:"";
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analytics · Login</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ed;color:#292621;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px}.box{width:min(390px,100%);background:#fff;border:1px solid #e4dfd6;border-radius:16px;padding:30px;box-shadow:0 12px 35px #2d251a14}h1{font-size:23px;margin:14px 0 7px}p{color:#777065;font-size:14px;margin:0 0 22px}label{display:block;font-size:12px;font-weight:650;margin-bottom:7px}input{width:100%;padding:12px;border:1px solid #d9d3c9;border-radius:9px;font:inherit}button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:9px;background:#292621;color:#fff;font:inherit;font-weight:650}.error{background:#fff0ed;color:#9b3d2f;padding:9px 10px;border-radius:8px;font-size:12px;margin-bottom:15px}</style></head><body><main class="box"><div style="font-size:32px">🍶</div><h1>Analytics do Cardápio</h1><p>Área administrativa. Informe a senha para continuar.</p>${msg}<form method="post" action="/analytics/login"><label for="password">Senha administrativa</label><input id="password" name="password" type="password" required autocomplete="current-password" autofocus><button>Entrar</button></form></main></body></html>`,{headers:{"Content-Type":"text/html; charset=UTF-8","Cache-Control":"no-store"}});
}
function protectedPage() {
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analytics protegido</title><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f3ed;color:#292621;padding:40px"><main style="max-width:700px;margin:auto;background:white;border:1px solid #e4dfd6;border-radius:14px;padding:28px"><h1>🍶 Analytics protegido</h1><p>Autenticação concluída com sucesso.</p><p>O dashboard aprovado será conectado aqui na próxima etapa.</p><a href="/analytics/logout">Sair</a></main></body></html>`,{headers:{"Content-Type":"text/html; charset=UTF-8","Cache-Control":"no-store"}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/analytics") {
      if (request.method !== "POST") return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST"}});
      try {
        const data=await request.json();
        const event=String(data.event||"").slice(0,100);
        if(!event) return new Response("Invalid event",{status:400});
        env.ANALYTICS.writeDataPoint({
          blobs:[event,String(data.sauce||""),String(data.category||""),String(data.filter||""),String(data.close_method||""),String(data.path||"")],
          doubles:[Number(data.results||0),Number(data.duration_seconds||0),Number(data.sauces||0)],
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
      return ok?protectedPage():loginPage();
    }
    return env.ASSETS.fetch(request);
  }
};
