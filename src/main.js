import './style.css';
import { CONFIG } from './config.js';
import { initialProducts, ALL, FAVORITES, BASE_CATEGORIES } from './lib/data.js';
import { escapeHtml as e, money, formatPhoneBR, isValidPhoneBR, discountPct, createStorage, buildOrderText, buildWhatsAppUrl } from './lib/utils.js';
import { sanitizeProducts, sanitizeProduct, sanitizeCart, cartCount, cartItems, cartTotal, cartHasUnpriced, hasPrice, thumbOf, getCategories, filterProducts, createOrder, validateCheckout } from './lib/logic.js';

const storage = createStorage();
const KEYS = { products: 'es_products_v3', cart: 'es_cart', favs: 'es_favs', orders: 'es_orders' };

/* ---------- Estado ---------- */
const state = {
  products: sanitizeProducts(storage.get(KEYS.products, null)) ?? structuredClone(initialProducts),
  favorites: new Set((storage.get(KEYS.favs, []) || []).map(Number)),
  category: ALL,
  query: '',
  sort: 'featured',
  admin: location.hash === '#admin',
};
if (!state.products.length) state.products = structuredClone(initialProducts);
let cart = sanitizeCart(storage.get(KEYS.cart, {}), state.products, CONFIG.maxQtyPerItem);

const persist = () => {
  storage.set(KEYS.products, state.products);
  storage.set(KEYS.cart, cart);
  storage.set(KEYS.favs, [...state.favorites]);
};
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');

