import { describe, it, expect } from 'vitest';
import { escapeHtml, isValidPhoneBR, formatPhoneBR, normalize, createStorage, discountPct, buildOrderText, buildWhatsAppUrl } from '../src/lib/utils.js';
import { sanitizeProduct, sanitizeProducts, interleaveByCategory, sanitizeCart, filterProducts, cartTotal, cartCount, getCategories, createOrder, validateCheckout } from '../src/lib/logic.js';
import { initialProducts as catalog } from '../src/lib/data.js';
const initialProducts = [
  { id: 1, name: 'Fone Bluetooth', category: 'Eletrônicos', price: 79.9, oldPrice: 119.9, emoji: '🎧', color: '#e8efff', desc: '', tag: '' },
  { id: 2, name: 'Relógio Smart', category: 'Eletrônicos', price: 99.9, oldPrice: 149.9, emoji: '⌚', color: '#e8efff', desc: '', tag: '' },
  { id: 3, name: 'Mochila', category: 'Moda', price: 89.9, oldPrice: 0, emoji: '🎒', color: '#e8efff', desc: '', tag: '' },
  { id: 4, name: 'Garrafa Térmica', category: 'Casa', price: 39.9, oldPrice: 0, emoji: '🥤', color: '#e8efff', desc: '', tag: '' },
  { id: 5, name: 'Óculos de Sol', category: 'Moda', price: 49.9, oldPrice: 0, emoji: '🕶️', color: '#e8efff', desc: '', tag: '' },
  { id: 6, name: 'Luminária', category: 'Casa', price: 59.9, oldPrice: 0, emoji: '💡', color: '#e8efff', desc: '', tag: '' },
];

describe('utils', () => {
  it('escapa HTML', () => expect(escapeHtml(`<img onerror="x">&'`)).toBe('&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;'));
  it('normaliza acentos', () => expect(normalize('  Relógio ÓCULOS ')).toBe('relogio oculos'));
  it('valida telefone', () => {
    expect(isValidPhoneBR('(83) 99999-8888')).toBe(true);
    expect(isValidPhoneBR('+55 83 3333-4444')).toBe(true);
    expect(isValidPhoneBR('123')).toBe(false);
    expect(isValidPhoneBR('11111111111')).toBe(false);
  });
  it('formata telefone', () => expect(formatPhoneBR('83999998888')).toBe('(83) 99999-8888'));
  it('desconto', () => expect(discountPct({ price: 80, oldPrice: 100 })).toBe(20));
  it('storage tolera JSON corrompido', () => {
    const fake = { getItem: () => '{oops', setItem() {}, removeItem() {} };
    expect(createStorage(fake).get('k', 'fb')).toBe('fb');
  });
  it('storage tolera cota estourada', () => {
    const fake = { getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() {} };
    expect(createStorage(fake).set('k', 1)).toBe(false);
  });
  it('url do whatsapp', () => expect(buildWhatsAppUrl('+55 (83) 9', 'a b')).toBe('https://wa.me/5583 9'.replace(' ', '') + '?text=a%20b'));
});

