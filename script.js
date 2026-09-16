const modal = document.getElementById('modal');
const fechar = document.getElementById('fechar');
const cards = document.querySelectorAll('.card');
const filtros = document.querySelectorAll('.filtros button');

let cardAtual = null;
let modalAbertoEm = null;

/*
 * Observabilidade
 *
 * Se o Cloudflare Zaraz estiver disponível, envia o evento.
 * Caso contrário, não interfere no funcionamento do cardápio.
 */
function track(evento, dados = {}) {
  try {
    if (window.zaraz && typeof window.zaraz.track === 'function') {
      window.zaraz.track(evento, dados);
    }

    // Útil durante os testes.
    console.debug('[analytics]', evento, dados);
  } catch (erro) {
    console.warn('[analytics] Falha ao registrar evento:', erro);
  }
}


/* =========================================================
   MODAL
   ========================================================= */

function abrirModal(card) {
  const nome =
    card.dataset.nome ||
    card.querySelector('h3')?.textContent.trim() ||
    'Molho';

  const emoji =
    card.querySelector('.card-emoji')?.textContent.trim() || '';

  const categoria = card.dataset.categoria || '';
  const preco = card.dataset.preco || '';

  document.getElementById('modal-nome').textContent =
    `${emoji} ${nome}`.trim();

  document.getElementById('modal-desc').textContent =
    card.dataset.desc || '';

  document.getElementById('modal-ingredientes').textContent =
    `🧂 Ingredientes: ${card.dataset.ingredientes || ''}`;

  document.getElementById('modal-preco').textContent = preco;

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


function fecharModal(origem = 'button') {
  if (!modal.classList.contains('aberto')) {
    return;
  }

  const nome = cardAtual?.dataset.nome || '';
  const categoria = cardAtual?.dataset.categoria || '';

  const tempoAberto = modalAbertoEm
    ? Math.round((Date.now() - modalAbertoEm) / 1000)
    : 0;

  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');

  track('sauce_close', {
    sauce: nome,
    category: categoria,
    duration_seconds: tempoAberto,
    close_method: origem
  });

  if (cardAtual) {
    cardAtual.focus();
  }

  cardAtual = null;
  modalAbertoEm = null;
}


/* =========================================================
   CARDS
   ========================================================= */

cards.forEach(card => {

  card.addEventListener('click', () => {
    abrirModal(card);
  });

  /*
   * Como os cards agora possuem tabindex="0" e role="button",
   * Enter e Espaço também devem abri-los.
   */
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirModal(card);
    }
  });

});


/* =========================================================
   FECHAMENTO DO MODAL
   ========================================================= */

fechar.addEventListener('click', () => {
  fecharModal('button');
});


modal.addEventListener('click', event => {
  if (event.target === modal) {
    fecharModal('backdrop');
  }
});


document.addEventListener('keydown', event => {
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

filtros.forEach(btn => {

  btn.addEventListener('click', () => {

    const ativo = document.querySelector(
      '.filtros button.ativo'
    );

    if (ativo) {
      ativo.classList.remove('ativo');
    }

    btn.classList.add('ativo');

    const filtro = btn.dataset.filtro;

    let resultados = 0;

    cards.forEach(card => {

      const visivel =
        filtro === 'todos' ||
        card.dataset.categoria === filtro;

      card.style.display = visivel ? 'block' : 'none';

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
   CARREGAMENTO DO CARDÁPIO
   ========================================================= */

window.addEventListener('load', () => {

  track('menu_view', {
    sauces: cards.length,
    language: document.documentElement.lang || 'pt-BR'
  });

});