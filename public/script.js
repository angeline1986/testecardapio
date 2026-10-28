const categoryLabels = { promocoes: 'Promoções', salgados: 'Salgados', doces: 'Doces' };
const assetBase = 'assets/chef-dani/';
const grid = document.getElementById('grid');
const results = document.getElementById('results');
const modal = document.getElementById('modal');
const modalBox = modal.querySelector('.modal-box');
const closeButton = document.getElementById('fechar');
const filters = [...document.querySelectorAll('.filtros button')];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
let products = [];
let activeProduct = null;
let triggerButton = null;
let openedAt = 0;
let currentFilter = 'todos';

function track(event, data = {}) {
  const payload = { event, timestamp: new Date().toISOString(), path: location.pathname, ...data };
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics must never interrupt browsing the menu.
  }
}

function productImage(product) {
  if (product.image) {
    const image = document.createElement('img');
    image.src = assetBase + product.image;
    image.alt = product.image_alt || product.name;
    image.width = 400;
    image.height = 400;
    image.loading = 'lazy';
    return image;
  }
  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  placeholder.innerHTML = '<img src="assets/chef-dani/marca.png" alt="" width="74" height="74"><span>Foto indisponível</span>';
  return placeholder;
}

function renderProducts() {
  grid.replaceChildren();
  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.categoria = product.category;
    if (!product.available) card.classList.add('sold-out');

    const body = document.createElement('div');
    body.className = 'card-body';
    const labels = document.createElement('div');
    labels.className = 'card-labels';
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = categoryLabels[product.category];
    labels.append(tag);
    if (!product.available) {
      const status = document.createElement('span');
      status.className = 'stock-badge';
      status.textContent = 'Esgotado';
      labels.append(status);
    }
    const heading = document.createElement('h3');
    heading.textContent = product.name;
    const description = document.createElement('p');
    description.textContent = product.summary;
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const priceGroup = document.createElement('div');
    priceGroup.className = 'price-group';
    if (product.previous_price && product.previous_price > product.price) {
      const oldPrice = document.createElement('del');
      oldPrice.className = 'old-price';
      oldPrice.textContent = money.format(product.previous_price);
      priceGroup.append(oldPrice);
    }
    const price = document.createElement('span');
    price.className = 'preco';
    price.textContent = money.format(product.price);
    priceGroup.append(price);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-action';
    button.setAttribute('aria-label', 'Ver detalhes de ' + product.name);
    button.innerHTML = 'Detalhes <span aria-hidden="true">↗</span>';
    button.addEventListener('click', () => openModal(product, button));

    footer.append(priceGroup, button);
    body.append(labels, heading, description, footer);
    card.append(productImage(product), body);
    grid.append(card);
  });
}

function applyFilter(category, shouldTrack = true) {
  currentFilter = category;
  filters.forEach((button) => {
    const active = button.dataset.filtro === category;
    button.classList.toggle('ativo', active);
    button.setAttribute('aria-pressed', String(active));
  });
  let count = 0;
  grid.querySelectorAll('.card').forEach((card) => {
    const visible = category === 'todos' || card.dataset.categoria === category;
    card.hidden = !visible;
    if (visible) count += 1;
  });
  results.textContent = count + (count === 1 ? ' produto encontrado' : ' produtos encontrados');
  if (shouldTrack) track('filter_click', { filter: category, results: count });
}

function openModal(product, button) {
  activeProduct = product;
  triggerButton = button;
  openedAt = Date.now();
  const modalImage = document.getElementById('modal-imagem');
  modalBox.classList.toggle('no-image', !product.image);
  modalImage.hidden = !product.image;
  if (product.image) {
    modalImage.src = assetBase + product.image;
    modalImage.alt = product.image_alt || product.name;
  }
  document.getElementById('modal-categoria').textContent = categoryLabels[product.category];
  document.getElementById('modal-nome').textContent = product.name;
  document.getElementById('modal-desc').textContent = product.description;
  document.getElementById('modal-status').textContent = product.available ? 'Disponível na consulta de 28/10/2026.' : 'Esgotado na consulta de 28/10/2026.';
  const oldPrice = document.getElementById('modal-old-price');
  oldPrice.hidden = !product.previous_price || product.previous_price <= product.price;
  oldPrice.textContent = oldPrice.hidden ? '' : money.format(product.previous_price);
  document.getElementById('modal-preco').textContent = money.format(product.price);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  closeButton.focus();
  // The Worker currently stores product names in its legacy "sauce" field.
  track('product_open', { sauce: product.name, category: product.category, price: money.format(product.price) });
}

function closeModal(method) {
  if (modal.hidden) return;
  track('product_close', {
    sauce: activeProduct.name,
    category: activeProduct.category,
    duration_seconds: Math.round((Date.now() - openedAt) / 1000),
    close_method: method
  });
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  triggerButton?.focus();
  activeProduct = null;
  triggerButton = null;
}

filters.forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filtro)));
document.querySelectorAll('[data-category-link]').forEach((button) => {
  button.addEventListener('click', () => {
    applyFilter(button.dataset.categoryLink);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('cardapio').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  });
});
closeButton.addEventListener('click', () => closeModal('button'));
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal('backdrop'); });
document.addEventListener('keydown', (event) => {
  if (modal.hidden) return;
  if (event.key === 'Escape') closeModal('escape');
  if (event.key === 'Tab') {
    const focusables = [closeButton, document.getElementById('modal-desc'), modal.querySelector('.official-link')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

async function loadCatalog() {
  if (location.protocol === 'file:') return;
  results.textContent = 'Carregando produtos…';
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const catalog = await response.json();
    products = catalog.products;
    renderProducts();
    applyFilter(currentFilter, false);
    track('menu_view', { sauces: products.length, language: navigator.language || '' });
  } catch (error) {
    results.textContent = 'Não foi possível carregar o cardápio. Atualize a página para tentar novamente.';
    console.error('Erro ao carregar o cardápio:', error);
  }
}

loadCatalog();
