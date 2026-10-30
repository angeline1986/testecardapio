# Cardápio Chef Dani Teles

Este projeto publica um cardápio estático em um Cloudflare Worker. O Wrangler valida e envia os arquivos de `public/` junto com o Worker em `src/worker.js`.

## Requisitos

- Node.js e npm, para executar o Wrangler via `npx`.
- Python 3, para abrir a prévia local.
- Git, para sincronizar alterações com o GitHub.
- Acesso à conta Cloudflare que contém o Worker `cardapio`.

Não há `npm install` nem comando `npm run build`: o Wrangler prepara os arquivos durante o deploy.

## 1. Preparar o projeto

Se ainda não tiver uma cópia local:

```bash
git clone https://github.com/angeline1986/testecardapio.git
cd testecardapio
```

Na primeira utilização neste computador, entre na Cloudflare pelo Wrangler:

```bash
npx wrangler login
npx wrangler whoami
```

Para rodar o assistente de configuração e conferir os requisitos do ambiente:

```bash
./setup_cardapio.command
```

Ele pode perguntar se deve iniciar o deploy. Responda `N` se quiser apenas configurar e revisar primeiro.

O arquivo `wrangler.jsonc` já está configurado para o Worker `cardapio`, o catálogo `cardapio_events` e o endereço [cardapio.chefdaniteles.workers.dev](https://cardapio.chefdaniteles.workers.dev).

## 2. Abrir uma prévia local

Na pasta do projeto, execute:

```bash
./preview.command
```

O navegador abrirá o cardápio local. Mantenha o Terminal aberto enquanto testa; pressione `Ctrl+C` para encerrar a prévia. Ela não publica alterações no site.

## 3. Atualizar produtos e imagens

- Edite nomes, descrições, categorias, preços e disponibilidade em `public/products.json`.
- Coloque as imagens em `public/assets/chef-dani/` e atualize o campo `image` do produto para apontar ao nome do arquivo.
- Ajuste o layout em `public/style.css` e o comportamento em `public/script.js`.
- Altere o conteúdo e a estrutura da página em `public/index.html`.

O catálogo é um arquivo estático. Mudanças no InstaDelivery não são sincronizadas automaticamente; revise preço e disponibilidade antes de publicar.

Depois das alterações, rode novamente `./preview.command` e confira a página em computador e celular.

## 4. Validar e publicar

Antes de publicar, rode os testes do Worker:

```bash
node --test tests/worker.test.mjs
```

Para publicar no Worker de produção:

```bash
./deploy.command
```

O script confere os arquivos e a autenticação Cloudflare, executa `wrangler deploy --dry-run` e, se a validação passar, publica o Worker e os arquivos estáticos. Ao final, o Wrangler informa o endereço implantado.

Se a validação falhar, corrija o erro indicado e rode o comando novamente. Não é necessário executar um build separado.

## 5. Consultar as estatísticas

Abra [cardapio.chefdaniteles.workers.dev/analytics](https://cardapio.chefdaniteles.workers.dev/analytics) e entre com a senha configurada em `ADMIN_PASSWORD`. O painel permite selecionar 1, 7 ou 30 dias.

Para acompanhar os logs recentes do Worker pelo Terminal:

```bash
npx wrangler tail cardapio
```

Pressione `Ctrl+C` para parar de acompanhar os logs.

Os comandos abaixo ajudam a conferir os secrets configurados; `secret list` mostra os nomes, nunca os valores:

```bash
npx wrangler secret list --config wrangler.jsonc
```

Para trocar a senha administrativa:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

O Wrangler solicitará o novo valor no Terminal. Esse comando publica a alteração do secret imediatamente. Não coloque senhas em arquivos do projeto ou no Git. Para detalhes dos eventos e logs, consulte [OBSERVABILITY.md](OBSERVABILITY.md).

## 6. Salvar alterações no GitHub

Quando estiver satisfeito com a prévia e a publicação:

```bash
git status
git add -A
git commit -m "descreva a alteração"
git push origin main
```

Confira `git status` antes de adicionar arquivos e confirme que as alterações listadas devem entrar no commit. Este Worker aparece conectado ao GitHub na Cloudflare; se o deploy automático estiver ativo, enviar para `main` também pode publicar. `./deploy.command` é o caminho de deploy manual.

## Arquivos principais

- `public/`: página, estilos, comportamento, catálogo e imagens.
- `src/worker.js`: endpoint de eventos, autenticação e painel `/analytics`.
- `wrangler.jsonc`: nome do Worker e recursos da Cloudflare usados no deploy.
- `preview.command`: prévia local.
- `deploy.command`: validação e deploy de produção.
- `setup_cardapio.command`: diagnóstico e configuração guiada do ambiente.
- `OBSERVABILITY.md`: eventos coletados, campos e locais para consultar logs.
