/* Painel administrativo (carregado sob demanda em seusite/#admin). */
import { backend, settings, api, fetchCatalog, applySettings, friendlyError } from './lib/backend.js';
import { sanitizeProduct, sanitizeProducts, ORDER_STATUSES, thumbOf, getCategories } from './lib/logic.js';
import { escapeHtml as e, money, onlyDigits, formatPhoneBR } from './lib/utils.js';
import { processImage, saveLocalImage, resolveSrc } from './lib/images.js';

const MAX_PHOTOS = 8;
let ctx = null, root = null;
const A = { tab: 'products', q: '', cat: '', draft: null, orders: null, orderFilter: '', loading: false };

const $ = (s, r = root) => r.querySelector(s);
const isServer = () => backend.mode === 'server';
const products = () => ctx.state.products;
const parsePrice = (v) => {
  let s = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};
const priceText = (n) => (n > 0 ? n.toFixed(2).replace('.', ',') : '');
const imgSrc = (src, thumb = false) => e(resolveSrc(thumb ? thumbOf(src) : src));

/* ---------- ciclo de vida ---------- */
export function openAdmin(context) {
  ctx = context;
  if (!root) {
    root = document.createElement('div');
    root.id = 'admin-root'; root.className = 'admin-app';
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKey);
    root.addEventListener('dragover', (ev) => { if (ev.target.closest('#adm-imgs')) ev.preventDefault(); });
    root.addEventListener('drop', (ev) => { if (ev.target.closest('#adm-imgs')) { ev.preventDefault(); addFiles(ev.dataTransfer.files); } });
  }
  root.hidden = false;
  document.body.classList.add('admin-open');
  load();
}
export function closeAdmin() {
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove('admin-open');
}

async function load() {
  render('<p class="adm-loading">Carregando…</p>');
  if (!isServer()) { A.orders = ctx.storage.get(ctx.KEYS.orders, []); return renderPanel(); }
  try {
    const d = await fetchCatalog(true);
    backend.admin = d.admin; backend.adminConfigured = d.adminConfigured;
    if (!d.admin) return renderLogin();
    let list = d.products;
    if (!d.seeded) { // 1º acesso: o dono assume o catálogo atual (vira editável e passa a valer para todos)
      list = (await api('POST', '/api/import', { products: ctx.initialProducts, settings })).products;
      backend.seeded = true;
      say('Painel ativado: o catálogo atual agora é editável.');
    }
    applySettings(d.settings);
    await ctx.setProducts(sanitizeProducts(list) ?? []);
    ctx.applyBranding();
    renderPanel();
  } catch (err) { fail(err); }
}

/* ---------- utilidades de UI ---------- */
function render(html) { root.innerHTML = html; }
let sayTimer;
function say(msg, bad = false) {
  let t = $('#adm-toast');
  if (!t) { t = document.createElement('div'); t.id = 'adm-toast'; t.setAttribute('role', 'status'); root.appendChild(t); }
  t.textContent = msg; t.className = `adm-toast show ${bad ? 'bad' : ''}`;
  clearTimeout(sayTimer); sayTimer = setTimeout(() => t.classList.remove('show'), bad ? 4500 : 2200);
}
function fail(err) {
  if (err?.message === 'unauthorized' && isServer()) { backend.admin = false; renderLogin('Sessão expirada. Entre novamente.'); return; }
  say(friendlyError(err), true);
}
const busy = async (btn, fn) => {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
};

/* ---------- login ---------- */
function renderLogin(msg = '') {
  render(`<div class="adm-login"><form id="adm-login" class="adm-card" autocomplete="on">
    <div class="adm-logo">⚙</div><h1>Painel da loja</h1>
    ${backend.adminConfigured ? `<p class="adm-muted">Digite a senha de administrador.</p>
      <label>Senha<input type="password" name="password" autocomplete="current-password" required autofocus></label>
      <p class="adm-error" id="adm-login-error">${e(msg)}</p>
      <button class="adm-btn primary" type="submit">Entrar</button>`
    : `<p class="adm-error">A senha do painel ainda não foi configurada na Cloudflare.</p>
      <p class="adm-muted">No projeto da Cloudflare Pages: <b>Settings → Variables and Secrets</b> → adicione o segredo <code>ADMIN_PASSWORD</code> (mínimo 8 caracteres) e republique. O passo a passo completo está no README.</p>`}
    <a class="adm-link" href="#" data-adm="exit">← Voltar para a loja</a></form></div>`);
}