describe('logic', () => {
  it('rejeita produto inválido', () => {
    expect(sanitizeProduct({ id: 1, name: '', price: 5 })).toBeNull();
    expect(sanitizeProduct({ id: 1, name: 'x', price: -1 })).toBeNull();
    expect(sanitizeProduct({ id: 1, name: 'x', price: 0 }).price).toBe(0);
    expect(sanitizeProduct(null)).toBeNull();
  });
  it('sanitiza cor maliciosa e preço antigo menor', () => {
    const p = sanitizeProduct({ id: 1, name: 'x', price: 10, oldPrice: 5, color: 'red;background:url(x)' });
    expect(p.color).toBe('#e8efff');
    expect(p.oldPrice).toBe(0);
  });
  it('remove ids duplicados', () => expect(sanitizeProducts([{ id: 1, name: 'a', price: 1 }, { id: 1, name: 'b', price: 2 }])).toHaveLength(1));
  it('limpa carrinho órfão e quantidades inválidas', () => {
    expect(sanitizeCart({ 1: 2, 999: 1, 2: -3, 3: 'x', 4: 500 }, initialProducts, 99)).toEqual({ 1: 2, 4: 99 });
  });
  it('total e contagem', () => {
    const cart = { 1: 2, 3: 1 };
    expect(cartCount(cart)).toBe(3);
    expect(cartTotal(cart, initialProducts)).toBe(249.7);
  });
  it('filtra por busca sem acento, categoria e favoritos', () => {
    expect(filterProducts(initialProducts, { query: 'oculos' }).map((p) => p.id)).toEqual([5]);
    expect(filterProducts(initialProducts, { category: 'Casa' })).toHaveLength(2);
    expect(filterProducts(initialProducts, { category: 'Favoritos', favorites: new Set([2]) })).toHaveLength(1);
  });
  it('ordena', () => {
    expect(filterProducts(initialProducts, { sort: 'price-up' })[0].id).toBe(4);
    const mixed = [{ ...initialProducts[0], id: 90, price: 0 }, ...initialProducts];
    expect(filterProducts(mixed, { sort: 'price-up' }).at(-1).id).toBe(90);
    expect(filterProducts(mixed, { sort: 'price-down' }).at(-1).id).toBe(90);
    expect(filterProducts(initialProducts, { sort: 'price-down' })[0].id).toBe(2);
  });
  it('categorias incluem "Outros" quando existe', () => {
    expect(getCategories([...initialProducts, { ...initialProducts[0], id: 99, category: 'Outros' }])).toContain('Outros');
  });
  it('cria pedido e recusa carrinho vazio', () => {
    const o = createOrder({ cart: { 1: 1 }, products: initialProducts, customer: { name: 'A' }, now: 1234567890 });
    expect(o.number).toBe('ES4567890');
    expect(o.total).toBe(79.9);
    expect(() => createOrder({ cart: {}, products: initialProducts, customer: {} })).toThrow();
    expect(buildOrderText(o, { storeName: 'L' })).toContain('1x Fone');
  });
  it('valida checkout', () => {
    expect(Object.keys(validateCheckout({ name: 'a', phone: '1', address: '' }, isValidPhoneBR))).toHaveLength(3);
    expect(validateCheckout({ name: 'Ana Maria', phone: '83999998888', address: 'Centro' }, isValidPhoneBR)).toEqual({});
  });
  it('filtra imagens inseguras', () => {
    const p = sanitizeProduct({ id: 1, name: 'x', price: 1, images: ['img/f01.webp', 'javascript:alert(1)', 'data:text/html,x', 'https://a.com/x.jpg', 'img/x"onerror.webp'] });
    expect(p.images).toEqual(['img/f01.webp', 'https://a.com/x.jpg']);
  });
  it('catálogo real: ids únicos e imagens válidas', () => {
    expect(new Set(catalog.map((p) => p.id)).size).toBe(catalog.length);
    for (const p of catalog) {
      expect(sanitizeProduct(p), p.name).not.toBeNull();
      expect(sanitizeProduct(p).images.length, p.name).toBe(p.images.length);
      expect(p.images.length, p.name).toBeGreaterThan(0);
    }
  });
  it('pedido com item a consultar', () => {
    const o = createOrder({ cart: { 1: 1 }, products: [{ ...initialProducts[0], price: 0 }], customer: { name: 'A', phone: '1', address: 'x' } });
    expect(buildOrderText(o)).toContain('preço a consultar');
  });
  it('destaques intercalam categorias', () => {
    const cats = filterProducts(initialProducts, {}).slice(0, 3).map((p) => p.category);
    expect(new Set(cats).size).toBe(3);
    expect(interleaveByCategory(initialProducts)).toHaveLength(initialProducts.length);
  });
});

