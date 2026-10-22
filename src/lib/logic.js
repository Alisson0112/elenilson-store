import { BASE_CATEGORIES, ALL, FAVORITES } from './data.js';
import { normalize } from './utils.js';

const HEX = /^#[0-9a-f]{6}$/i;
// só caminhos locais em img/ ou URLs https — nunca javascript:/data:
const IMG = /^(img\/[\w\-./]+\.(webp|jpe?g|png)|https:\/\/[^\s"'<>]+)$/i;
export const sanitizeImages = (list) =>
  (Array.isArray(list) ? list : []).filter((u) => typeof u === 'string' && IMG.test(u)).slice(0, 8);
export const thumbOf = (src) => (/^img\//.test(src) ? src.replace(/\.webp$/, '-sm.webp') : src);
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
  const ids = new Set(products.map((p) => p.id));
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
  products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }));

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
