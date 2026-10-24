import './style.css';
import { CONFIG } from './config.js';
import { initialProducts, ALL, FAVORITES, CATALOG_VERSION, CATALOG_UPDATES } from './lib/data.js';
import { escapeHtml as e, money, formatPhoneBR, isValidPhoneBR, discountPct, createStorage, buildOrderText, buildWhatsAppUrl } from './lib/utils.js';
import { sanitizeProducts, mergeCatalog, interleaveByCategory, sanitizeCart, cartCount, cartItems, cartTotal, cartHasUnpriced, hasPrice, thumbOf, getCategories, filterProducts, createOrder, validateCheckout } from './lib/logic.js';
import { backend, settings, applySettings, api, fetchCatalog } from './lib/backend.js';
import { resolveSrc, preloadLocalImages } from './lib/images.js';

const storage = createStorage();
export const KEYS = { products: 'es_products_v3', cart: 'es_cart', favs: 'es_favs', orders: 'es_orders', settings: 'es_settings', cache: 'es_catalog_cache' };
const MAX = CONFIG.maxQtyPerItem;

/* ---------- Estado ---------- */
const cache = storage.get(KEYS.cache, null);
applySettings({ ...storage.get(KEYS.settings, {}), ...(cache?.settings || {}) });
const state = {
  // 1ª pintura: último catálogo do servidor (cache) → edições locais → catálogo inicial
  products: (cache?.seeded && sanitizeProducts(cache.products)) || sanitizeProducts(storage.get(KEYS.products, null)) || structuredClone(initialProducts),
  favorites: new Set((storage.get(KEYS.favs, []) || []).map(Number)),
  category: ALL,
  query: '',
  sort: 'featured',
};
if (!state.products.length && !cache?.seeded) state.products = structuredClone(initialProducts);
let cart = sanitizeCart(storage.get(KEYS.cart, {}), state.products, MAX);

const persist = () => {
  if (backend.mode === 'local') storage.set(KEYS.products, state.products);
  storage.set(KEYS.cart, cart);
  storage.set(KEYS.favs, [...state.favorites]);
};
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const imgUrl = (src, thumb = false) => e(resolveSrc(thumb ? thumbOf(src) : src));

/* ---------- Identidade visual editável (nome, aviso, texto de abertura) ---------- */
function brandHtml(name) {
  const [first, ...rest] = String(name).trim().split(/\s+/);
  return `<span class="brand-mark" aria-hidden="true">${e((first || 'L')[0].toUpperCase())}</span><span>${e(first.toLowerCase())}${rest.length ? `<span class="brand-store">${e(rest.join(' ').toUpperCase())}</span>` : ''}</span>`;
}
export function applyBranding() {
  const name = settings.storeName;
  document.title = `${name} | Ofertas para você`;
  $('#announcement').textContent = settings.announcement;
  $('#announcement').hidden = !settings.announcement;
  $('#hero-text').textContent = settings.heroText;
  $('#hero-eyebrow').textContent = `BEM-VINDO À ${name.toUpperCase()}`;
  $('#footer-copy').textContent = `© ${new Date().getFullYear()} ${name}. Todos os direitos reservados.`;
  $('#news-btn').dataset.msg = `Obrigado por visitar a ${name}!`;
  for (const el of document.querySelectorAll('.brand')) { el.innerHTML = brandHtml(name); el.setAttribute('aria-label', `${name} — início`); }
  const wa = $('#wa-float');
  wa.hidden = !settings.whatsappNumber;
  if (settings.whatsappNumber) wa.href = buildWhatsAppUrl(settings.whatsappNumber, `Olá! Vim pelo site da ${name} e gostaria de uma informação.`);
}