/* ---------- Shell (renderizado uma única vez) ---------- */
function renderShell() {
  const name = e(CONFIG.storeName);
  app.innerHTML = `
  <a class="skip-link" href="#catalogo">Pular para os produtos</a>
  <div class="announcement">✦ Ofertas especiais e novidades esperando por você ✦</div>
  <header class="header">
    <button class="menu-btn" data-action="scroll" data-target=".category-nav" aria-label="Ir para categorias">☰</button>
    <a class="brand" href="#top" aria-label="${name} — início"><span class="brand-mark" aria-hidden="true">E</span><span>elenilson<span class="brand-store">STORE</span></span></a>
    <form class="search" role="search" id="search-form"><span aria-hidden="true">⌕</span>
      <input id="search" type="search" name="q" placeholder="O que você está procurando?" aria-label="Buscar produtos" autocomplete="off" maxlength="60">
      <button type="submit">Buscar</button></form>
    <div class="header-actions">
      <button class="admin-link" data-action="openAdmin" id="admin-btn" hidden>⚙ <span>Minha loja</span></button>
      <button class="cart-button" data-action="openCart" aria-label="Abrir carrinho">🛒 <span class="cart-label">Carrinho</span><b id="cart-count">0</b></button>
    </div>
  </header>
  <nav class="category-nav" aria-label="Categorias" id="category-nav"></nav>
  <main id="top">
    <section class="hero"><div class="hero-copy"><span class="eyebrow">BEM-VINDO À ${name.toUpperCase()}</span>
      <h1>Boas escolhas.<br><em>Melhores ofertas.</em></h1>
      <p>Produtos para facilitar sua rotina, renovar seu estilo e surpreender você — tudo em um só lugar.</p>
      <button class="hero-cta" data-action="scroll" data-target="#catalogo">Explorar produtos <span aria-hidden="true">→</span></button>
      <div class="hero-benefits"><span>✓ Compra prática</span><span>✓ Pagamento via Pix</span></div></div>
      <div class="hero-art" aria-hidden="true"><div class="hero-circle"></div><div class="float-card fc-one">🎧 <span>Tech do dia</span></div><div class="float-card fc-two">✨ <span>Achadinhos</span></div><div class="hero-bag">🛍️</div><div class="hero-sticker">OFERTAS<br><b>TOP</b></div></div></section>
    <section class="benefit-row" aria-label="Vantagens">
      <div><span class="benefit-icon" aria-hidden="true">🚚</span><span><b>Entrega combinada</b><small>Consulte opções no pedido</small></span></div>
      <div><span class="benefit-icon" aria-hidden="true">🔒</span><span><b>Compra com tranquilidade</b><small>Atendimento direto</small></span></div>
      <div><span class="benefit-icon" aria-hidden="true">⚡</span><span><b>Pagamento via Pix</b><small>Simples e prático</small></span></div>
      <div><span class="benefit-icon" aria-hidden="true">💬</span><span><b>Fale com a loja</b><small>Atendimento personalizado</small></span></div></section>
    <section class="catalog" id="catalogo">
      <div class="section-heading"><div><span class="eyebrow">ESCOLHA O SEU PRÓXIMO FAVORITO</span><h2 id="catalog-title">Destaques da loja</h2><p id="result-count" aria-live="polite"></p></div>
        <label class="sort-label">Ordenar por <select id="sort"><option value="featured">Destaques</option><option value="price-up">Menor preço</option><option value="price-down">Maior preço</option><option value="discount">Maior desconto</option></select></label></div>
      <div class="category-pills" id="category-pills"></div>
      <div class="product-grid" id="grid"></div>
    </section>
    <section class="newsletter"><div><span class="eyebrow">FIQUE POR DENTRO</span><h2>Ofertas que valem a pena.</h2><p>Salve nossa loja e volte sempre para conferir as novidades.</p></div>
      <button data-action="toast" data-msg="Obrigado por visitar a ${name}!">Quero ver novidades ↗</button></section>
  </main>
  <footer><a class="brand footer-brand" href="#top"><span class="brand-mark" aria-hidden="true">E</span><span>elenilson<span class="brand-store">STORE</span></span></a><p>Seu próximo achadinho está aqui.</p>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${name}. Todos os direitos reservados.</span><span>Pagamento via Pix · Atendimento ao cliente</span></div></footer>
  <div id="overlay" class="overlay" data-action="overlay"></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

/* ---------- Partes dinâmicas ---------- */
const ICONS = { [ALL]: '☷', Relógios: '◷', Eletrônicos: '▣', Moda: '♧', Beleza: '✧', 'Bem-estar': '✚', Natural: '❀', Casa: '⌂', [FAVORITES]: '♥' };
const priceHtml = (p) => (hasPrice(p) ? `<strong>${money(p.price)}</strong>${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ''}` : '<strong class="ask">Consulte o preço</strong>');
const visual = (p) => (p.images?.length ? `<img src="${e(thumbOf(p.images[0]))}" alt="${e(p.name)}" loading="lazy" decoding="async" width="360" height="480">` : `<span class="product-emoji" aria-hidden="true">${e(p.emoji)}</span>`);

function productCard(p) {
  const pct = discountPct(p);
  const fav = state.favorites.has(p.id);
  const inCart = cart[p.id] || 0;
  return `<article class="product-card">
    <div class="product-visual ${p.images?.length ? 'has-img' : ''}" style="--product-bg:${e(p.color)}" data-action="view" data-id="${p.id}" role="button" tabindex="0" aria-label="Ver detalhes de ${e(p.name)}">
      ${p.tag ? `<span class="tag">${e(p.tag)}</span>` : ''}${pct ? `<span class="off">-${pct}%</span>` : ''}
      <button class="heart ${fav ? 'active' : ''}" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos' : 'Adicionar aos'} favoritos">${fav ? '♥' : '♡'}</button>
      ${visual(p)}</div>
    <div class="product-info"><span class="product-category">${e(p.category)}</span><h3>${e(p.name)}</h3>
      <div class="prices">${priceHtml(p)}</div>
      <p class="installment">${hasPrice(p) ? 'Pagamento via Pix' : 'Peça e receba o valor no atendimento'}</p>
      <button class="add-button" data-action="add" data-id="${p.id}">＋ Adicionar ao carrinho${inCart ? ` (${inCart})` : ''}</button></div></article>`;
}

function renderCatalog() {
  const cats = getCategories(state.products);
  if (!cats.includes(state.category)) state.category = ALL;
  const favCount = state.favorites.size;
  const label = (c) => (c === FAVORITES ? `${FAVORITES}${favCount ? ` (${favCount})` : ''}` : c);
  $('#category-nav').innerHTML = cats.map((c) => `<button class="${state.category === c ? 'active' : ''}" data-action="category" data-value="${e(c)}" aria-pressed="${state.category === c}">${ICONS[c] || '•'} &nbsp;${e(label(c))}</button>`).join('') + '<span class="nav-note">Novas ofertas toda semana</span>';
  $('#category-pills').innerHTML = cats.map((c) => `<button class="${state.category === c ? 'selected' : ''}" data-action="category" data-value="${e(c)}" aria-pressed="${state.category === c}">${e(label(c))}</button>`).join('');
  const shown = filterProducts(state.products, state);
  $('#catalog-title').textContent = state.category === ALL ? 'Destaques da loja' : state.category;
  $('#result-count').textContent = shown.length === 1 ? '1 produto encontrado.' : `${shown.length} produtos encontrados.`;
  $('#grid').innerHTML = shown.map(productCard).join('') ||
    `<div class="empty-state">${state.category === FAVORITES ? 'Você ainda não favoritou nenhum produto.' : 'Nenhum produto encontrado. Tente outra busca.'}${state.query ? ' <button class="text-button" data-action="clearSearch">Limpar busca</button>' : ''}</div>`;
}
function renderCartBadge() { $('#cart-count').textContent = cartCount(cart); }
function refresh() { persist(); renderCatalog(); renderCartBadge(); }

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Modal acessível ---------- */
let lastFocus = null;
const overlay = () => $('#overlay');
const isOpen = () => overlay().classList.contains('show');
function openModal(html, labelId = 'modal-title') {
  const ov = overlay();
  if (!isOpen()) lastFocus = document.activeElement;
  ov.innerHTML = html.replace('<section class="modal', `<section role="dialog" aria-modal="true" aria-labelledby="${labelId}" class="modal`);
  ov.classList.add('show'); document.body.classList.add('no-scroll');
  const first = $('input,textarea,select,button:not(.modal-close)', ov) || $('.modal-close', ov);
  (first || ov).focus?.({ preventScroll: true });
}
function closeModal() {
  if (!isOpen()) return;
  overlay().classList.remove('show'); overlay().innerHTML = '';
  document.body.classList.remove('no-scroll');
  lastFocus?.focus?.({ preventScroll: true }); lastFocus = null;
}
const closeBtn = '<button class="modal-close" data-action="closeModal" aria-label="Fechar">×</button>';

