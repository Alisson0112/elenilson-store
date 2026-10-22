/* Painel administrativo (carregado sob demanda em seusite/#admin). */
import { backend, settings, api, fetchCatalog, applySettings, friendlyError } from './lib/backend.js';
import { sanitizeProduct, sanitizeProducts, ORDER_STATUSES, thumbOf, getCategories, ROLES, usernameError, passwordError, nameError, normalizeUsername } from './lib/logic.js';
import { escapeHtml as e, money, onlyDigits, formatPhoneBR } from './lib/utils.js';
import { processImage, saveLocalImage, resolveSrc } from './lib/images.js';

const MAX_PHOTOS = 8;
let ctx = null, root = null;
const A = { tab: 'products', q: '', cat: '', draft: null, orders: null, orderFilter: '', loading: false, auth: null, user: null, users: null };
const isOwner = () => !isServer() || A.user?.role === 'owner';

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
    // no documento (não só no painel): o Esc funciona mesmo quando o foco saiu da janela
    document.addEventListener('keydown', (ev) => { if (root && !root.hidden) onKey(ev); });
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
    A.auth = await api('GET', '/api/auth');
    A.user = A.auth.user; backend.admin = Boolean(A.user);
    if (!A.user) return A.auth.setupRequired ? renderSetup() : renderLogin();
    if (!isOwner() && ['store', 'backup', 'users'].includes(A.tab)) A.tab = 'products';
    const d = await fetchCatalog(true);
    let list = d.products;
    if (!d.seeded) { // 1º acesso: o dono assume o catálogo atual (vira editável e passa a valer para todos)
      if (!isOwner()) { render(`<div class="adm-login"><div class="adm-card"><div class="adm-logo">⏳</div><h1>Quase lá</h1><p class="adm-muted">O <b>Dono</b> da loja precisa entrar no painel uma vez para ativar o catálogo. Depois disso você já pode editar.</p><button class="adm-btn" data-adm="logout">Sair</button></div></div>`); return; }
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
  if (err?.message === 'unauthorized' && isServer()) { signedOut('Sua sessão terminou. Entre novamente.'); return; }
  say(friendlyError(err), true);
}
const busy = async (btn, fn) => {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
};

/* ---------- acesso: entrar, primeira conta, recuperar senha ---------- */
const pwField = (name, label, autocomplete, extra = '') => `<label>${label}<span class="adm-pw"><input type="password" name="${name}" autocomplete="${autocomplete}" required maxlength="128" ${extra}><button type="button" class="adm-eye" data-adm="toggle-pw" aria-label="Mostrar senha">👁</button></span></label>`;
const pwHint = '<small class="adm-hint" data-pw-hint>Mínimo 8 caracteres, com letras e números.</small>';
const backLink = '<a class="adm-link" href="#" data-adm="exit">← Voltar para a loja</a>';
const shell = (inner) => `<div class="adm-login">${inner}</div>`;

function renderLogin(msg = '') {
  render(shell(`<form id="adm-login" class="adm-card adm-auth" autocomplete="on" novalidate>
    <div class="adm-logo">⚙</div><h1>Painel da loja</h1><p class="adm-muted">Entre com seu usuário e senha.</p>
    <label>Usuário<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="40" autofocus></label>
    ${pwField('password', 'Senha', 'current-password')}
    <label class="adm-check adm-remember"><input type="checkbox" name="remember"> Manter conectado neste aparelho (30 dias)</label>
    <p class="adm-error" id="adm-auth-error" role="alert">${e(msg)}</p>
    <button class="adm-btn primary" type="submit">Entrar</button>
    <a class="adm-link" href="#" data-adm="show-recover">Esqueci minha senha</a>${backLink}</form>`));
}

const setupKeyHelp = '<p class="adm-muted small">A <b>chave de configuração</b> é o valor do segredo <code>ADMIN_PASSWORD</code> que você cadastrou na Cloudflare (<i>Settings → Variables and Secrets</i>). Ela só serve para criar a primeira conta e recuperar o acesso — guarde-a em local seguro.</p>';
const setupMissing = '<p class="adm-error">A chave de configuração ainda não existe na Cloudflare.</p><p class="adm-muted">No projeto da Cloudflare Pages: <b>Settings → Variables and Secrets</b> → adicione o segredo <code>ADMIN_PASSWORD</code> (mínimo 8 caracteres) e republique. Passo a passo no README.</p>';