/* ---------- Shell (renderizado uma única vez) ---------- */
function renderShell() {
  app.innerHTML = `
  <a class="skip-link" href="#catalogo">Pular para os produtos</a>
  <div class="announcement" id="announcement"></div>
  <header class="header">
    <button class="menu-btn" data-action="scroll" data-target=".category-nav" aria-label="Ir para categorias">☰</button>
    <a class="brand" href="#top"></a>
    <form class="search" role="search" id="search-form"><span aria-hidden="true">⌕</span>
      <input id="search" type="search" name="q" placeholder="O que você está procurando?" aria-label="Buscar produtos" autocomplete="off" maxlength="60">
      <button type="submit">Buscar</button></form>
    <div class="header-actions">
      <button class="cart-button" data-action="openCart" aria-label="Abrir carrinho">🛒 <span class="cart-label">Carrinho</span><b id="cart-count">0</b></button>
    </div>
  </header>
  <nav class="category-nav" aria-label="Categorias" id="category-nav"></nav>
  <main id="top">
    <section class="hero"><div class="hero-copy"><span class="eyebrow" id="hero-eyebrow"></span>
      <h1>Boas escolhas.<br><em>Melhores ofertas.</em></h1>
      <p id="hero-text"></p>
      <button class="hero-cta" data-action="scroll" data-target="#catalogo">Explorar produtos <span aria-hidden="true">→</span></button>
      <div class="hero-benefits"><span>✓ Compra prática</span><span>✓ Pagamento via Pix</span></div></div>
      <div class="hero-art photos" id="hero-art"></div></section>
    <section class="cat-tiles-wrap" aria-labelledby="cat-tiles-title"><div class="row-head"><h2 id="cat-tiles-title">Compre por categoria</h2></div><div class="cat-tiles" id="cat-tiles"></div></section>
    <section class="benefit-row" aria-label="Vantagens">
      <div><span class="benefit-icon" aria-hidden="true">🚚</span><span><b>Entrega combinada</b><small>Consulte opções no pedido</small></span></div>
      <div><span class="benefit-icon" aria-hidden="true">🔒</span><span><b>Compra com tranquilidade</b><small>Atendimento direto</small></span></div>
      <div><span class="benefit-icon" aria-hidden="true">⚡</span><span><b>Pagamento via Pix</b><small>Simples e prático</small></span></div>
      <div><span class="benefit-icon" aria-hidden="true">💬</span><span><b>Fale com a loja</b><small>Atendimento personalizado</small></span></div></section>
    <section class="new-arrivals" id="new-arrivals" aria-labelledby="new-title" hidden><div class="row-head"><div><span class="eyebrow">ACABARAM DE CHEGAR</span><h2 id="new-title">Novidades na loja</h2></div><div class="row-arrows"><button class="arrow" data-action="slide" data-dir="-1" aria-label="Anteriores">‹</button><button class="arrow" data-action="slide" data-dir="1" aria-label="Próximos">›</button></div></div><div class="new-track" id="new-track"></div></section>
    <section class="catalog" id="catalogo">
      <div class="section-heading"><div><span class="eyebrow">ESCOLHA O SEU PRÓXIMO FAVORITO</span><h2 id="catalog-title">Destaques da loja</h2><p id="result-count" aria-live="polite"></p></div>
        <label class="sort-label">Ordenar por <select id="sort"><option value="featured">Destaques</option><option value="price-up">Menor preço</option><option value="price-down">Maior preço</option><option value="discount">Maior desconto</option></select></label></div>
      <div class="category-pills" id="category-pills"></div>
      <div class="product-grid" id="grid"></div>
    </section>
    <section class="newsletter"><div><span class="eyebrow">FIQUE POR DENTRO</span><h2>Ofertas que valem a pena.</h2><p>Salve nossa loja e volte sempre para conferir as novidades.</p></div>
      <button id="news-btn" data-action="toast">Quero ver novidades ↗</button></section>
  </main>
  <footer><a class="brand footer-brand" href="#top"></a><p>Seu próximo achadinho está aqui.</p>
    <div class="footer-bottom"><span id="footer-copy"></span><span>Pagamento via Pix · Atendimento ao cliente</span></div></footer>
  <a class="wa-float" id="wa-float" href="#" target="_blank" rel="noopener noreferrer" aria-label="Falar com a loja no WhatsApp" hidden><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2.1 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.6l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.8C5.1 9.9 10 5.2 16 5.2s10.9 4.7 10.9 10.6S22 26.4 16 26.4zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.7.2l-1 1.3c-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 .8.4 1.4.6 1.9.7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z"/></svg></a>
  <nav class="bottom-nav" aria-label="Navegação principal">
    <button data-action="home" aria-label="Início"><span class="ico" aria-hidden="true">⌂</span>Início</button>
    <button data-action="cats" aria-label="Categorias"><span class="ico" aria-hidden="true">☷</span>Categorias</button>
    <button data-action="focusSearch" aria-label="Buscar"><span class="ico" aria-hidden="true">⌕</span>Buscar</button>
    <button data-action="favs" aria-label="Favoritos"><span class="ico" aria-hidden="true">♡</span>Favoritos<b class="nav-badge" id="fav-count" hidden></b></button>
    <button data-action="openCart" aria-label="Carrinho"><span class="ico" aria-hidden="true">🛒</span>Carrinho<b class="nav-badge" id="cart-count-nav" hidden></b></button>
  </nav>
  <div id="overlay" class="overlay" data-action="overlay"></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

/* ---------- Partes dinâmicas ---------- */
const ICONS = { [ALL]: '☷', Perfumes: '❦', Acessórios: '✿', Relógios: '◷', Eletrônicos: '▣', Moda: '♧', Beleza: '✧', 'Bem-estar': '✚', Natural: '❀', Casa: '⌂', [FAVORITES]: '♥' };
const priceHtml = (p) => (hasPrice(p) ? `<strong>${money(p.price)}</strong>${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ''}` : '<strong class="ask">Consulte o preço</strong>');
const visual = (p) => (p.images?.length ? `<img src="${imgUrl(p.images[0], true)}" alt="${e(p.name)}" loading="lazy" decoding="async" width="360" height="480">` : `<span class="product-emoji" aria-hidden="true">${e(p.emoji)}</span>`);

function productCard(p) {
  const pct = discountPct(p);
  const fav = state.favorites.has(p.id);
  const inCart = cart[p.id] || 0;
  return `<article class="product-card ${p.soldOut ? 'sold-out' : ''}">
    <div class="product-visual ${p.images?.length ? 'has-img' : ''}" style="--product-bg:${e(p.color)}" data-action="view" data-id="${p.id}" role="button" tabindex="0" aria-label="Ver detalhes de ${e(p.name)}">
      ${p.soldOut ? '<span class="tag soldout-tag">ESGOTADO</span>' : p.tag ? `<span class="tag ${p.tag === 'NOVO' ? 'tag-new' : ''}">${e(p.tag)}</span>` : ''}${pct && !p.soldOut ? `<span class="off">-${pct}%</span>` : ''}
      <button class="heart ${fav ? 'active' : ''}" data-action="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos' : 'Adicionar aos'} favoritos">${fav ? '♥' : '♡'}</button>
      ${visual(p)}</div>
    <div class="product-info"><span class="product-category">${e(p.category)}</span><h3>${e(p.name)}</h3>
      <div class="prices">${priceHtml(p)}</div>
      <p class="installment">${hasPrice(p) ? 'Pagamento via Pix' : 'Peça e receba o valor no atendimento'}</p>
      <button class="add-button" data-action="add" data-id="${p.id}" ${p.soldOut ? 'disabled' : ''}>${p.soldOut ? 'Esgotado' : `＋ Adicionar ao carrinho${inCart ? ` (${inCart})` : ''}`}</button></div></article>`;
}

function renderCatalog() {
  const cats = getCategories(state.products.filter((p) => p.active !== false));
  if (!cats.includes(state.category)) state.category = ALL;
  const favCount = state.favorites.size;
  const label = (c) => (c === FAVORITES ? `${FAVORITES}${favCount ? ` (${favCount})` : ''}` : c);
  $('#category-nav').innerHTML = cats.map((c) => `<button class="${state.category === c ? 'active' : ''}" data-action="category" data-value="${e(c)}" aria-pressed="${state.category === c}">${ICONS[c] || '•'} &nbsp;${e(label(c))}</button>`).join('') + '<span class="nav-note">Novas ofertas toda semana</span>';
  $('#category-pills').innerHTML = cats.map((c) => `<button class="${state.category === c ? 'selected' : ''}" data-action="category" data-value="${e(c)}" aria-pressed="${state.category === c}">${e(label(c))}</button>`).join('');
  const shown = filterProducts(state.products, state);
  renderHighlights();
  $('#catalog-title').textContent = state.category === ALL ? 'Destaques da loja' : state.category;
  $('#result-count').textContent = shown.length === 1 ? '1 produto encontrado.' : `${shown.length} produtos encontrados.`;
  $('#grid').innerHTML = shown.map(productCard).join('') ||
    `<div class="empty-state">${state.category === FAVORITES ? 'Você ainda não favoritou nenhum produto.' : 'Nenhum produto encontrado. Tente outra busca.'}${state.query ? ' <button class="text-button" data-action="clearSearch">Limpar busca</button>' : ''}</div>`;
}
/* ---------- Vitrines: banner com fotos reais, categorias com foto e novidades ---------- */
const HERO_ORDER = ['Perfumes', 'Relógios', 'Beleza', 'Acessórios', 'Natural', 'Bem-estar', 'Eletrônicos', 'Moda', 'Casa'];
function renderHighlights() {
  const visible = state.products.filter((p) => p.active !== false && p.images?.length);
  // banner: 3 produtos de categorias diferentes, preferindo novidades
  const picks = [];
  for (const cat of HERO_ORDER) {
    const inCat = visible.filter((p) => p.category === cat && !p.soldOut);
    const p = inCat.find((x) => x.tag === 'NOVO' && x.price > 0) || inCat.find((x) => x.tag === 'NOVO') || inCat[0];
    if (p) picks.push(p);
    if (picks.length === 3) break;
  }
  $('#hero-art').innerHTML = picks.map((p, i) => `<button class="hero-photo hp-${i}" data-action="view" data-id="${p.id}" aria-label="Ver ${e(p.name)}">
    <img src="${imgUrl(p.images[0], true)}" alt="" width="360" height="480" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
    <span class="hp-label"><b>${e(p.name.split(' — ')[0])}</b><i>${hasPrice(p) ? money(p.price) : 'Consulte'}</i></span></button>`).join('');
  // categorias com foto
  const cats = getCategories(state.products.filter((p) => p.active !== false)).filter((c) => c !== ALL && c !== FAVORITES);
  $('#cat-tiles').innerHTML = cats.map((c) => {
    const list = visible.filter((p) => p.category === c);
    const cover = list.find((p) => p.tag !== 'NOVO') || list[0];
    const n = state.products.filter((p) => p.active !== false && p.category === c).length;
    return `<button class="cat-tile ${state.category === c ? 'active' : ''}" data-action="pickCat" data-value="${e(c)}">
      <span class="ct-img">${cover ? `<img src="${imgUrl(cover.images[0], true)}" alt="" loading="lazy" width="120" height="160">` : `<i>${ICONS[c] || '•'}</i>`}</span>
      <b>${e(c)}</b><small>${n} ${n === 1 ? 'item' : 'itens'}</small></button>`;
  }).join('');
  // novidades
  const fresh = interleaveByCategory(state.products.filter((p) => p.active !== false && p.tag === 'NOVO')).slice(0, 16);
  $('#new-arrivals').hidden = !fresh.length;
  $('#new-track').innerHTML = fresh.map((p) => `<article class="mini-card">
    <button class="mini-visual" data-action="view" data-id="${p.id}" style="--product-bg:${e(p.color)}" aria-label="Ver ${e(p.name)}">${visual(p)}<span class="tag tag-new">NOVO</span></button>
    <div class="mini-info"><span class="product-category">${e(p.category)}</span><h3>${e(p.name)}</h3><div class="prices">${priceHtml(p)}</div>
    <button class="mini-add" data-action="add" data-id="${p.id}" ${p.soldOut ? 'disabled' : ''} aria-label="Adicionar ${e(p.name)} ao carrinho">${p.soldOut ? 'Esgotado' : '＋ Adicionar'}</button></div></article>`).join('');
}

function renderCartBadge() {
  const n = cartCount(cart);
  $('#cart-count').textContent = n;
  const nav = $('#cart-count-nav'); nav.textContent = n; nav.hidden = !n;
  const fav = $('#fav-count'); fav.textContent = state.favorites.size; fav.hidden = !state.favorites.size;
}
/** Pequena animação no ícone do carrinho ao adicionar (feedback tátil visual). */
function bumpCart() {
  for (const el of document.querySelectorAll('#cart-count, #cart-count-nav')) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  navigator.vibrate?.(12);
}
function refresh() { persist(); renderCatalog(); renderCartBadge(); }

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Modal acessível ---------- */
let lastFocus = null;
let modalInHistory = false; // há uma entrada no histórico representando o modal aberto?
const overlay = () => $('#overlay');
const isOpen = () => overlay().classList.contains('show');
const coarse = matchMedia('(pointer: coarse)');
/** url: endereço a mostrar enquanto o modal está aberto (ex.: ?p=ID para link direto do produto). */
function openModal(html, labelId = 'modal-title', url = null) {
  const ov = overlay();
  if (!isOpen()) {
    lastFocus = document.activeElement;
    try { history.pushState({ esModal: true }, '', url ?? location.href); modalInHistory = true; } catch { modalInHistory = false; }
  } else if (url && modalInHistory) {
    try { history.replaceState({ esModal: true }, '', url); } catch { /* ignore */ }
  }
  ov.innerHTML = html.replace('<section class="modal', `<section role="dialog" aria-modal="true" aria-labelledby="${labelId}" class="modal`);
  ov.classList.add('show'); document.body.classList.add('no-scroll');
  // no celular não foca campos automaticamente (abriria o teclado por cima da tela)
  const first = coarse.matches ? $('.modal-close', ov) : ($('input,textarea,select,button:not(.modal-close)', ov) || $('.modal-close', ov));
  (first || ov).focus?.({ preventScroll: true });
}
function hideModal() {
  if (!isOpen()) return;
  overlay().classList.remove('show'); overlay().innerHTML = '';
  document.body.classList.remove('no-scroll');
  lastFocus?.focus?.({ preventScroll: true }); lastFocus = null;
}
/** Fechar pela interface volta uma entrada no histórico; o evento popstate é quem esconde o modal. */
function closeModal() {
  if (!isOpen()) return;
  if (modalInHistory) { modalInHistory = false; history.back(); } else hideModal();
}
window.addEventListener('popstate', () => { modalInHistory = false; hideModal(); });
const closeBtn = '<button class="modal-close" data-action="closeModal" aria-label="Fechar">×</button>';