/* ---------- Carrinho ---------- */
function showCart() {
  const items = cartItems(cart, state.products);
  openModal(`<section class="modal">${closeBtn}<span class="eyebrow">SUA SACOLA</span><h2 id="modal-title">Carrinho de compras</h2>
  <div class="cart-lines">${items.map((p) => `<div class="cart-line"><span class="cart-emoji" style="background:${e(p.color)}" aria-hidden="true">${p.images?.length ? `<img src="${e(thumbOf(p.images[0]))}" alt="">` : e(p.emoji)}</span>
    <div class="cart-item-info"><b>${e(p.name)}</b><small>${hasPrice(p) ? money(p.price) : 'Preço a consultar'}</small>
    <div class="qty"><button data-action="qty" data-id="${p.id}" data-delta="-1" aria-label="Diminuir quantidade">−</button><span aria-live="polite">${p.qty}</span><button data-action="qty" data-id="${p.id}" data-delta="1" aria-label="Aumentar quantidade">+</button>
    <button class="remove-link" data-action="remove" data-id="${p.id}">Remover</button></div></div><strong>${hasPrice(p) ? money(p.price * p.qty) : '—'}</strong></div>`).join('') || '<div class="empty-state">Seu carrinho está vazio.</div>'}</div>
  <div class="cart-total"><span>Subtotal</span><b>${money(cartTotal(cart, state.products))}</b></div>
  <p class="fine-print">${cartHasUnpriced(cart, state.products) ? 'Itens “consulte o preço” não entram no subtotal: a loja informa o valor no atendimento. ' : ''}Frete e entrega serão combinados com a loja.</p>
  <button class="primary-button" ${items.length ? '' : 'disabled'} data-action="checkout">Continuar para o pedido →</button>
  <button class="text-button" data-action="closeModal">Continuar comprando</button></section>`);
}