function renderSetup() {
  render(shell(`<form id="adm-setup" class="adm-card adm-auth" novalidate>
    <div class="adm-logo">🔐</div><h1>Criar conta do dono</h1>
    ${A.auth?.setupAvailable ? `<p class="adm-muted">Primeiro acesso: crie a sua conta de <b>Dono</b>. Depois você poderá cadastrar funcionários.</p>
    ${pwField('setupKey', 'Chave de configuração', 'off')}${setupKeyHelp}
    <label>Seu nome<input name="name" autocomplete="name" required maxlength="60"></label>
    <label>Usuário (para entrar)<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="32" placeholder="ex.: elenilson"></label>
    ${pwField('password', 'Senha', 'new-password', 'data-pw')}${pwHint}
    ${pwField('confirm', 'Repita a senha', 'new-password')}
    <p class="adm-error" id="adm-auth-error" role="alert"></p>
    <button class="adm-btn primary" type="submit">Criar conta e entrar</button>` : setupMissing}${backLink}</form>`));
}

function renderRecover() {
  render(shell(`<form id="adm-recover" class="adm-card adm-auth" novalidate>
    <div class="adm-logo">🔑</div><h1>Recuperar acesso</h1>
    ${A.auth?.setupAvailable ? `<p class="adm-muted">Defina uma nova senha usando a chave de configuração da Cloudflare. Funcionários podem pedir ao Dono para redefinir a senha pelo painel.</p>
    ${pwField('setupKey', 'Chave de configuração', 'off')}${setupKeyHelp}
    <label>Usuário<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="40"></label>
    ${pwField('password', 'Nova senha', 'new-password', 'data-pw')}${pwHint}
    ${pwField('confirm', 'Repita a nova senha', 'new-password')}
    <p class="adm-error" id="adm-auth-error" role="alert"></p>
    <button class="adm-btn primary" type="submit">Salvar nova senha e entrar</button>` : setupMissing}
    <a class="adm-link" href="#" data-adm="show-login">← Voltar para o login</a></form>`));
}

/* ---------- painel ---------- */
function renderPanel() {
  const openOrders = (A.orders || []).filter((o) => o.status === ORDER_STATUSES[0]).length;
  const tab = (id, label) => `<button class="${A.tab === id ? 'active' : ''}" data-adm="tab" data-tab="${id}">${label}</button>`;
  const owner = isOwner();
  render(`<header class="adm-top"><strong class="adm-title">⚙ Painel · ${e(settings.storeName)}</strong>
    <nav class="adm-tabs" aria-label="Seções">${tab('products', `Produtos (${products().length})`)}${tab('orders', `Pedidos${openOrders ? ` <i class="adm-badge">${openOrders}</i>` : ''}`)}${owner ? tab('store', 'Loja') : ''}${owner && isServer() ? tab('users', 'Usuários') : ''}${owner ? tab('backup', 'Backup') : ''}${isServer() ? tab('account', 'Minha conta') : ''}</nav>
    <div class="adm-top-actions">${A.user ? `<span class="adm-who" title="${e(A.user.username)}">${e(A.user.name.split(' ')[0])} <i class="adm-role ${e(A.user.role)}">${e(ROLES[A.user.role])}</i></span>` : ''}<a class="adm-btn" href="#" data-adm="exit">Ver loja</a>${isServer() ? '<button class="adm-btn" data-adm="logout">Sair</button>' : ''}</div></header>
    <main class="adm-main">${modeBanner()}<section id="adm-content">${tabContent()}</section></main>
    <div id="adm-modal" class="adm-modal-wrap" hidden></div>`);
  if (A.tab === 'orders' && isServer() && A.orders === null) loadOrders();
  if (A.tab === 'users' && A.users === null) loadUsers();
}

const modeBanner = () => (isServer()
  ? '<div class="adm-banner ok">✓ Conectado ao banco da loja — o que você alterar aqui aparece para todos os clientes.</div>'
  : '<div class="adm-banner warn"><b>Modo local:</b> as alterações ficam salvas só neste navegador — os clientes <b>não</b> veem. Para publicar de verdade, ative o banco de dados na Cloudflare (passo a passo no README).</div>');