/* ---------- Carrinho ---------- */
function showCart() {
  const items = cartItems(cart, state.products);
  openModal(`<section class="modal">${closeBtn}<span class="eyebrow">SUA SACOLA</span><h2 id="modal-title">Carrinho de compras</h2>
  <div class="cart-lines">${items.map((p) => `<div class="cart-line"><span class="cart-emoji" style="background:${e(p.color)}" aria-hidden="true">${p.images?.length ? `<img src="${imgUrl(p.images[0], true)}" alt="">` : e(p.emoji)}</span>
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
    ? `<div class="detail-photo" style="background:${e(p.color)}"><div class="detail-track" id="detail-track">${imgs.map((src, i) => `<img src="${imgUrl(src)}" alt="${e(p.name)}${imgs.length > 1 ? ` — foto ${i + 1} de ${imgs.length}` : ''}" ${i ? 'loading="lazy"' : ''} draggable="false">`).join('')}</div>
      ${imgs.length > 1 ? `<div class="detail-dots" aria-hidden="true">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>
      ${imgs.length > 1 ? `<div class="detail-thumbs">${imgs.map((src, i) => `<button class="${i ? '' : 'active'}" data-action="gallery" data-index="${i}" aria-label="Ver foto ${i + 1}"><img src="${imgUrl(src, true)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`
    : `<div class="detail-visual" style="background:${e(p.color)}" aria-hidden="true">${e(p.emoji)}</div>`;
  openModal(`<section class="modal product-modal">${closeBtn}${gallery}
  <div class="detail-head"><span class="product-category">${e(p.category)}</span>
    <button class="share-btn" data-action="share" data-id="${p.id}" aria-label="Compartilhar produto">↗ Compartilhar</button></div>
  <h2 id="modal-title">${e(p.name)}</h2>
  <p class="modal-intro">${e(p.desc) || 'Sem descrição.'}</p>
  <div class="prices">${priceHtml(p)}${pct ? `<span class="off inline">-${pct}%</span>` : ''}</div>
  <div class="sheet-cta"><button class="primary-button" data-action="addClose" data-id="${p.id}" ${p.soldOut ? 'disabled' : ''}>${p.soldOut ? 'Esgotado' : '＋ Adicionar ao carrinho'}</button></div></section>`,
  'modal-title', productUrl(p.id));
  const track = $('#detail-track');
  track?.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    overlay().querySelectorAll('.detail-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    overlay().querySelectorAll('.detail-thumbs button').forEach((b, k) => b.classList.toggle('active', k === i));
  }, { passive: true });
}
const productUrl = (id) => `${location.pathname}?p=${id}`;

/** Lista de categorias em tela de baixo para cima (celular). */
function showCategories() {
  const visible = state.products.filter((p) => p.active !== false);
  const count = (c) => (c === ALL ? visible.length : c === FAVORITES ? state.favorites.size : visible.filter((p) => p.category === c).length);
  openModal(`<section class="modal cats-modal">${closeBtn}<h2 id="modal-title">Categorias</h2>
  <div class="cat-list">${getCategories(visible).map((c) => `<button class="${state.category === c ? 'active' : ''}" data-action="pickCat" data-value="${e(c)}"><span class="cat-ico" aria-hidden="true">${ICONS[c] || '•'}</span><span>${e(c)}</span><small>${count(c)}</small></button>`).join('')}</div></section>`);
}

/** Compartilhar: menu nativo do celular; senão, copia o link. */
async function shareProduct(id) {
  const p = state.products.find((x) => x.id === id); if (!p) return;
  const url = new URL(productUrl(id), location.origin).href;
  const text = `${p.name}${hasPrice(p) ? ` por ${money(p.price)}` : ''} na ${settings.storeName}`;
  try {
    if (navigator.share) { await navigator.share({ title: p.name, text, url }); return; }
    await navigator.clipboard.writeText(`${text}: ${url}`); toast('Link do produto copiado!');
  } catch (err) {
    if (err?.name === 'AbortError') return; // usuário fechou o menu
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, '_blank', 'noopener');
  }
}

