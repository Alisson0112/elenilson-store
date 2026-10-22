import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { getDb, saveProduct, saveSettings, markSeeded, gcImages, listProducts, getSettings } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';
import { sanitizeProducts, sanitizeSettings } from '../../src/lib/logic.js';

// Substitui todo o catálogo (usado para ativar o painel com o catálogo inicial, restaurar e importar backup).
export const onRequestPost = handle(async ({ request, env }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await readJson(request, 3_000_000);
  const products = sanitizeProducts(body.products);
  if (!products) throw new HttpError(400, 'invalid_products');
  if (products.length > 2000) throw new HttpError(400, 'too_many_products');
  await db.prepare('DELETE FROM products').run();
  for (const [i, p] of products.entries()) await saveProduct(db, p, i + 1);
  if (body.settings) await saveSettings(db, sanitizeSettings(body.settings, (await getSettings(db)).settings));
  await markSeeded(db);
  await gcImages(db);
  return json({ products: await listProducts(db), settings: (await getSettings(db)).settings });
});
