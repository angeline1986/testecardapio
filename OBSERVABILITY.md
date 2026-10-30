# Observabilidade do cardápio

## Onde acompanhar

- `/analytics`: dashboard protegido por `ADMIN_PASSWORD` e `SESSION_SECRET`, com períodos de 24 horas, 7 dias e 30 dias. Apresenta acessos, produtos abertos, cliques separados no cartão e no botão **Detalhes**, cliques no cardápio oficial, erros de catálogo, taxas de engajamento/conversão, produtos que receberam cliques no link oficial dentro dos detalhes, filtros usados e origem dos cliques.
- `GET /analytics/api/dashboard?dias=1|7|30`: endpoint JSON privado usado pelo dashboard. Exige a mesma sessão administrativa de `/analytics`; consultas e respostas não são armazenadas em cache.
- O dashboard mostra skeletons durante a consulta, uma mensagem vazia quando não há eventos pertinentes ao cardápio no período e uma mensagem de erro com opção de tentar novamente se a API falhar. As taxas ficam em 0% quando não há cardápios carregados.
- Cloudflare Web Analytics: page views e métricas de navegação do beacon em `public/index.html`.
- Cloudflare Workers → `cardapio` → Observability: logs e erros do Worker. Falhas de consulta ao Analytics SQL são registradas como `analytics_query_error`.
- Workers Analytics Engine: dataset `cardapio_events`, usado pelos eventos enviados ao endpoint `POST /api/analytics`.

## Eventos

| Evento | Quando ocorre | Campos principais |
| --- | --- | --- |
| `menu_view` | Catálogo JSON carregado | `product_count`, `available_count` |
| `filter_click` | Filtro ou categoria selecionada | `filter`, `results`, `source` |
| `product_open` | Janela de produto aberta por clique no cartão (`source=product_card`) ou no botão **Detalhes** (`source=details_button`) | `product_id`, `product_name`, `category`, `price`, `availability`, `source` |
| `product_close` | Detalhes fechados | mesmos campos, `duration_seconds`, `close_method` |
| `official_menu_click` | Link para Instadelivery clicado | `source`; `product_id` e `product_name` quando o link fica dentro da janela de detalhes (`source=product_modal`) |
| `catalog_error` | Falha ao carregar `products.json` | `error_type` (`http` ou `other`) |

Os eventos não incluem informações pessoais. O clique para o cardápio oficial indica interesse, não pedido ou venda. Preços e disponibilidade são uma fotografia do catálogo consultado em 28/10/2026. O dashboard usa métricas consolidadas e não mostra a tabela bruta de todos os eventos.

## Compatibilidade com o histórico

O Worker conserva as posições originais do Analytics Engine: `blob1` evento, `blob2` nome do produto (antigo `sauce`), `blob3` categoria, `blob4` filtro, `blob5` método de fechamento, `blob6` caminho; `double1` resultados, `double2` duração e `double3` total de produtos (antigo `sauces`). Novos campos: `blob7` ID, `blob8` origem do clique, `blob9` disponibilidade, `blob10` tipo de erro, `double4` preço numérico e `double5` produtos disponíveis. O endpoint ainda aceita `sauce`, `sauces`, `sauce_open` e `sauce_close` durante a transição; o site envia os novos nomes. Os eventos históricos de molho não entram nas métricas do cardápio atual.

Eventos `product_open` anteriores à separação não têm `source`; eles são contados como cliques em **Detalhes**, pois antes só o botão abria a janela do produto. **Produtos abertos** soma as duas origens.

Os agregados podem ser estimativas quando há amostragem. A [retenção do Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/limits/) é de três meses. O painel usa o [Analytics SQL binding](https://developers.cloudflare.com/analytics/sql-api/workers-binding/), disponível no Wrangler 4.145.0 ou superior e sujeito à permissão da conta para consultar o dataset.

## Operação

Antes do deploy, confirme os dois secrets com `npx wrangler secret list`. `deploy.command` executa validação e publicação; `setup_cardapio.command` informa se falta `SESSION_SECRET`. Não guarde secrets em arquivos versionados. Arquivos `.dev.vars*` e `.env*` são ignorados pelo Git.
