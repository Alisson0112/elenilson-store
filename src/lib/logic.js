import { BASE_CATEGORIES, ALL, FAVORITES } from './data.js';
import { normalize } from './utils.js';

const HEX = /^#[0-9a-f]{6}$/i;
// só caminhos locais em img/ ou URLs https — nunca javascript:/data:
const IMG = /^(img\/[\w\-./]+\.(webp|jpe?g|png)|\/api\/img\/[\w-]{6,40}|idb:[\w-]{6,60}|https:\/\/[^\s"'<>]+)$/i;
export const sanitizeImages = (list) =>
  (Array.isArray(list) ? list : []).filter((u) => typeof u === 'string' && IMG.test(u)).slice(0, 8);
/** Miniatura correspondente: arquivo estático -sm.webp, imagem do servidor ?size=sm, imagem local idb:id-sm. */
export function thumbOf(src) {
  if (/^img\//.test(src)) return src.replace(/\.webp$/, '-sm.webp');
  if (/^\/api\/img\//.test(src)) return src.split('?')[0] + '?size=sm';
  if (/^idb:/.test(src)) return src + '-sm';
  return src;
}
export const hasPrice = (p) => p.price > 0;

/** Valida/normaliza um produto vindo de fora (localStorage, formulário). */
export function sanitizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const price = Number(raw.price);
  const name = String(raw.name ?? '').trim().slice(0, 80);
  const id = Number(raw.id);
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(id)) return null;
  const oldPrice = Number(raw.oldPrice);
  return {
    id,
    name,
    category: String(raw.category || 'Outros').trim().slice(0, 30) || 'Outros',
    price: Math.round(price * 100) / 100,
    oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? Math.round(oldPrice * 100) / 100 : 0,
    emoji: String(raw.emoji || '📦').trim().slice(0, 8) || '📦',
    color: HEX.test(raw.color) ? raw.color : '#e8efff',
    desc: String(raw.desc ?? '').trim().slice(0, 200),
    tag: String(raw.tag ?? '').trim().slice(0, 20),
    images: sanitizeImages(raw.images),
    active: raw.active !== false && raw.active !== 0 && raw.active !== 'false',
    soldOut: raw.soldOut === true || raw.soldOut === 1 || raw.soldOut === 'true',
  };
}

export function sanitizeProducts(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const p = sanitizeProduct(raw);
    if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
  }
  return out;
}

/** Mantém só itens existentes, com quantidade inteira entre 1 e max. */
export function sanitizeCart(raw, products, max = 99) {
  const ids = new Set(products.filter((p) => p.active !== false && !p.soldOut).map((p) => p.id));
  const cart = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k), qty = Math.floor(Number(v));
      if (ids.has(id) && qty > 0) cart[id] = Math.min(qty, max);
    }
  }
  return cart;
}

export const cartCount = (cart) => Object.values(cart).reduce((a, b) => a + b, 0);

export const cartItems = (cart, products) =>
  products.filter((p) => cart[p.id] && p.active !== false).map((p) => ({ ...p, qty: cart[p.id] }));

export const cartHasUnpriced = (cart, products) => cartItems(cart, products).some((p) => !hasPrice(p));

export const cartTotal = (cart, products) =>
  Math.round(cartItems(cart, products).reduce((s, p) => s + p.price * p.qty, 0) * 100) / 100;

export function getCategories(products) {
  const extra = [...new Set(products.map((p) => p.category))].filter((c) => !BASE_CATEGORIES.includes(c));
  return [ALL, ...BASE_CATEGORIES, ...extra, FAVORITES];
}

/** Intercala categorias (1 de cada por rodada) para a vitrine inicial ficar variada. */
export function interleaveByCategory(list) {
  const groups = new Map();
  for (const p of list) (groups.get(p.category) ?? groups.set(p.category, []).get(p.category)).push(p);
  const out = [];
  for (let i = 0; out.length < list.length; i++) for (const g of groups.values()) if (g[i]) out.push(g[i]);
  return out;
}

export function filterProducts(products, { category = ALL, query = '', sort = 'featured', favorites = new Set() } = {}) {
  const q = normalize(query);
  const list = products.filter((p) => {
    if (p.active === false) return false;
    if (category === FAVORITES) { if (!favorites.has(p.id)) return false; }
    else if (category !== ALL && p.category !== category) return false;
    return !q || normalize(`${p.name} ${p.category} ${p.desc}`).includes(q);
  });
  const pct = (p) => (p.oldPrice > p.price ? 1 - p.price / p.oldPrice : 0);
  // produtos "consulte o preço" (price 0) ficam sempre no fim ao ordenar por preço
  if (sort === 'featured' && category === ALL && !q) return interleaveByCategory(list);
  if (sort === 'price-up') list.sort((a, b) => (hasPrice(b) - hasPrice(a)) || a.price - b.price);
  else if (sort === 'price-down') list.sort((a, b) => (hasPrice(b) - hasPrice(a)) || b.price - a.price);
  else if (sort === 'discount') list.sort((a, b) => pct(b) - pct(a));
  return list;
}

