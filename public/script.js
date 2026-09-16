const modal = document.getElementById('modal');
const fechar = document.getElementById('fechar');
const cards = document.querySelectorAll('.card');
const filtros = document.querySelectorAll('.filtros button');

let cardAtual = null;
let modalAbertoEm = null;

/* =========================================================
   ANALYTICS
   Os eventos são enviados para o próprio Worker.

   O endpoint /api/analytics será criado no próximo passo.
   ========================================================= */

function track(evento, dados = {}) {
  const payload = {
    event: evento,
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    ...dados
  };

  // Mantém o evento visível no console para facilitar os testes.
  console.debug('[analytics]', payload);

  try {
    const body = JSON.stringify(payload);

    /*
     * sendBeacon é ideal para analytics porque não bloqueia
     * a navegação e continua funcionando mesmo quando a página
     * está sendo fechada.
     */
    if (navigator.sendBeacon) {
      const blob = new Blob(
        [body],
        { type: 'application/json' }
      );

      navigator.sendBeacon('/api/analytics', blob);
      return;
    }

    // Fallback para navegadores sem sendBeacon.
    fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
      keepalive: true
    }).catch((erro) => {
      console.warn(
        '[analytics] Não foi possível enviar o evento:',
        erro
      );
    });

  } catch (erro) {
    console.warn(
      '[analytics] Falha ao preparar o evento:',
      erro
    );
  }
}


/* =========================================================
   MODAL
   ========================================================= */

function abrirModal(card) {
  const nome =
    card.dataset.nome ||
    card.querySelector('h3')?.textContent?.trim() ||
    '';

  const emoji =
    card.querySelector('.card-emoji')?.textContent?.trim() ||
    '';

  const categoria = card.dataset.categoria || '';
  const preco = card.dataset.preco || '';

  document.getElementById('modal-nome').textContent =
    `${emoji} ${nome}`.trim();

  document.getElementById('modal-desc').textContent =
    card.dataset.desc || '';

  document.getElementById('modal-ingredientes').textContent =
    '🧂 Ingredientes: ' + (card.dataset.ingredientes || '');

  document.getElementById('modal-preco').textContent =
    preco;

  cardAtual = card;
  modalAbertoEm = Date.now();

  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');

  fechar.focus();

  track('sauce_open', {
    sauce: nome,
    category: categoria,
    price: preco
  });
}


function fecharModal(origem = 'unknown') {
  if (!modal.classList.contains('aberto')) {
    return;
  }

  let duracao = 0;

  if (modalAbertoEm) {
    duracao = Math.round(
      (Date.now() - modalAbertoEm) / 1000
    );
  }

  if (cardAtual) {
    const nome =
      cardAtual.dataset.nome ||
      cardAtual.querySelector('h3')?.textContent?.trim() ||
      '';

    track('sauce_close', {
      sauce: nome,
      category: cardAtual.dataset.categoria || '',
      duration_seconds: duracao,
      close_method: origem
    });
  }

  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');

  const cardAnterior = cardAtual;

  cardAtual = null;
  modalAbertoEm = null;

  if (cardAnterior) {
    cardAnterior.focus();
  }
}


/* =========================================================
   CARDS
   ========================================================= */

cards.forEach((card) => {

  card.addEventListener('click', () => {
    abrirModal(card);
  });

  card.addEventListener('keydown', (event) => {

    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      abrirModal(card);
    }

  });

});


/* =========================================================
   FECHAR MODAL
   ========================================================= */

fechar.addEventListener('click', () => {
  fecharModal('button');
});


modal.addEventListener('click', (event) => {

  if (event.target === modal) {
    fecharModal('backdrop');
  }

});


document.addEventListener('keydown', (event) => {

  if (
    event.key === 'Escape' &&
    modal.classList.contains('aberto')
  ) {
    fecharModal('escape');
  }

});


/* =========================================================
   FILTROS
   ========================================================= */

filtros.forEach((btn) => {

  btn.addEventListener('click', () => {

    const ativoAtual =
      document.querySelector('.filtros button.ativo');

    if (ativoAtual) {
      ativoAtual.classList.remove('ativo');
    }

    btn.classList.add('ativo');

    const filtro = btn.dataset.filtro;

    let resultados = 0;

    cards.forEach((card) => {

      const visivel =
        filtro === 'todos' ||
        card.dataset.categoria === filtro;

      card.style.display =
        visivel ? 'block' : 'none';

      if (visivel) {
        resultados++;
      }

    });

    track('filter_click', {
      filter: filtro,
      results: resultados
    });

  });

});


/* =========================================================
   VISUALIZAÇÃO DO CARDÁPIO
   ========================================================= */

window.addEventListener('load', () => {

  track('menu_view', {
    sauces: cards.length,
    language: navigator.language || ''
  });

});