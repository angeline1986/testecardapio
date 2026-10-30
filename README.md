# Cardápio Chef Dani Teles

## Tutorial

- [Abrir o tutorial HTML no projeto](public/tutorial.html)
- [Abrir o tutorial no site publicado](https://cardapio.chefdaniteles.workers.dev/tutorial.html)

O guia cobre configuração, prévia local, edição de produtos e imagens, publicação na Cloudflare, estatísticas e sincronização com o GitHub.

## Comandos principais

- `./setup_cardapio.command` — prepara e verifica o ambiente.
- `./preview.command` — abre uma prévia local; encerre com `Ctrl+C`.
- `./deploy.command` — valida e publica no Worker `cardapio`.

O projeto não requer `npm install` nem `npm run build`; o Wrangler prepara os arquivos durante o deploy. Para detalhes sobre eventos e logs, consulte [OBSERVABILITY.md](OBSERVABILITY.md).

No Windows, execute os comandos pelo **Git Bash**. O tutorial explica como instalar e abrir os programas necessários.