export function createOrder({ cart, products, customer, now = Date.now() }) {
  const items = cartItems(cart, products).map((p) => ({ id: p.id, name: p.name, price: p.price, qty: p.qty }));
  if (!items.length) throw new Error('Carrinho vazio');
  return {
    number: 'ES' + String(now).slice(-7),
    date: new Date(now).toISOString(),
    customer,
    items,
    total: cartTotal(cart, products),
    status: 'Aguardando confirmação',
  };
}

export function validateCheckout({ name, phone, address }, isValidPhone) {
  const errors = {};
  if (String(name ?? '').trim().length < 3) errors.name = 'Informe seu nome completo.';
  if (!isValidPhone(phone)) errors.phone = 'Informe um WhatsApp válido com DDD.';
  if (String(address ?? '').trim().length < 3) errors.address = 'Informe cidade e bairro.';
  return errors;
}

/* ---------- Configurações da loja ---------- */
export const ORDER_STATUSES = ['Aguardando confirmação', 'Pago', 'Enviado', 'Entregue', 'Cancelado'];

const str = (v, max) => String(v ?? '').trim().slice(0, max);
export function sanitizeSettings(raw, defaults = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pick = (k, max) => (k in r ? str(r[k], max) : str(defaults[k], max));
  const wa = (('whatsappNumber' in r ? r.whatsappNumber : defaults.whatsappNumber) ?? '').toString().replace(/\D/g, '').slice(0, 15);
  return {
    storeName: pick('storeName', 40) || str(defaults.storeName, 40) || 'Minha Loja',
    announcement: pick('announcement', 140),
    heroText: pick('heroText', 220),
    whatsappNumber: wa.length >= 10 ? wa : '',
    pixKey: pick('pixKey', 140),
  };
}

/**
 * Cria um pedido a partir do que o cliente enviou (só ids e quantidades): preços e totais vêm
 * SEMPRE do catálogo do servidor, nunca do navegador. `isValidPhone` é injetado para ser reutilizável.
 */
export function createOrderFromRequest({ items, customer, products, isValidPhone, now = Date.now(), rand = Math.random }) {
  if (!Array.isArray(items) || !items.length || items.length > 60) throw new Error('Carrinho inválido');
  const byId = new Map(products.filter((p) => p.active !== false && !p.soldOut).map((p) => [p.id, p]));
  const merged = new Map();
  for (const it of items) {
    const id = Number(it?.id), qty = Math.floor(Number(it?.qty));
    if (!byId.has(id) || !(qty > 0)) throw new Error('Produto indisponível no pedido');
    merged.set(id, Math.min((merged.get(id) || 0) + qty, 99));
  }
  const c = {
    name: str(customer?.name, 80), phone: str(customer?.phone, 20),
    address: str(customer?.address, 120), notes: str(customer?.notes, 300),
  };
  const errors = validateCheckout(c, isValidPhone);
  if (Object.keys(errors).length) throw Object.assign(new Error('Dados inválidos'), { errors });
  const lines = [...merged].map(([id, qty]) => { const p = byId.get(id); return { id, name: p.name, price: p.price, qty }; });
  const total = Math.round(lines.reduce((sum, l) => sum + l.price * l.qty, 0) * 100) / 100;
  return {
    number: 'ES' + String(now).slice(-6) + Math.floor(rand() * 90 + 10),
    date: new Date(now).toISOString(),
    customer: c, items: lines, total, status: ORDER_STATUSES[0],
  };
}

/* ---------- Contas do painel (regras compartilhadas entre navegador e servidor) ---------- */
export const ROLES = { owner: 'Dono', staff: 'Funcionário' };
export const normalizeUsername = (u) => String(u ?? '').trim().toLowerCase();
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const WEAK = new Set(['12345678', '123456789', '1234567890', 'password', 'password1', 'senha123', 'senha1234', 'admin123', 'qwerty123', 'abc12345', 'elenilson', 'elenilson123']);

/** Devolve a mensagem de erro (string) ou '' se estiver tudo certo. */
export function usernameError(username) {
  return USERNAME_RE.test(normalizeUsername(username)) ? '' : 'Usuário: 3 a 32 caracteres, só letras minúsculas, números, ponto, hífen ou _.';
}
export function passwordError(password, username = '') {
  const p = String(password ?? '');
  if (p.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (p.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  if (WEAK.has(p.toLowerCase()) || p.toLowerCase() === normalizeUsername(username)) return 'Essa senha é fácil demais de adivinhar. Escolha outra.';
  return '';
}
export const nameError = (name) => (String(name ?? '').trim().length >= 2 && String(name).trim().length <= 60 ? '' : 'Informe um nome (2 a 60 caracteres).');