import { thumbOf, sanitizeSettings, createOrderFromRequest, ORDER_STATUSES } from '../src/lib/logic.js';
describe('v0.4', () => {
  it('thumbOf para os 3 tipos de imagem', () => {
    expect(thumbOf('img/f01.webp')).toBe('img/f01-sm.webp');
    expect(thumbOf('/api/img/abc123def')).toBe('/api/img/abc123def?size=sm');
    expect(thumbOf('idb:abc123')).toBe('idb:abc123-sm');
  });
  it('aceita imagens do servidor e locais, rejeita lixo', () => {
    const p = sanitizeProduct({ id: 1, name: 'x', price: 1, images: ['/api/img/abc123def', 'idb:abc123', '/api/img/../../x', 'idb:a'] });
    expect(p.images).toEqual(['/api/img/abc123def', 'idb:abc123']);
  });
  it('active/soldOut', () => {
    expect(sanitizeProduct({ id: 1, name: 'x', price: 1 }).active).toBe(true);
    expect(sanitizeProduct({ id: 1, name: 'x', price: 1, active: false }).active).toBe(false);
    const prods = [{ ...initialProducts[0], active: false }, { ...initialProducts[1], soldOut: true }, initialProducts[2]];
    expect(filterProducts(prods, {}).map((p) => p.id)).toEqual([2, 3]);
    expect(sanitizeCart({ 1: 1, 2: 1, 3: 1 }, prods)).toEqual({ 3: 1 });
  });
  it('settings: limpa e valida whatsapp', () => {
    const s = sanitizeSettings({ storeName: '  Loja X ', whatsappNumber: '+55 (83) 99999-8888', pixKey: 'a@b.c' });
    expect(s.storeName).toBe('Loja X');
    expect(s.whatsappNumber).toBe('5583999998888');
    expect(sanitizeSettings({ whatsappNumber: '123' }).whatsappNumber).toBe('');
    expect(sanitizeSettings(null, { storeName: 'D' }).storeName).toBe('D');
  });
  it('pedido do servidor ignora preço do cliente e junta itens repetidos', () => {
    const o = createOrderFromRequest({
      items: [{ id: 1, qty: 1, price: 0.01 }, { id: 1, qty: 2 }], products: initialProducts, isValidPhone: isValidPhoneBR,
      customer: { name: 'Maria Souza', phone: '83999998888', address: 'Centro' }, now: 1700000123456, rand: () => 0,
    });
    expect(o.items).toEqual([{ id: 1, name: 'Fone Bluetooth', price: 79.9, qty: 3 }]);
    expect(o.total).toBe(239.7);
    expect(o.status).toBe(ORDER_STATUSES[0]);
  });
  it('pedido rejeita produto inativo, dados inválidos e carrinho vazio', () => {
    const base = { products: [{ ...initialProducts[0], active: false }, initialProducts[1]], isValidPhone: isValidPhoneBR, customer: { name: 'Maria Souza', phone: '83999998888', address: 'Centro' } };
    expect(() => createOrderFromRequest({ ...base, items: [{ id: 1, qty: 1 }] })).toThrow();
    expect(() => createOrderFromRequest({ ...base, items: [] })).toThrow();
    expect(() => createOrderFromRequest({ ...base, items: [{ id: 2, qty: 1 }], customer: { name: 'a', phone: '1', address: '' } })).toThrow('Dados inválidos');
  });
});

import { usernameError, passwordError, nameError, normalizeUsername } from '../src/lib/logic.js';
import { hashPassword, verifyPassword, timingSafeEqual } from '../functions/_lib/passwords.js';
describe('contas', () => {
  it('usuário: normaliza e valida', () => {
    expect(normalizeUsername('  Elenilson ')).toBe('elenilson');
    expect(usernameError('elenilson')).toBe('');
    expect(usernameError('ana.maria_2')).toBe('');
    expect(usernameError('ab')).not.toBe('');
    expect(usernameError('com espaço')).not.toBe('');
    expect(usernameError('<script>')).not.toBe('');
  });
  it('senha: tamanho, letras+números, senhas fracas e igual ao usuário', () => {
    expect(passwordError('Loja2026forte')).toBe('');
    expect(passwordError('curta1')).toMatch(/8 caracteres/);
    expect(passwordError('somenteletras')).toMatch(/letras e números/);
    expect(passwordError('12345678')).not.toBe('');
    expect(passwordError('senha123')).toMatch(/fácil/);
    expect(passwordError('maria2026', 'maria2026')).toMatch(/fácil/);
    expect(passwordError('a1'.repeat(70))).toMatch(/128/);
  });
  it('nome', () => { expect(nameError('Ana')).toBe(''); expect(nameError(' ')).not.toBe(''); });
  it('hash PBKDF2: confere a senha certa, recusa a errada, sal diferente a cada hash', async () => {
    const h1 = await hashPassword('Loja2026forte'), h2 = await hashPassword('Loja2026forte');
    expect(h1).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(h1).not.toBe(h2);
    expect(await verifyPassword('Loja2026forte', h1)).toBe(true);
    expect(await verifyPassword('loja2026forte', h1)).toBe(false);
    expect(await verifyPassword('qualquer', undefined)).toBe(false);
    expect(await verifyPassword('qualquer', 'md5$abc')).toBe(false);
  });
  it('comparação em tempo constante', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
