export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint de coleta dos eventos do cardápio.
    if (url.pathname === "/api/analytics") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            "Allow": "POST"
          }
        });
      }

      try {
        const data = await request.json();

        const event = String(data.event || "").slice(0, 100);

        if (!event) {
          return new Response("Invalid event", {
            status: 400
          });
        }

        env.ANALYTICS.writeDataPoint({
          blobs: [
            event,
            String(data.sauce || ""),
            String(data.category || ""),
            String(data.filter || ""),
            String(data.close_method || ""),
            String(data.path || "")
          ],

          doubles: [
            Number(data.results || 0),
            Number(data.duration_seconds || 0),
            Number(data.sauces || 0)
          ],

          indexes: [
            event
          ]
        });

        return new Response(null, {
          status: 204
        });

      } catch (error) {
        console.error("Analytics error:", error);

        return new Response("Invalid request", {
          status: 400
        });
      }
    }

    // Todo o restante continua sendo servido pelos assets estáticos.
    return env.ASSETS.fetch(request);
  }
};