/* ---------- painel ---------- */
function renderPanel() {
  const openOrders = (A.orders || []).filter((o) => o.status === ORDER_STATUSES[0]).length;
  const tab = (id, label) => `<button class="${A.tab === id ? 'active' : ''}" data-adm="tab" data-tab="${id}">${label}</button>`;
  render(`<header class="adm-top"><strong class="adm-title">⚙ Painel · ${e(settings.storeName)}</strong>
    <nav class="adm-tabs" aria-label="Seções">${tab('products', `Produtos (${products().length})`)}${tab('orders', `Pedidos${openOrders ? ` <i class="adm-badge">${openOrders}</i>` : ''}`)}${tab('store', 'Loja')}${tab('backup', 'Backup')}</nav>
    <div class="adm-top-actions"><a class="adm-btn" href="#" data-adm="exit">Ver loja</a>${isServer() ? '<button class="adm-btn" data-adm="logout">Sair</button>' : ''}</div></header>
    <main class="adm-main">${modeBanner()}<section id="adm-content">${tabContent()}</section></main>
    <div id="adm-modal" class="adm-modal-wrap" hidden></div>`);
  if (A.tab === 'orders' && isServer() && A.orders === null) loadOrders();
}

const modeBanner = () => (isServer()
  ? '<div class="adm-banner ok">✓ Conectado ao banco da loja — o que você alterar aqui aparece para todos os clientes.</div>'
  : '<div class="adm-banner warn"><b>Modo local:</b> as alterações ficam salvas só neste navegador — os clientes <b>não</b> veem. Para publicar de verdade, ative o banco de dados na Cloudflare (passo a passo no README).</div>');

function tabContent() {
  return { products: productsTab, orders: ordersTab, store: storeTab, backup: backupTab }[A.tab]();
}
function refreshContent() { const c = $('#adm-content'); if (c) c.innerHTML = tabContent(); }