function tabContent() {
  return ({ products: productsTab, orders: ordersTab, store: storeTab, backup: backupTab, users: usersTab, account: accountTab }[A.tab] ?? productsTab)();
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
function closeEditor() { const m = $('#adm-modal'); if (m) { m.hidden = true; m.innerHTML = ''; } A.draft = null; A.userEdit = null; }

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
    ${isServer() ? '' : '<div class="adm-card"><h2>Acesso</h2><p class="adm-muted">Modo local: sem login, pois nada aqui é publicado. Ao ativar o banco na Cloudflare, o painel passa a exigir usuário e senha.</p></div>'}`;
}

/* ----- Usuários (só Dono) ----- */
async function loadUsers() {
  try { A.users = (await api('GET', '/api/users')).users; } catch (err) { A.users = []; fail(err); }
  if (A.tab === 'users') refreshContent();
}
const when = (t) => (t ? new Date(t * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');
function usersTab() {
  if (A.users === null) return '<p class="adm-loading">Carregando usuários…</p>';
  return `<div class="adm-toolbar"><button class="adm-btn primary" data-adm="user-new">＋ Novo usuário</button></div>
    <p class="adm-muted"><b>Dono</b>: acesso total, inclusive dados da loja, backup e usuários. <b>Funcionário</b>: produtos, fotos, preços e pedidos.</p>
    <div class="adm-users">${A.users.map((u) => `<div class="adm-user ${u.active ? '' : 'is-hidden'}" data-uid="${u.id}">
      <div class="adm-avatar" aria-hidden="true">${e(u.name.trim()[0]?.toUpperCase() || '?')}</div>
      <div class="adm-info"><b>${e(u.name)}${u.id === A.user.id ? ' <small>(você)</small>' : ''}</b><small>@${e(u.username)} · último acesso: ${when(u.last_login)}${u.active ? '' : ' · <b>desativado</b>'}</small></div>
      <i class="adm-role ${e(u.role)}">${e(ROLES[u.role])}</i>
      <div class="adm-row-actions"><button class="adm-btn" data-adm="user-edit">Editar</button>${u.id === A.user.id ? '' : '<button class="adm-btn danger" data-adm="user-del">Excluir</button>'}</div></div>`).join('')}</div>`;
}
function openUserDialog(u) {
  A.userEdit = u ?? { id: null };
  const isNew = !u, self = u?.id === A.user.id;
  const modal = $('#adm-modal'); modal.hidden = false;
  modal.innerHTML = `<div class="adm-dialog adm-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="adm-u-title">
    <header><h2 id="adm-u-title">${isNew ? 'Novo usuário' : `Editar ${e(u.name)}`}</h2><button class="adm-icon" data-adm="close-editor" aria-label="Fechar">×</button></header>
    <form id="adm-user-form" class="adm-form" novalidate>
      <label>Nome<input name="name" required maxlength="60" value="${e(u?.name ?? '')}"></label>
      ${isNew ? '<label>Usuário (para entrar)<input name="username" required maxlength="32" autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="ex.: maria"></label>' : `<p class="adm-muted">Usuário: <b>@${e(u.username)}</b></p>`}
      <label>Perfil<select name="role" ${self ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${(u?.role ?? 'staff') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${isNew ? '' : `<label class="adm-check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} ${self ? 'disabled' : ''}> Conta ativa (pode entrar no painel)</label>`}
      ${pwField('password', isNew ? 'Senha inicial' : 'Nova senha (deixe vazio para manter)', 'new-password', `data-pw ${isNew ? '' : 'data-optional'}`).replace(' required', isNew ? ' required' : '')}${pwHint}
      <p class="adm-muted small">${isNew ? 'Passe a senha para a pessoa; ela pode trocar depois em “Minha conta”.' : 'Ao redefinir a senha ou desativar, a pessoa é desconectada de todos os aparelhos.'}</p>
      <p class="adm-error" id="adm-user-error" role="alert"></p>
      <footer class="adm-dialog-actions"><span class="grow"></span><button type="button" class="adm-btn" data-adm="close-editor">Cancelar</button><button type="submit" class="adm-btn primary">${isNew ? 'Criar usuário' : 'Salvar'}</button></footer>
    </form></div>`;
  $('input[name=name]', modal).focus();
}

/* ----- Minha conta ----- */
function accountTab() {
  const u = A.user;
  return `<form id="adm-account-name" class="adm-card adm-form" novalidate><h2>Minha conta</h2>
      <p class="adm-muted">Usuário: <b>@${e(u.username)}</b> · Perfil: <b>${e(ROLES[u.role])}</b></p>
      <label>Nome<input name="name" required maxlength="60" value="${e(u.name)}"></label>
      <button class="adm-btn primary" type="submit">Salvar nome</button></form>
    <form id="adm-account-pw" class="adm-card adm-form" novalidate><h2>Trocar senha</h2>
      ${pwField('currentPassword', 'Senha atual', 'current-password')}
      ${pwField('newPassword', 'Nova senha', 'new-password', 'data-pw')}${pwHint}
      ${pwField('confirm', 'Repita a nova senha', 'new-password')}
      <p class="adm-error" id="adm-pw-error" role="alert"></p>
      <button class="adm-btn primary" type="submit">Trocar senha</button>
      <p class="adm-muted small">Ao trocar a senha, os outros aparelhos conectados com a sua conta são desconectados.</p></form>
    <div class="adm-card"><h2>Segurança</h2><p class="adm-muted">Esqueceu o celular conectado em algum lugar? Encerre todas as sessões da sua conta.</p>
      <button class="adm-btn danger" data-adm="logout-all">Sair de todos os aparelhos</button></div>`;
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
function signedOut(msg = '') {
  backend.admin = false; A.user = null; A.users = null; A.orders = null; A.tab = 'products';
  renderLogin(msg);
}
const rowOf = (el) => products().find((p) => p.id === Number(el.closest('.adm-row')?.dataset.id));

const act = {
  tab: (el) => {
    A.tab = el.dataset.tab;
    if (A.tab === 'orders' && !isServer()) A.orders = ctx.storage.get(ctx.KEYS.orders, []);
    renderPanel();
  },
  exit: (_el, ev) => { ev.preventDefault(); history.replaceState(null, '', location.pathname + location.search); closeAdmin(); window.dispatchEvent(new HashChangeEvent('hashchange')); },
  logout: (el) => busy(el, async () => { await api('DELETE', '/api/login'); signedOut(); }),
  'logout-all': (el) => {
    if (!confirm('Sair de todos os aparelhos, inclusive deste?')) return;
    busy(el, async () => { await api('DELETE', '/api/login?all=1'); signedOut('Você saiu de todos os aparelhos.'); });
  },
  'toggle-pw': (el) => { const i = el.previousElementSibling; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); el.classList.toggle('on', show); },
  'show-recover': (_el, ev) => { ev.preventDefault(); renderRecover(); },
  'show-login': (_el, ev) => { ev.preventDefault(); renderLogin(); },
  'user-new': () => openUserDialog(null),
  'user-edit': (el) => openUserDialog(A.users.find((u) => u.id === Number(el.closest('.adm-user').dataset.uid))),
  'user-del': (el) => {
    const u = A.users.find((x) => x.id === Number(el.closest('.adm-user').dataset.uid));
    if (!u || !confirm(`Excluir a conta de ${u.name} (@${u.username})? A pessoa perde o acesso imediatamente.`)) return;
    busy(el, async () => { await api('DELETE', `/api/users/${u.id}`); A.users = A.users.filter((x) => x.id !== u.id); refreshContent(); say('Usuário excluído.'); });
  },
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
  if (ev.key === 'Escape' && $('#adm-modal') && !$('#adm-modal').hidden) closeEditor();
  if (ev.key === 'Enter' && ev.target.matches('[data-quick="price"]')) ev.target.blur();
  if (ev.key === 'Tab' && $('#adm-modal') && !$('#adm-modal').hidden) { // mantém o foco dentro da janela
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
  if (t.matches('[data-pw]')) {
    const hint = t.closest('form').querySelector('[data-pw-hint]');
    const user = t.form.elements.username?.value || A.userEdit?.username || A.user?.username || '';
    const err = t.value ? passwordError(t.value, user) : '';
    hint.textContent = !t.value ? 'Mínimo 8 caracteres, com letras e números.' : err || 'Senha forte ✓';
    hint.classList.toggle('ok', Boolean(t.value) && !err); hint.classList.toggle('bad', Boolean(err));
  }
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
  const f = Object.fromEntries(new FormData(form));
  const showErr = (id, msg) => { const el = $(id); if (el) el.textContent = msg; if (msg) el?.scrollIntoView({ block: 'nearest' }); return Boolean(msg); };
  const signedIn = async () => { A.auth = null; await load(); };

  if (form.id === 'adm-login') {
    if (showErr('#adm-auth-error', !f.username?.trim() || !f.password ? 'Informe usuário e senha.' : '')) return;
    return busy(btn, async () => {
      try { await api('POST', '/api/login', { username: f.username, password: f.password, remember: f.remember === 'on' }); }
      catch (e2) { showErr('#adm-auth-error', friendlyError(e2)); form.elements.password.value = ''; form.elements.password.focus(); return; }
      await signedIn();
    });
  }
  if (form.id === 'adm-setup' || form.id === 'adm-recover') {
    const err = (form.id === 'adm-setup' ? nameError(f.name) : '') || (!f.setupKey ? 'Informe a chave de configuração.' : '')
      || usernameError(f.username) || passwordError(f.password, normalizeUsername(f.username)) || (f.password !== f.confirm ? 'As senhas não conferem.' : '');
    if (showErr('#adm-auth-error', err)) return;
    return busy(btn, async () => {
      try { await api('POST', form.id === 'adm-setup' ? '/api/setup' : '/api/recover', { setupKey: f.setupKey, name: f.name, username: f.username, password: f.password }); }
      catch (e2) { showErr('#adm-auth-error', friendlyError(e2)); return; }
      say(form.id === 'adm-setup' ? 'Conta criada! Bem-vindo ao painel.' : 'Senha redefinida ✓');
      await signedIn();
    });
  }
  if (form.id === 'adm-user-form') {
    const isNew = !A.userEdit?.id;
    const err = nameError(f.name) || (isNew ? usernameError(f.username) : '') || ((isNew || f.password) ? passwordError(f.password, f.username || A.userEdit.username) : '');
    if (showErr('#adm-user-error', err)) return;
    return busy(btn, async () => {
      try {
        if (isNew) await api('POST', '/api/users', { name: f.name, username: f.username, password: f.password, role: f.role });
        else {
          const body = { name: f.name };
          if (A.userEdit.id !== A.user.id) { body.role = f.role; body.active = f.active === 'on'; }
          if (f.password) body.password = f.password;
          await api('PATCH', `/api/users/${A.userEdit.id}`, body);
          if (A.userEdit.id === A.user.id) A.user = { ...A.user, name: f.name.trim() };
        }
      } catch (e2) { showErr('#adm-user-error', friendlyError(e2)); return; }
      closeEditor(); A.users = null; renderPanel(); say(isNew ? 'Usuário criado ✓' : 'Usuário atualizado ✓');
    });
  }
  if (form.id === 'adm-account-name') {
    if (nameError(f.name)) return say(nameError(f.name), true);
    return busy(btn, async () => { A.user = (await api('PUT', '/api/account', { name: f.name })).user; renderPanel(); say('Nome atualizado ✓'); });
  }
  if (form.id === 'adm-account-pw') {
    const err = (!f.currentPassword ? 'Informe a senha atual.' : '') || passwordError(f.newPassword, A.user.username) || (f.newPassword !== f.confirm ? 'As senhas não conferem.' : '')
      || (f.newPassword === f.currentPassword ? 'A nova senha precisa ser diferente da atual.' : '');
    if (showErr('#adm-pw-error', err)) return;
    return busy(btn, async () => {
      try { await api('PUT', '/api/account', { currentPassword: f.currentPassword, newPassword: f.newPassword }); }
      catch (e2) { showErr('#adm-pw-error', friendlyError(e2)); return; }
      form.reset(); showErr('#adm-pw-error', ''); say('Senha alterada ✓ Outros aparelhos foram desconectados.');
    });
  }
  if (form.id === 'adm-form') {
    const { product, error } = readDraft(form);
    $('#adm-form-error').textContent = error || '';
    if (error) return;
    return busy(btn, async () => { await persistProduct(product); closeEditor(); refreshContent(); say('Produto salvo ✓'); });
  }
  if (form.id === 'adm-settings') {
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
