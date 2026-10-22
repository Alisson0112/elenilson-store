/** Escapa texto para uso seguro dentro de HTML/atributos. */
export const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Normaliza para busca: minúsculas, sem acentos. */
export const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');

/** Telefone BR válido: DDD + 8/9 dígitos (aceita prefixo 55). */
export function isValidPhoneBR(value) {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return (d.length === 10 || d.length === 11) && !/^(\d)\1+$/.test(d);
}

export function formatPhoneBR(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function discountPct(p) {
  return p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
}

/** localStorage resiliente: nunca lança (modo privado, cota, JSON corrompido). */
export function createStorage(backend) {
  const mem = new Map();
  let ls = backend;
  if (ls === undefined) {
    try { ls = globalThis.localStorage ?? null; } catch { ls = null; }
  }
  return {
    get(key, fallback) {
      try {
        const raw = ls ? ls.getItem(key) : mem.get(key) ?? null;
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try { if (ls) ls.setItem(key, raw); else mem.set(key, raw); return true; }
      catch { mem.set(key, raw); return false; }
    },
    remove(key) { try { ls ? ls.removeItem(key) : mem.delete(key); } catch { /* ignore */ } },
  };
}

export function buildOrderText(order, { storeName, pixKey } = {}) {
  const lines = [
    `*Novo pedido ${order.number}${storeName ? ' — ' + storeName : ''}*`,
    '',
    ...order.items.map((i) => `• ${i.qty}x ${i.name} — ${i.price > 0 ? money(i.price * i.qty) : 'preço a consultar'}`),
    '',
    `*Total: ${money(order.total)}*${order.items.some((i) => !(i.price > 0)) ? ' (+ itens a consultar)' : ''}`,
    '',
    `Cliente: ${order.customer.name}`,
    `WhatsApp: ${order.customer.phone}`,
    `Entrega: ${order.customer.address}`,
  ];
  if (order.customer.notes) lines.push(`Obs.: ${order.customer.notes}`);
  lines.push('', pixKey ? `Pagamento via Pix (chave: ${pixKey})` : 'Pagamento via Pix — aguardo a chave para pagar.');
  return lines.join('\n');
}

export const buildWhatsAppUrl = (number, text) =>
  `https://wa.me/${onlyDigits(number)}?text=${encodeURIComponent(text)}`;