/* ----- Produtos ----- */
function visibleProducts() {
  const q = A.q.trim().toLowerCase();
  return products().filter((p) => (!A.cat || p.category === A.cat) && (!q || `${p.name} ${p.category}`.toLowerCase().includes(q)));
}
function productsTab() {
  const cats = [...new Set(products().map((p) => p.category))].sort();
  const list = visibleProducts();
  const canMove = !A.q && !A.cat;
  return `<div class="adm-toolbar">
    <input type="search" id="adm-q" placeholder="Buscar produto…" value="${e(A.q)}" aria-label="Buscar produto">
    <select id="adm-cat" aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${cats.map((c) => `<option ${A.cat === c ? 'selected' : ''}>${e(c)}</option>`).join('')}</select>
    <button class="adm-btn primary" data-adm="new">＋ Novo produto</button></div>
    <p class="adm-muted">${list.length} de ${products().length} produtos. Altere o <b>preço</b> direto na lista (deixe vazio = “Consulte o preço”) ou toque em <b>Editar</b> para mudar tudo, inclusive as fotos.</p>
    <div class="adm-list">${list.map((p, i) => `<div class="adm-row ${p.active === false ? 'is-hidden' : ''}" data-id="${p.id}">
      <div class="adm-thumb" style="background:${e(p.color)}">${p.images?.length ? `<img src="${imgSrc(p.images[0], true)}" alt="" loading="lazy">` : e(p.emoji)}</div>
      <div class="adm-info"><b>${e(p.name)}</b><small>${e(p.category)}${p.tag ? ` · ${e(p.tag)}` : ''}${p.images?.length ? ` · ${p.images.length} foto${p.images.length > 1 ? 's' : ''}` : ' · sem foto'}</small></div>
      <label class="adm-price">R$ <input data-quick="price" inputmode="decimal" value="${priceText(p.price)}" placeholder="consultar" aria-label="Preço de ${e(p.name)}"></label>
      <div class="adm-flags"><label class="adm-check"><input type="checkbox" data-quick="active" ${p.active !== false ? 'checked' : ''}> Visível</label>
      <label class="adm-check"><input type="checkbox" data-quick="soldOut" ${p.soldOut ? 'checked' : ''}> Esgotado</label></div>
      <div class="adm-row-actions">${canMove ? `<button class="adm-icon" data-adm="up" aria-label="Mover para cima" ${i === 0 ? 'disabled' : ''}>↑</button><button class="adm-icon" data-adm="down" aria-label="Mover para baixo" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
      <button class="adm-btn" data-adm="edit">Editar</button></div></div>`).join('') || '<div class="adm-empty">Nenhum produto encontrado.</div>'}</div>`;
}

/* ----- Editor de produto ----- */
function openEditor(p) {
  A.draft = p ? structuredClone(p) : { id: null, name: '', category: A.cat || 'Outros', price: 0, oldPrice: 0, tag: '', desc: '', emoji: '📦', color: '#e8efff', images: [], active: true, soldOut: false };
  const cats = getCategories(products()).filter((c) => !['Todos', 'Favoritos'].includes(c));
  const d = A.draft;
  const modal = $('#adm-modal');
  modal.hidden = false;
  modal.innerHTML = `<div class="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-ed-title">
    <header><h2 id="adm-ed-title">${d.id ? 'Editar produto' : 'Novo produto'}</h2><button class="adm-icon" data-adm="close-editor" aria-label="Fechar">×</button></header>
    <form id="adm-form" class="adm-form" novalidate>
      <fieldset class="adm-photos"><legend>Fotos <small>(a primeira é a principal · até ${MAX_PHOTOS})</small></legend>
        <div id="adm-imgs" class="adm-imgs"></div>
        <p class="adm-muted" id="adm-img-status">Toque em “Adicionar fotos” (pode tirar na hora pela câmera) ou arraste imagens para cá. Elas são reduzidas automaticamente.</p></fieldset>
      <label>Nome<input name="name" required maxlength="80" value="${e(d.name)}"></label>
      <div class="adm-two"><label>Categoria<input name="category" list="adm-cats" maxlength="30" value="${e(d.category)}"><datalist id="adm-cats">${cats.map((c) => `<option value="${e(c)}">`).join('')}</datalist></label>
        <label>Etiqueta (ex.: OFERTA, NOVO)<input name="tag" maxlength="20" value="${e(d.tag)}"></label></div>
      <div class="adm-two"><label>Preço (R$) — vazio = “Consulte o preço”<input name="price" inputmode="decimal" value="${priceText(d.price)}" placeholder="49,90"></label>
        <label>Preço antigo (para mostrar desconto)<input name="oldPrice" inputmode="decimal" value="${priceText(d.oldPrice)}" placeholder="69,90"></label></div>
      <label>Descrição<textarea name="desc" maxlength="200" rows="3">${e(d.desc)}</textarea></label>
      <div class="adm-two"><label>Ícone (usado quando não há foto)<input name="emoji" maxlength="8" value="${e(d.emoji)}"></label>
        <label>Cor de fundo<input name="color" type="color" value="${e(d.color)}"></label></div>
      <div class="adm-checks"><label class="adm-check"><input type="checkbox" name="active" ${d.active !== false ? 'checked' : ''}> Visível na loja</label>
        <label class="adm-check"><input type="checkbox" name="soldOut" ${d.soldOut ? 'checked' : ''}> Esgotado</label></div>
      <p class="adm-error" id="adm-form-error"></p>
      <footer class="adm-dialog-actions">
        ${d.id ? '<button type="button" class="adm-btn danger" data-adm="delete">Excluir</button><button type="button" class="adm-btn" data-adm="duplicate">Duplicar</button>' : ''}
        <span class="grow"></span><button type="button" class="adm-btn" data-adm="close-editor">Cancelar</button><button type="submit" class="adm-btn primary">Salvar</button></footer>
    </form></div>`;
  renderImages();
  $('input[name=name]', modal).focus();
}
function closeEditor() { const m = $('#adm-modal'); if (m) { m.hidden = true; m.innerHTML = ''; } A.draft = null; }

function renderImages() {
  const box = $('#adm-imgs'); if (!box || !A.draft) return;
  const imgs = A.draft.images;
  box.innerHTML = imgs.map((src, i) => `<div class="adm-img ${i === 0 ? 'main' : ''}" data-i="${i}">
    <img src="${imgSrc(src, true)}" alt="Foto ${i + 1}">${i === 0 ? '<span class="adm-main-tag">Principal</span>' : ''}
    <div class="adm-img-actions"><button type="button" class="adm-icon" data-adm="img-left" aria-label="Mover para a esquerda" ${i === 0 ? 'disabled' : ''}>←</button>
      <button type="button" class="adm-icon" data-adm="img-main" aria-label="Tornar principal" ${i === 0 ? 'disabled' : ''}>★</button>
      <button type="button" class="adm-icon" data-adm="img-right" aria-label="Mover para a direita" ${i === imgs.length - 1 ? 'disabled' : ''}>→</button>
      <button type="button" class="adm-icon danger" data-adm="img-del" aria-label="Remover foto">×</button></div></div>`).join('') +
    (imgs.length < MAX_PHOTOS ? `<label class="adm-add-photo"><span>＋</span>Adicionar fotos<input type="file" accept="image/*" multiple hidden data-file></label>` : '');
}

async function addFiles(fileList) {
  if (!A.draft) return;
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  const status = $('#adm-img-status');
  if (!files.length) { status.textContent = 'Escolha arquivos de imagem (JPG, PNG ou WebP).'; return; }
  for (const [n, file] of files.entries()) {
    if (A.draft.images.length >= MAX_PHOTOS) { status.textContent = `Limite de ${MAX_PHOTOS} fotos por produto.`; break; }
    status.textContent = `Enviando foto ${n + 1} de ${files.length}…`;
    try {
      const out = await processImage(file);
      const ref = isServer() ? (await api('POST', '/api/img', out)).url : await saveLocalImage(out);
      A.draft.images.push(ref); renderImages();
    } catch (err) { status.textContent = err?.status ? friendlyError(err) : (err.message || 'Falha ao processar a imagem.'); if (err?.message === 'unauthorized') return fail(err); return; }
  }
  status.textContent = 'Fotos adicionadas. Clique em Salvar para publicar.';
}

function readDraft(form) {
  const f = new FormData(form);
  const price = parsePrice(f.get('price')), oldPrice = parsePrice(f.get('oldPrice'));
  if (Number.isNaN(price) || Number.isNaN(oldPrice)) return { error: 'Preço inválido. Use números, ex.: 49,90.' };
  if (!String(f.get('name')).trim()) return { error: 'Informe o nome do produto.' };
  const p = sanitizeProduct({
    ...A.draft, id: A.draft.id ?? 1, name: f.get('name'), category: f.get('category'), tag: f.get('tag'), desc: f.get('desc'),
    emoji: f.get('emoji'), color: f.get('color'), price, oldPrice, images: A.draft.images,
    active: f.get('active') === 'on', soldOut: f.get('soldOut') === 'on',
  });
  if (!p) return { error: 'Confira os dados do produto.' };
  if (oldPrice && oldPrice <= price) p.oldPrice = 0;
  return { product: { ...p, id: A.draft.id } };
}

/* ---------- persistência de produtos (servidor ou local) ---------- */
async function persistProduct(p) {
  let saved;
  if (isServer()) {
    saved = p.id ? (await api('PUT', `/api/products/${p.id}`, p)).product : (await api('POST', '/api/products', p)).product;
  } else {
    saved = sanitizeProduct({ ...p, id: p.id ?? Math.max(0, ...products().map((x) => x.id)) + 1 });
  }
  const list = products().some((x) => x.id === saved.id) ? products().map((x) => (x.id === saved.id ? saved : x)) : [...products(), saved];
  await ctx.setProducts(list);
  return saved;
}
async function removeProduct(id) {
  if (isServer()) await api('DELETE', `/api/products/${id}`);
  await ctx.setProducts(products().filter((x) => x.id !== id));
}
async function persistOrder(ids) {
  if (isServer()) await api('PUT', '/api/products/order', { ids });
  const byId = new Map(products().map((p) => [p.id, p]));
  await ctx.setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
}

/* ----- Pedidos ----- */
async function loadOrders() {
  try { A.orders = (await api('GET', '/api/orders')).orders; } catch (err) { A.orders = []; fail(err); }
  if (A.tab === 'orders') { refreshContent(); refreshTabs(); }
}
function refreshTabs() { renderTabsOnly(); }
function renderTabsOnly() {
  const open = (A.orders || []).filter((o) => o.status === ORDER_STATUSES[0]).length;
  const btn = root.querySelector('[data-tab="orders"]');
  if (btn) btn.innerHTML = `Pedidos${open ? ` <i class="adm-badge">${open}</i>` : ''}`;
}
const waLink = (phone) => { let d = onlyDigits(phone); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}`; };
function ordersTab() {
  if (A.orders === null) return '<p class="adm-loading">Carregando pedidos…</p>';
  const list = A.orders.filter((o) => !A.orderFilter || o.status === A.orderFilter);
  return `<div class="adm-toolbar"><select id="adm-ofilter" aria-label="Filtrar por status"><option value="">Todos os status</option>${ORDER_STATUSES.map((s) => `<option ${A.orderFilter === s ? 'selected' : ''}>${e(s)}</option>`).join('')}</select>
    <button class="adm-btn" data-adm="orders-csv">Exportar planilha (CSV)</button><button class="adm-btn" data-adm="orders-refresh">Atualizar</button></div>
    <p class="adm-muted">${list.length} pedido(s). ${isServer() ? 'Pedidos feitos por qualquer cliente aparecem aqui.' : 'Modo local: aparecem só os pedidos feitos neste navegador.'}</p>
    <div class="adm-orders">${list.map((o) => `<article class="adm-order" data-n="${e(o.number)}">
      <header><b>${e(o.number)}</b><time>${new Date(o.date).toLocaleString('pt-BR')}</time>
        <select data-order-status aria-label="Status do pedido ${e(o.number)}">${ORDER_STATUSES.map((s) => `<option ${o.status === s ? 'selected' : ''}>${e(s)}</option>`).join('')}</select></header>
      <p><b>${e(o.customer.name)}</b> · ${e(o.customer.phone)}<br>${e(o.customer.address)}${o.customer.notes ? `<br><i>Obs.: ${e(o.customer.notes)}</i>` : ''}</p>
      <ul>${o.items.map((i) => `<li>${i.qty}× ${e(i.name)} — ${i.price > 0 ? money(i.price * i.qty) : 'preço a consultar'}</li>`).join('')}</ul>
      <footer><strong>Total: ${money(o.total)}</strong><span class="grow"></span>
        <a class="adm-btn" href="${e(waLink(o.customer.phone))}" target="_blank" rel="noopener noreferrer">WhatsApp do cliente</a><button class="adm-btn danger" data-adm="order-del">Excluir</button></footer></article>`).join('') || '<div class="adm-empty">Nenhum pedido ainda.</div>'}</div>`;
}
function ordersCsv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Número', 'Data', 'Status', 'Cliente', 'WhatsApp', 'Endereço', 'Observações', 'Itens', 'Total'], ...A.orders.map((o) => [o.number, new Date(o.date).toLocaleString('pt-BR'), o.status, o.customer.name, o.customer.phone, o.customer.address, o.customer.notes, o.items.map((i) => `${i.qty}x ${i.name}`).join(' | '), String(o.total).replace('.', ',')])];
  download('pedidos.csv', '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

/* ----- Loja (configurações) ----- */
function storeTab() {
  return `<form id="adm-settings" class="adm-card adm-form" novalidate><h2>Dados da loja</h2>
    <label>Nome da loja<input name="storeName" maxlength="40" value="${e(settings.storeName)}" required></label>
    <label>Aviso no topo do site (deixe vazio para ocultar)<input name="announcement" maxlength="140" value="${e(settings.announcement)}"></label>
    <label>Texto de boas-vindas<textarea name="heroText" maxlength="220" rows="3">${e(settings.heroText)}</textarea></label>
    <div class="adm-two"><label>WhatsApp da loja (com DDD)<input name="whatsappNumber" inputmode="tel" placeholder="(83) 99999-9999" value="${e(settings.whatsappNumber ? formatPhoneBR(settings.whatsappNumber.replace(/^55/, '')) : '')}"></label>
      <label>Chave Pix<input name="pixKey" maxlength="140" value="${e(settings.pixKey)}" placeholder="CPF, e-mail, telefone ou aleatória"></label></div>
    <p class="adm-muted">Com o WhatsApp preenchido, o pedido do cliente abre direto na sua conversa com o resumo pronto.</p>
    <p class="adm-error" id="adm-settings-error"></p><button class="adm-btn primary" type="submit">Salvar dados da loja</button></form>
    <div class="adm-card"><h2>Acesso</h2>${isServer()
      ? '<p class="adm-muted">A senha do painel é definida na Cloudflare (variável secreta <code>ADMIN_PASSWORD</code>). Para trocar, altere lá e republique.</p><button class="adm-btn" data-adm="logout">Sair do painel</button>'
      : '<p class="adm-muted">Modo local: sem senha, pois nada aqui é publicado. Ao ativar o banco na Cloudflare, o painel passa a exigir senha.</p>'}</div>`;
}

/* ----- Backup ----- */
function backupTab() {
  return `<div class="adm-card"><h2>Backup e restauração</h2>
    <p class="adm-muted">O backup guarda produtos e dados da loja (as fotos enviadas ficam no banco e são referenciadas pelo endereço).</p>
    <div class="adm-actions"><button class="adm-btn primary" data-adm="export">Baixar backup (.json)</button>
      <label class="adm-btn">Importar backup<input type="file" accept="application/json,.json" hidden data-import></label>
      <button class="adm-btn danger" data-adm="restore">Restaurar catálogo inicial</button></div></div>`;
}
const download = (name, content, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
};
async function replaceCatalog(list, newSettings) {
  if (isServer()) {
    const r = await api('POST', '/api/import', { products: list, settings: newSettings });
    applySettings(r.settings); await ctx.setProducts(sanitizeProducts(r.products) ?? []);
  } else {
    await ctx.setProducts(sanitizeProducts(list) ?? []);
    if (newSettings) ctx.saveSettingsLocal(newSettings);
  }
  ctx.applyBranding(); ctx.cacheSettings?.();
}

/* ---------- eventos ---------- */
const rowOf = (el) => products().find((p) => p.id === Number(el.closest('.adm-row')?.dataset.id));

const act = {
  tab: (el) => {
    A.tab = el.dataset.tab;
    if (A.tab === 'orders' && !isServer()) A.orders = ctx.storage.get(ctx.KEYS.orders, []);
    renderPanel();
  },
  exit: (_el, ev) => { ev.preventDefault(); history.replaceState(null, '', location.pathname + location.search); closeAdmin(); window.dispatchEvent(new HashChangeEvent('hashchange')); },
  logout: (el) => busy(el, async () => { await api('DELETE', '/api/login'); backend.admin = false; renderLogin(); }),
  new: () => openEditor(null),
  edit: (el) => { const p = rowOf(el); if (p) openEditor(p); },
  'close-editor': closeEditor,
  up: (el) => move(el, -1), down: (el) => move(el, 1),
  'img-left': (el) => moveImg(el, -1), 'img-right': (el) => moveImg(el, 1),
  'img-main': (el) => moveImg(el, -Infinity),
  'img-del': (el) => { const i = Number(el.closest('.adm-img').dataset.i); A.draft.images.splice(i, 1); renderImages(); },
  delete: (el) => {
    if (!confirm(`Excluir “${A.draft.name}” da loja? Esta ação não pode ser desfeita.`)) return;
    busy(el, async () => { await removeProduct(A.draft.id); closeEditor(); refreshContent(); say('Produto excluído.'); });
  },
  duplicate: (el) => busy(el, async () => {
    const d = A.draft; closeEditor();
    const copy = await persistProduct({ ...d, id: null, name: `${d.name} (cópia)`, active: false });
    refreshContent(); say('Cópia criada (oculta). Edite e marque “Visível” quando estiver pronta.'); openEditor(copy);
  }),
  'orders-refresh': () => { A.orders = isServer() ? null : ctx.storage.get(ctx.KEYS.orders, []); renderPanel(); },
  'orders-csv': () => (A.orders?.length ? ordersCsv() : say('Não há pedidos para exportar.', true)),
  'order-del': (el) => {
    const n = el.closest('.adm-order').dataset.n;
    if (!confirm(`Excluir o pedido ${n}?`)) return;
    busy(el, async () => {
      if (isServer()) await api('DELETE', `/api/orders/${n}`); else ctx.storage.set(ctx.KEYS.orders, A.orders.filter((o) => o.number !== n));
      A.orders = A.orders.filter((o) => o.number !== n); refreshContent(); renderTabsOnly(); say('Pedido excluído.');
    });
  },
  export: () => download(`backup-loja-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'loja', version: 1, exportedAt: new Date().toISOString(), settings, products: products() }, null, 2), 'application/json'),
  restore: (el) => {
    if (!confirm('Restaurar o catálogo inicial? Todos os produtos e preços atuais serão substituídos.')) return;
    busy(el, async () => { await replaceCatalog(structuredClone(ctx.initialProducts)); renderPanel(); say('Catálogo inicial restaurado.'); });
  },
};
async function move(el, delta) {
  const list = [...products()], i = list.findIndex((p) => p.id === rowOf(el)?.id), j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await busy(el, () => persistOrder(list.map((p) => p.id)));
  refreshContent();
}
function moveImg(el, delta) {
  const imgs = A.draft.images, i = Number(el.closest('.adm-img').dataset.i);
  const j = delta === -Infinity ? 0 : i + delta;
  if (j < 0 || j >= imgs.length) return;
  const [x] = imgs.splice(i, 1); imgs.splice(j, 0, x); renderImages();
}

function onClick(ev) {
  if (ev.target.classList?.contains('adm-modal-wrap')) return closeEditor();
  const el = ev.target.closest('[data-adm]');
  if (el) act[el.dataset.adm]?.(el, ev);
}
function onKey(ev) {
  if (ev.key === 'Escape' && A.draft) closeEditor();
  if (ev.key === 'Enter' && ev.target.matches('[data-quick="price"]')) ev.target.blur();
  if (ev.key === 'Tab' && A.draft) { // mantém o foco dentro do editor
    const f = [...$('#adm-modal').querySelectorAll('button:not([disabled]),input:not([type=hidden]),select,textarea,a[href]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f.at(-1).focus(); }
    else if (!ev.shiftKey && document.activeElement === f.at(-1)) { ev.preventDefault(); f[0].focus(); }
  }
}
function onInput(ev) {
  const t = ev.target;
  if (t.id === 'adm-q') { A.q = t.value; const l = $('.adm-list'); if (l) { const pos = t.selectionStart; refreshContent(); const q = $('#adm-q'); q.focus(); q.setSelectionRange(pos, pos); } }
  if (t.name === 'whatsappNumber') t.value = formatPhoneBR(t.value);
}
async function onChange(ev) {
  const t = ev.target;
  if (t.id === 'adm-cat') { A.cat = t.value; refreshContent(); return; }
  if (t.id === 'adm-ofilter') { A.orderFilter = t.value; refreshContent(); return; }
  if (t.matches('[data-file]')) { const files = t.files; await addFiles(files); t.value = ''; return; }
  if (t.matches('[data-import]')) { const f = t.files[0]; t.value = ''; return importBackup(f); }
  if (t.matches('[data-order-status]')) return changeStatus(t);
  if (t.dataset.quick) return quickEdit(t);
}
async function quickEdit(t) {
  const p = rowOf(t); if (!p) return;
  const next = { ...p };
  if (t.dataset.quick === 'price') {
    const v = parsePrice(t.value);
    if (Number.isNaN(v)) { say('Preço inválido. Ex.: 49,90', true); t.value = priceText(p.price); return; }
    next.price = v; if (next.oldPrice && next.oldPrice <= v) next.oldPrice = 0;
    if (v === p.price) return;
  } else next[t.dataset.quick] = t.checked;
  await busy(t, async () => { await persistProduct(next); say('Salvo ✓'); });
  const row = t.closest('.adm-row'); if (row) { row.classList.toggle('is-hidden', next.active === false); if (t.dataset.quick === 'price') t.value = priceText(next.price); }
}
async function changeStatus(sel) {
  const n = sel.closest('.adm-order').dataset.n;
  await busy(sel, async () => {
    if (isServer()) await api('PATCH', `/api/orders/${n}`, { status: sel.value });
    A.orders = A.orders.map((o) => (o.number === n ? { ...o, status: sel.value } : o));
    if (!isServer()) ctx.storage.set(ctx.KEYS.orders, A.orders);
    renderTabsOnly(); say('Status atualizado ✓');
  });
}
async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = sanitizeProducts(data.products);
    if (!list?.length) throw new Error('empty');
    if (!confirm(`Importar ${list.length} produtos? Os produtos atuais serão substituídos.`)) return;
    await replaceCatalog(list, data.settings); renderPanel(); say('Backup importado ✓');
  } catch (err) { if (err?.status) fail(err); else say('Arquivo de backup inválido.', true); }
}

async function onSubmit(ev) {
  ev.preventDefault();
  const form = ev.target, btn = form.querySelector('[type=submit]');
  if (form.id === 'adm-login') {
    const err = $('#adm-login-error');
    return busy(btn, async () => {
      try { await api('POST', '/api/login', { password: new FormData(form).get('password') }); }
      catch (e2) { err.textContent = friendlyError(e2); return; }
      backend.admin = true; await load();
    });
  }
  if (form.id === 'adm-form') {
    const { product, error } = readDraft(form);
    $('#adm-form-error').textContent = error || '';
    if (error) return;
    return busy(btn, async () => { await persistProduct(product); closeEditor(); refreshContent(); say('Produto salvo ✓'); });
  }
  if (form.id === 'adm-settings') {
    const f = Object.fromEntries(new FormData(form));
    const digits = onlyDigits(f.whatsappNumber);
    if (digits && digits.length < 10) { $('#adm-settings-error').textContent = 'WhatsApp inválido. Informe DDD + número.'; return; }
    f.whatsappNumber = digits ? (digits.length <= 11 ? '55' + digits : digits) : '';
    $('#adm-settings-error').textContent = '';
    return busy(btn, async () => {
      if (isServer()) applySettings((await api('PUT', '/api/settings', f)).settings); else ctx.saveSettingsLocal(f);
      ctx.applyBranding(); ctx.cacheSettings?.(); renderPanel(); say('Dados da loja salvos ✓');
    });
  }
}
