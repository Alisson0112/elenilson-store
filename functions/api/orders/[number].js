import { handle, json, readJson, HttpError } from '../../_lib/http.js';
import { getDb } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { ORDER_STATUSES } from '../../../src/lib/logic.js';

const numberOf = (params) => {
  if (!/^ES\d{6,10}$/.test(params.number)) throw new HttpError(400, 'invalid_number');
  return params.number;
};

export const onRequestPatch = handle(async ({ request, env, params }) => {
  await requireAdmin(request, env);
  const number = numberOf(params);
  const { status } = await readJson(request, 1000);
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'invalid_status');
  const db = await getDb(env);
  const row = await db.prepare('SELECT data FROM orders WHERE number = ?').bind(number).first();
  if (!row) throw new HttpError(404, 'not_found');
  const data = { ...JSON.parse(row.data), status };
  await db.prepare('UPDATE orders SET status = ?1, data = ?2 WHERE number = ?3').bind(status, JSON.stringify(data), number).run();
  return json({ order: data });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  await db.prepare('DELETE FROM orders WHERE number = ?').bind(numberOf(params)).run();
  return json({ ok: true });
});
