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
