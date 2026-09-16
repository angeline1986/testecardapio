const modal = document.getElementById('modal');
const fechar = document.getElementById('fechar');
const cards = document.querySelectorAll('.card');

// Abre modal ao clicar no card
cards.forEach(card => {
  card.addEventListener('click', () => {
    const nome = card.querySelector('h3').textContent;
    const emoji = card.querySelector('.card-emoji').textContent;
    document.getElementById('modal-nome').textContent = emoji + ' ' + nome;
    document.getElementById('modal-desc').textContent = card.dataset.desc;
    document.getElementById('modal-ingredientes').textContent = '🧂 Ingredientes: ' + card.dataset.ingredientes;
    document.getElementById('modal-preco').textContent = card.dataset.preco;
    modal.classList.add('aberto');
  });
});

// Fecha modal
fechar.addEventListener('click', () => modal.classList.remove('aberto'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('aberto'); });

// Filtro por categoria
document.querySelectorAll('.filtros button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.filtros button.ativo').classList.remove('ativo');
    btn.classList.add('ativo');
    const filtro = btn.dataset.filtro;
    cards.forEach(card => {
      card.style.display = (filtro === 'todos' || card.dataset.categoria === filtro) ? 'block' : 'none';
    });
  });
});
