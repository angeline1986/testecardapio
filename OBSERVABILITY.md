# Observabilidade do cardápio

## Onde acompanhar

- `/analytics`: resumo protegido por `ADMIN_PASSWORD` e `SESSION_SECRET`, com períodos de 1, 7 e 30 dias. Mostra carregamentos do cardápio, aberturas de produto, cliques para o cardápio oficial, erros de carregamento, produtos mais abertos, filtros usados e origem dos cliques.
- Cloudflare Web Analytics: page views e métricas de navegação do beacon em `public/index.html`.
- Cloudflare Workers → `testecardapio` → Observability: logs e erros do Worker. Falhas de consulta ao Analytics SQL são registradas como `analytics_query_error`.
- Workers Analytics Engine: dataset `cardapio_events`, usado pelos eventos enviados ao endpoint `POST /api/analytics`.

## Eventos

| Evento | Quando ocorre | Campos principais |
| --- | --- | --- |
| `menu_view` | Catálogo JSON carregado | `product_count`, `available_count` |
| `filter_click` | Filtro ou categoria selecionada | `filter`, `results`, `source` |
| `product_open` | Detalhes de produto abertos | `product_id`, `product_name`, `category`, `price`, `availability` |
| `product_close` | Detalhes fechados | mesmos campos, `duration_seconds`, `close_method` |
| `official_menu_click` | Link para Instadelivery clicado | `source`; dados do produto quando parte do modal |
| `catalog_error` | Falha ao carregar `products.json` | `error_type` (`http` ou `other`) |

Os eventos não incluem informações pessoais. O clique para o cardápio oficial indica interesse, não pedido ou venda. Preços e disponibilidade são uma fotografia do catálogo consultado em 28/10/2026.

## Compatibilidade com o histórico

O Worker conserva as posições originais do Analytics Engine: `blob1` evento, `blob2` nome do produto (antigo `sauce`), `blob3` categoria, `blob4` filtro, `blob5` método de fechamento, `blob6` caminho; `double1` resultados, `double2` duração e `double3` total de produtos (antigo `sauces`). Novos campos: `blob7` ID, `blob8` origem do clique, `blob9` disponibilidade, `blob10` tipo de erro, `double4` preço numérico e `double5` produtos disponíveis. O endpoint ainda aceita `sauce`, `sauces`, `sauce_open` e `sauce_close` durante a transição; o site envia os novos nomes. O painel identifica eventos antigos de molho separadamente no quadro de todos os eventos.

Os agregados podem ser estimativas quando há amostragem. A [retenção do Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/limits/) é de três meses. O painel usa o [Analytics SQL binding](https://developers.cloudflare.com/analytics/sql-api/workers-binding/), disponível no Wrangler 4.145.0 ou superior e sujeito à permissão da conta para consultar o dataset.

## Operação

Antes do deploy, confirme os dois secrets com `npx wrangler secret list`. `deploy.command` executa validação e publicação; `setup_cardapio.command` informa se falta `SESSION_SECRET`. Não guarde secrets em arquivos versionados. Arquivos `.dev.vars*` e `.env*` são ignorados pelo Git.