function showCheckout() {
  if (!cartCount(cart)) return showCart();
  openModal(`<section class="modal">${closeBtn}<span class="eyebrow">QUASE LÁ</span><h2 id="modal-title">Finalizar pedido</h2>
  <p class="modal-intro">Preencha seus dados para registrar o pedido. A loja combinará a entrega e o pagamento via Pix com você${settings.whatsappNumber ? ' pelo WhatsApp' : ''}.</p>
  <form id="checkout-form" class="checkout-form" novalidate>
    <label>Nome completo<input name="name" required minlength="3" maxlength="80" autocomplete="name" placeholder="Seu nome"><small class="field-error" data-for="name"></small></label>
    <label>WhatsApp com DDD<input name="phone" required inputmode="tel" autocomplete="tel" maxlength="16" placeholder="(83) 99999-9999"><small class="field-error" data-for="phone"></small></label>
    <label>Cidade e bairro<input name="address" required maxlength="120" autocomplete="street-address" placeholder="Onde deseja receber?"><small class="field-error" data-for="address"></small></label>
    <label>Observações (opcional)<textarea name="notes" maxlength="300" placeholder="Referência, preferência de entrega..."></textarea></label>
    <div class="checkout-total"><span>Total estimado${cartHasUnpriced(cart, state.products) ? ' (sem itens a consultar)' : ''}</span><b>${money(cartTotal(cart, state.products))}</b></div>
    <div class="pix-note"><span aria-hidden="true">🔑</span><span><b>Pagamento via Pix</b><small>${settings.pixKey ? `Chave Pix: ${e(settings.pixKey)}` : 'A chave Pix será enviada pela loja no atendimento.'}</small></span></div>
    <small class="field-error form-error" data-for="form"></small>
    <button class="primary-button" type="submit">${settings.whatsappNumber ? 'Enviar pedido pelo WhatsApp' : 'Registrar pedido'}</button></form></section>`);
}

