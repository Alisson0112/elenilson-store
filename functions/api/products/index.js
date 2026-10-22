import { handle, json, readJson, HttpError } from '../../_lib/http.js';
import { getDb, saveProduct, nextProductId } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { sanitizeProduct } from '../../../src/lib/logic.js';

export const onRequestPost = handle(async ({ request, env }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await readJson(request, 50000);
  const product = sanitizeProduct({ ...body, id: await nextProductId(db) });
  if (!product) throw new HttpError(400, 'invalid_product');
  await saveProduct(db, product);
  return json({ product }, 201);
});
