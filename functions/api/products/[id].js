import { handle, json, readJson, HttpError } from '../../_lib/http.js';
import { getDb, saveProduct, gcImages, markSeeded } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { sanitizeProduct } from '../../../src/lib/logic.js';

const idOf = (params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id');
  return id;
};

export const onRequestPut = handle(async ({ request, env, params }) => {
  await requireAdmin(request, env);
  const id = idOf(params);
  const db = await getDb(env);
  const product = sanitizeProduct({ ...(await readJson(request, 50000)), id });
  if (!product) throw new HttpError(400, 'invalid_product');
  const exists = await db.prepare('SELECT position FROM products WHERE id = ?').bind(id).first();
  await saveProduct(db, product, exists?.position);
  await gcImages(db);
  return json({ product });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  await db.prepare('DELETE FROM products WHERE id = ?').bind(idOf(params)).run();
  await markSeeded(db);
  await gcImages(db);
  return json({ ok: true });
});