let lastOrderText = '';
async function submitCheckout(form) {
  const data = Object.fromEntries(new FormData(form));
  const showErrors = (errors) => form.querySelectorAll('.field-error').forEach((el) => { el.textContent = errors[el.dataset.for] || ''; });
  const errors = validateCheckout(data, isValidPhoneBR);
  showErrors(errors);
  const bad = Object.keys(errors)[0];
  if (bad) { form.elements[bad].focus(); return; }
  const customer = { name: data.name.trim(), phone: data.phone.trim(), address: data.address.trim(), notes: String(data.notes || '').trim() };
  const button = form.querySelector('[type=submit]');
  button.disabled = true;

  let order, savedOnServer = false;
  if (backend.mode === 'server') {
    try {
      // o servidor recalcula preços e total: mandamos só ids e quantidades
      order = (await api('POST', '/api/orders', { items: Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty })), customer })).order;
      savedOnServer = true;
    } catch (err) {
      if (err.status === 400 || err.status === 429) {
        button.disabled = false;
        showErrors({ ...(err.data?.errors || {}), form: err.status === 429 ? 'Muitos pedidos em pouco tempo. Tente mais tarde.' : (err.data?.errors ? '' : 'Alguns itens mudaram ou ficaram indisponíveis. Reabra o carrinho e confira.') });
        return;
      }
      /* falha de rede: não perder a venda — segue com o pedido montado aqui e envia pelo WhatsApp */
    }
  }
  if (!order) {
    try { order = createOrder({ cart, products: state.products, customer }); } catch { return showCart(); }
    const orders = storage.get(KEYS.orders, []);
    storage.set(KEYS.orders, [order, ...(Array.isArray(orders) ? orders : [])].slice(0, 200));
  }
  const text = buildOrderText(order, { storeName: settings.storeName, pixKey: settings.pixKey });
  cart = {}; refresh();
  const wa = settings.whatsappNumber ? buildWhatsAppUrl(settings.whatsappNumber, text) : '';
  lastOrderText = text;
  const where = savedOnServer ? ' e já está no painel da loja' : ' neste aparelho';
  openModal(`<section class="modal success-modal"><div class="success-icon" aria-hidden="true">✓</div><h2 id="modal-title">Pedido registrado!</h2>
  <p>Seu pedido <b>${e(order.number)}</b> foi registrado${where}${wa ? '. Envie-o à loja pelo WhatsApp para combinar pagamento e entrega.' : '. Copie o resumo e envie à loja para confirmar o pagamento e a entrega.'}</p>
  <div class="checkout-total"><span>Total</span><b>${money(order.total)}</b></div>
  ${wa ? `<a class="primary-button link-button" href="${e(wa)}" target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>` : '<button class="primary-button" data-action="copyOrder">Copiar resumo do pedido</button>'}
  <button class="text-button" data-action="closeModal">Voltar à loja</button></section>`);
}

