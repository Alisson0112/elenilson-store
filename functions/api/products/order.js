import { handle, json, readJson, HttpError } from '../../_lib/http.js';
import { getDb } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';

// Define a ordem de exibição: recebe a lista completa de ids na ordem desejada.
export const onRequestPut = handle(async ({ request, env }) => {
  await requireAdmin(request, env);
  const { ids } = await readJson(request, 50000);
  if (!Array.isArray(ids) || ids.length > 2000 || !ids.every(Number.isInteger)) throw new HttpError(400, 'invalid_ids');
  const db = await getDb(env);
  await db.batch(ids.map((id, i) => db.prepare('UPDATE products SET position = ?1 WHERE id = ?2').bind(i + 1, id)));
  return json({ ok: true });
});