function showProduct(id) {
  const p = state.products.find((x) => x.id === id); if (!p) return;
  const pct = discountPct(p);
  const imgs = p.images || [];
  const gallery = imgs.length
    ? `<div class="detail-photo" style="background:${e(p.color)}"><img id="detail-main" src="${e(imgs[0])}" alt="${e(p.name)}"></div>${imgs.length > 1 ? `<div class="detail-thumbs">${imgs.map((src, i) => `<button class="${i ? '' : 'active'}" data-action="gallery" data-src="${e(src)}" aria-label="Ver foto ${i + 1}"><img src="${e(thumbOf(src))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`
    : `<div class="detail-visual" style="background:${e(p.color)}" aria-hidden="true">${e(p.emoji)}</div>`;
  openModal(`<section class="modal product-modal">${closeBtn}${gallery}
  <span class="product-category">${e(p.category)}</span><h2 id="modal-title">${e(p.name)}</h2>
  <p class="modal-intro">${e(p.desc) || 'Sem descrição.'}</p>
  <div class="prices">${priceHtml(p)}${pct ? `<span class="off inline">-${pct}%</span>` : ''}</div>
  <button class="primary-button" data-action="addClose" data-id="${p.id}">＋ Adicionar ao carrinho</button></section>`);
}

function showCheckout() {
  if (!cartCount(cart)) return showCart();
  openModal(`<section class="modal">${closeBtn}<span class="eyebrow">QUASE LÁ</span><h2 id="modal-title">Finalizar pedido</h2>
  <p class="modal-intro">Preencha seus dados para registrar o pedido. A loja combinará a entrega e o pagamento via Pix com você${CONFIG.whatsappNumber ? ' pelo WhatsApp' : ''}.</p>
  <form id="checkout-form" class="checkout-form" novalidate>
    <label>Nome completo<input name="name" required minlength="3" maxlength="80" autocomplete="name" placeholder="Seu nome"><small class="field-error" data-for="name"></small></label>
    <label>WhatsApp com DDD<input name="phone" required inputmode="tel" autocomplete="tel" maxlength="16" placeholder="(83) 99999-9999"><small class="field-error" data-for="phone"></small></label>
    <label>Cidade e bairro<input name="address" required maxlength="120" autocomplete="street-address" placeholder="Onde deseja receber?"><small class="field-error" data-for="address"></small></label>
    <label>Observações (opcional)<textarea name="notes" maxlength="300" placeholder="Referência, preferência de entrega..."></textarea></label>
    <div class="checkout-total"><span>Total estimado${cartHasUnpriced(cart, state.products) ? ' (sem itens a consultar)' : ''}</span><b>${money(cartTotal(cart, state.products))}</b></div>
    <div class="pix-note" aria-hidden="false"><span aria-hidden="true">🔑</span><span><b>Pagamento via Pix</b><small>${CONFIG.pixKey ? `Chave Pix: ${e(CONFIG.pixKey)}` : 'A chave Pix será enviada pela loja no atendimento.'}</small></span></div>
    <button class="primary-button" type="submit">${CONFIG.whatsappNumber ? 'Enviar pedido pelo WhatsApp' : 'Registrar pedido'}</button></form></section>`);
}

function submitCheckout(form) {
  const data = Object.fromEntries(new FormData(form));
  const errors = validateCheckout(data, isValidPhoneBR);
  form.querySelectorAll('.field-error').forEach((el) => { el.textContent = errors[el.dataset.for] || ''; });
  const bad = Object.keys(errors)[0];
  if (bad) { form.elements[bad].focus(); return; }
  const customer = { name: data.name.trim(), phone: data.phone.trim(), address: data.address.trim(), notes: String(data.notes || '').trim() };
  let order;
  try { order = createOrder({ cart, products: state.products, customer }); } catch { return showCart(); }
  const orders = storage.get(KEYS.orders, []);
  storage.set(KEYS.orders, [order, ...(Array.isArray(orders) ? orders : [])].slice(0, 200));
  const text = buildOrderText(order, { storeName: CONFIG.storeName, pixKey: CONFIG.pixKey });
  cart = {}; refresh();
  const wa = CONFIG.whatsappNumber ? buildWhatsAppUrl(CONFIG.whatsappNumber, text) : '';
  lastOrderText = text;
  openModal(`<section class="modal success-modal"><div class="success-icon" aria-hidden="true">✓</div><h2 id="modal-title">Pedido registrado!</h2>
  <p>Seu pedido <b>${e(order.number)}</b> foi registrado${wa ? '. Envie-o à loja pelo WhatsApp para confirmar.' : ' neste navegador. Copie o resumo e envie à loja para confirmar o pagamento e a entrega.'}</p>
  <div class="checkout-total"><span>Total</span><b>${money(order.total)}</b></div>
  ${wa ? `<a class="primary-button link-button" href="${e(wa)}" target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>` : '<button class="primary-button" data-action="copyOrder">Copiar resumo do pedido</button>'}
  <button class="text-button" data-action="closeModal">Voltar à loja</button></section>`);
}
let lastOrderText = '';

/* ---------- Admin (demonstração, local) ---------- */
function showAdmin() {
  const orders = storage.get(KEYS.orders, []);
  openModal(`<section class="modal admin-modal">${closeBtn}<span class="eyebrow">ÁREA DE DEMONSTRAÇÃO</span><h2 id="modal-title">Gerenciar produtos</h2>
  <p class="modal-intro">Esta versão salva as alterações somente neste navegador. Antes de vender de verdade, proteja o painel com login e banco de dados.</p>
  <form id="product-form" class="checkout-form"><label>Nome do produto<input name="name" required maxlength="80" placeholder="Ex.: Camiseta básica"></label>
  <div class="form-two"><label>Preço (R$) — vazio = consultar<input name="price" type="number" min="0" step="0.01" placeholder="49.90"></label><label>Preço antigo (opcional)<input name="oldPrice" type="number" min="0" step="0.01" placeholder="69.90"></label></div>
  <div class="form-two"><label>Categoria<input name="category" list="cat-list" maxlength="30" value="Outros"><datalist id="cat-list">${[...BASE_CATEGORIES, 'Outros'].map((c) => `<option value="${e(c)}">`).join('')}</datalist></label><label>Emoji/ícone<input name="emoji" maxlength="8" value="📦"></label></div>
  <div class="form-two"><label>Cor de fundo<input name="color" type="color" value="#e8efff"></label><label>Descrição<input name="desc" maxlength="200" placeholder="Descrição breve"></label></div>
  <button class="primary-button" type="submit">Adicionar produto</button></form>
  <h3 class="admin-subtitle">Produtos cadastrados (${state.products.length})</h3>
  <div class="admin-products">${state.products.map((p) => `<div><span>${e(p.emoji)} ${e(p.name)}</span><b>${hasPrice(p) ? money(p.price) : 'consultar'}</b><button data-action="deleteProduct" data-id="${p.id}" aria-label="Excluir ${e(p.name)}">×</button></div>`).join('')}</div>
  <div class="admin-actions"><button class="text-button" data-action="exportOrders">Exportar pedidos (${orders.length}) em JSON</button><button class="text-button" data-action="resetCatalog">Restaurar catálogo de demonstração</button></div></section>`);
}

function addProduct(form) {
  const d = Object.fromEntries(new FormData(form));
  const p = sanitizeProduct({ ...d, price: d.price === '' ? 0 : d.price, id: Date.now(), tag: 'NOVO' });
  if (!p) return toast('Confira nome e preço do produto.');
  state.products.push(p); refresh(); showAdmin(); toast('Produto cadastrado!');
}
function exportOrders() {
  const blob = new Blob([JSON.stringify(storage.get(KEYS.orders, []), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'elenilson-store-pedidos.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Ações (delegação de eventos) ---------- */
const MAX = CONFIG.maxQtyPerItem;
function addToCart(id) {
  if (!state.products.some((p) => p.id === id)) return false;
  if ((cart[id] || 0) >= MAX) { toast(`Limite de ${MAX} unidades por produto.`); return false; }
  cart[id] = (cart[id] || 0) + 1; refresh(); return true;
}
const actions = {
  category: (el) => { state.category = el.dataset.value; renderCatalog(); },
  add: (el) => { if (addToCart(Number(el.dataset.id))) toast('Produto adicionado ao carrinho!'); },
  addClose: (el) => { if (addToCart(Number(el.dataset.id))) { closeModal(); toast('Produto adicionado ao carrinho!'); } },
  fav: (el) => {
    const id = Number(el.dataset.id);
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    refresh();
  },
  view: (el) => showProduct(Number(el.dataset.id)),
  gallery: (el) => {
    $('#detail-main').src = el.dataset.src;
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === el));
  },
  openCart: showCart,
  checkout: showCheckout,
  qty: (el) => {
    const id = Number(el.dataset.id), next = (cart[id] || 0) + Number(el.dataset.delta);
    if (next > MAX) return toast(`Limite de ${MAX} unidades por produto.`);
    next <= 0 ? delete cart[id] : (cart[id] = next); refresh(); showCart();
  },
  remove: (el) => { delete cart[Number(el.dataset.id)]; refresh(); showCart(); },
  openAdmin: showAdmin,
  deleteProduct: (el) => {
    const id = Number(el.dataset.id);
    if (!confirm('Excluir este produto?')) return;
    state.products = state.products.filter((p) => p.id !== id); delete cart[id]; state.favorites.delete(id); refresh(); showAdmin();
  },
  resetCatalog: () => {
    if (!confirm('Restaurar o catálogo de demonstração? Seus produtos cadastrados serão removidos.')) return;
    state.products = structuredClone(initialProducts); cart = sanitizeCart(cart, state.products, MAX); refresh(); showAdmin();
  },
  exportOrders,
  copyOrder: async () => {
    try { await navigator.clipboard.writeText(lastOrderText); toast('Resumo copiado!'); } catch { toast('Não foi possível copiar. Selecione o texto manualmente.'); }
  },
  clearSearch: () => { state.query = ''; $('#search').value = ''; renderCatalog(); },
  scroll: (el) => $(el.dataset.target)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
  toast: (el) => toast(el.dataset.msg),
  closeModal,
  overlay: (el, ev) => { if (ev.target === el) closeModal(); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  // o coração fica dentro do card clicável: não abrir detalhes ao favoritar
  if (el.dataset.action === 'view' && ev.target.closest('[data-action="fav"]')) return;
  actions[el.dataset.action]?.(el, ev);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') return closeModal();
  const el = ev.target;
  if ((ev.key === 'Enter' || ev.key === ' ') && el.matches?.('[role="button"][data-action]')) { ev.preventDefault(); actions[el.dataset.action]?.(el, ev); }
  if (ev.key === 'Tab' && isOpen()) { // focus trap
    const f = [...overlay().querySelectorAll('button:not([disabled]),a[href],input,select,textarea')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
});
document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (f.id === 'checkout-form') submitCheckout(f);
  else if (f.id === 'product-form') addProduct(f);
  else if (f.id === 'search-form') { state.query = f.elements.q.value; renderCatalog(); }
});
let searchTimer;
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = t.value; renderCatalog(); }, 150); }
  else if (t.name === 'phone' && t.form?.id === 'checkout-form') t.value = formatPhoneBR(t.value);
});
document.addEventListener('change', (ev) => { if (ev.target.id === 'sort') { state.sort = ev.target.value; renderCatalog(); } });
// sincroniza entre abas
window.addEventListener('storage', (ev) => {
  if (![KEYS.cart, KEYS.products, KEYS.favs].includes(ev.key)) return;
  state.products = sanitizeProducts(storage.get(KEYS.products, null)) ?? state.products;
  state.favorites = new Set((storage.get(KEYS.favs, []) || []).map(Number));
  cart = sanitizeCart(storage.get(KEYS.cart, {}), state.products, MAX);
  renderCatalog(); renderCartBadge();
});
window.addEventListener('hashchange', () => { state.admin = location.hash === '#admin'; $('#admin-btn').hidden = !state.admin; });

/* ---------- Início ---------- */
renderShell();
$('#admin-btn').hidden = !state.admin;
renderCatalog();
renderCartBadge();