/* ---------- Ações (delegação de eventos) ---------- */
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
function addToCart(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p || p.active === false || p.soldOut) return false;
  if ((cart[id] || 0) >= MAX) { toast(`Limite de ${MAX} unidades por produto.`); return false; }
  cart[id] = (cart[id] || 0) + 1; refresh(); return true;
}
const actions = {
  category: (el) => { state.category = el.dataset.value; renderCatalog(); },
  add: (el) => { if (addToCart(Number(el.dataset.id))) { bumpCart(); toast('Produto adicionado ao carrinho!'); } },
  addClose: (el) => { if (addToCart(Number(el.dataset.id))) { closeModal(); bumpCart(); toast('Produto adicionado ao carrinho!'); } },
  home: () => { state.category = ALL; renderCatalog(); window.scrollTo({ top: 0, behavior: smooth() }); },
  cats: showCategories,
  pickCat: (el) => { state.category = el.dataset.value; renderCatalog(); closeModal(); setTimeout(() => $('#catalogo').scrollIntoView({ behavior: smooth() }), 60); },
  favs: () => { state.category = FAVORITES; renderCatalog(); $('#catalogo').scrollIntoView({ behavior: smooth() }); },
  focusSearch: () => { window.scrollTo({ top: 0, behavior: smooth() }); $('#search').focus({ preventScroll: true }); },
  share: (el) => shareProduct(Number(el.dataset.id)),
  slide: (el) => { const t = $('#new-track'); t.scrollBy({ left: Number(el.dataset.dir) * t.clientWidth * 0.85, behavior: smooth() }); },
  fav: (el) => {
    const id = Number(el.dataset.id);
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    refresh();
  },
  view: (el) => showProduct(Number(el.dataset.id)),
  gallery: (el) => {
    const track = $('#detail-track');
    track?.scrollTo({ left: Number(el.dataset.index) * track.clientWidth, behavior: smooth() });
  },
  openCart: showCart,
  checkout: showCheckout,
  qty: (el) => {
    const id = Number(el.dataset.id), next = (cart[id] || 0) + Number(el.dataset.delta);
    if (next > MAX) return toast(`Limite de ${MAX} unidades por produto.`);
    next <= 0 ? delete cart[id] : (cart[id] = next); refresh(); showCart();
  },
  remove: (el) => { delete cart[Number(el.dataset.id)]; refresh(); showCart(); },
  copyOrder: async () => {
    try { await navigator.clipboard.writeText(lastOrderText); toast('Resumo copiado!'); } catch { toast('Não foi possível copiar. Selecione o texto manualmente.'); }
  },
  clearSearch: () => { state.query = ''; $('#search').value = ''; renderCatalog(); },
  scroll: (el) => $(el.dataset.target)?.scrollIntoView({ behavior: smooth() }),
  toast: (el) => toast(el.dataset.msg),
  closeModal,
  overlay: (el, ev) => { if (ev.target === el) closeModal(); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('#app [data-action], #overlay [data-action]');
  if (!el) return;
  // o coração fica dentro do card clicável: não abrir detalhes ao favoritar
  if (el.dataset.action === 'view' && ev.target.closest('[data-action="fav"]')) return;
  actions[el.dataset.action]?.(el, ev);
});
document.addEventListener('keydown', (ev) => {
  if (document.body.classList.contains('admin-open')) return; // o painel cuida das próprias teclas
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
  const f = ev.target;
  if (!f.closest('#app, #overlay')) return;
  ev.preventDefault();
  if (f.id === 'checkout-form') submitCheckout(f);
  else if (f.id === 'search-form') { state.query = f.elements.q.value; renderCatalog(); }
});
let searchTimer;
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = t.value; renderCatalog(); }, 150); }
  else if (t.name === 'phone' && t.form?.id === 'checkout-form') t.value = formatPhoneBR(t.value);
});
document.addEventListener('change', (ev) => { if (ev.target.id === 'sort') { state.sort = ev.target.value; renderCatalog(); } });
// sincroniza o carrinho/favoritos entre abas
window.addEventListener('storage', (ev) => {
  if (![KEYS.cart, KEYS.favs].includes(ev.key)) return;
  state.favorites = new Set((storage.get(KEYS.favs, []) || []).map(Number));
  cart = sanitizeCart(storage.get(KEYS.cart, {}), state.products, MAX);
  renderCatalog(); renderCartBadge();
});

