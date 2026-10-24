/**
 * Prévia de link por produto: quando alguém compartilha https://loja/?p=ID no WhatsApp/Instagram,
 * o robô que gera a prévia não executa JavaScript — então trocamos as meta tags aqui no servidor
 * para mostrar a foto, o nome e o preço daquele produto. Sem ?p= a página passa intacta.
 */
import { initialProducts } from '../src/lib/data.js';
import { sanitizeProduct } from '../src/lib/logic.js';
import { money } from '../src/lib/utils.js';
import { listProducts, getSettings } from './_lib/db.js';

async function findProduct(env, id) {
  if (env.DB) {
    try {
      const { seeded } = await getSettings(env.DB);
      if (seeded) return (await listProducts(env.DB)).find((p) => p.id === id && p.active !== false) ?? null;
    } catch { /* banco indisponível: usa o catálogo inicial */ }
  }
  return initialProducts.find((p) => p.id === id) ?? null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = Number(url.searchParams.get('p'));
  const response = await context.next();
  if (!Number.isInteger(id) || id <= 0 || !(response.headers.get('content-type') || '').includes('text/html')) return response;

  let product = null;
  try { product = sanitizeProduct(await findProduct(context.env, id)); } catch { return response; }
  if (!product) return response;

  const title = `${product.name} | Elenilson Store`;
  const desc = `${product.price > 0 ? money(product.price) : 'Consulte o preço'} · ${(product.desc || product.category).replace(/[.!\s]+$/, '')} — peça pelo WhatsApp.`;
  // WhatsApp não exibe WebP de forma confiável na prévia → usamos sempre uma versão JPEG
  const src = product.images[0];
  const ogPath = !src ? null
    : /^img\/[fn]\d+\.webp$/.test(src) ? src.replace(/^img\/([fn]\d+)\.webp$/, '/img/og/$1.jpg')
    : src.startsWith('/api/img/') ? `${src.split('?')[0]}?size=og`
    : null;
  const image = ogPath ? new URL(ogPath, url.origin).href : `${url.origin}/og-image.jpg`;
  const pageUrl = `${url.origin}/?p=${product.id}`;
  const set = (value) => ({ element: (el) => el.setAttribute('content', value) });

  const out = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:url"]', set(pageUrl))
    .on('meta[property="og:image"]', set(image))
    .on('meta[property="og:image:width"]', { element: (el) => (ogPath ? el.remove() : null) })
    .on('meta[property="og:image:height"]', { element: (el) => (ogPath ? el.remove() : null) })
    .on('meta[property="og:image:alt"]', set(product.name))
    .on('meta[name="twitter:card"]', set(ogPath ? 'summary' : 'summary_large_image'))
    .transform(response);
  const headers = new Headers(out.headers);
  headers.set('cache-control', 'public, max-age=300');
  return new Response(out.body, { status: out.status, headers });
}