/* ---------- Ponte com o painel admin (carregado só quando necessário) ---------- */
const adminContext = {
  state, storage, KEYS, initialProducts,
  toast, applyBranding,
  /** O painel entrega a lista nova de produtos; a loja atualiza vitrine, carrinho e persistência. */
  async setProducts(list) {
    state.products = list;
    cart = sanitizeCart(cart, state.products, MAX);
    if (backend.mode === 'server') storage.set(KEYS.cache, { products: list.filter((p) => p.active !== false), settings: { ...settings }, seeded: true });
    await preloadLocalImages(list);
    refresh();
  },
  saveSettingsLocal(next) { applySettings(next); storage.set(KEYS.settings, { ...settings }); applyBranding(); },
  cacheSettings() { const c = storage.get(KEYS.cache, null); if (c) storage.set(KEYS.cache, { ...c, settings: { ...settings } }); },
};
let adminModule = null;
async function syncAdminRoute() {
  if (location.hash === '#admin') {
    await bootPromise;
    adminModule ??= await import('./admin.js');
    adminModule.openAdmin(adminContext);
  } else adminModule?.closeAdmin();
}
window.addEventListener('hashchange', syncAdminRoute);

/* ---------- Início ---------- */
async function initBackend() {
  try {
    const data = await fetchCatalog();
    backend.mode = 'server';
    Object.assign(backend, { admin: data.admin, seeded: data.seeded });
    applySettings(data.settings);
    // Enquanto o dono não "assumiu" o catálogo no painel, a loja segue com o catálogo inicial do código.
    state.products = data.seeded ? (sanitizeProducts(data.products) ?? []) : structuredClone(initialProducts);
    storage.set(KEYS.cache, { products: state.products, settings: { ...settings }, seeded: data.seeded });
    cart = sanitizeCart(cart, state.products, MAX);
  } catch {
    backend.mode = 'local'; // sem servidor (ou servidor ainda não configurado): usa o navegador
    const saved = storage.get(KEYS.products, null);
    const from = Number(storage.get('es_catalog_version', 1)) || 1;
    if (saved && from < CATALOG_VERSION) {
      state.products = mergeCatalog(state.products, { fromVersion: from, toVersion: CATALOG_VERSION, initial: initialProducts, updates: CATALOG_UPDATES }).products;
    }
    storage.set('es_catalog_version', CATALOG_VERSION);
  }
  applyBranding();
  await preloadLocalImages(state.products);
  refresh();
}

renderShell();
applyBranding();
renderCatalog();
renderCartBadge();
const bootPromise = initBackend();
if (location.hash === '#admin') syncAdminRoute();
else openDeepLink();

/** Quem chega por um link de produto (?p=ID) vê o produto aberto; "voltar" leva para a loja, não para fora. */
async function openDeepLink() {
  const id = Number(new URLSearchParams(location.search).get('p'));
  if (!Number.isInteger(id) || id <= 0) return;
  history.replaceState(null, '', location.pathname);
  await bootPromise;
  if (state.products.some((p) => p.id === id && p.active !== false)) showProduct(id);
  else toast('Este produto não está mais disponível.');
}
