import { handle, json, readJson, clientIp, HttpError } from '../../_lib/http.js';
import { getDb, listProducts, rateCheck, rateHit, nowSec } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { createOrderFromRequest } from '../../../src/lib/logic.js';
import { isValidPhoneBR } from '../../../src/lib/utils.js';

// Público: registra um pedido. Preços e total são recalculados aqui a partir do catálogo.
export const onRequestPost = handle(async ({ request, env }) => {
  const db = await getDb(env);
  const ip = clientIp(request);
  await rateCheck(db, ip, 'order', 15, 3600);
  const body = await readJson(request, 30000);
  let order;
  try {
    order = createOrderFromRequest({ items: body.items, customer: body.customer, products: await listProducts(db), isValidPhone: isValidPhoneBR });
  } catch (e) {
    throw new HttpError(400, e.message || 'invalid_order', e.errors ? { errors: e.errors } : {});
  }
  for (let tries = 0; ; tries++) {
    try {
      await db.prepare('INSERT INTO orders (number, data, status, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(order.number, JSON.stringify(order), order.status, nowSec()).run();
      break;
    } catch (e) {
      if (tries >= 3) throw e;
      order.number = 'ES' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10);
    }
  }
  await rateHit(db, ip, 'order');
  return json({ order }, 201);
});

export const onRequestGet = handle(async ({ request, env }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  const { results } = await db.prepare('SELECT data, status FROM orders ORDER BY created_at DESC LIMIT 500').all();
  return json({ orders: results.map((r) => ({ ...JSON.parse(r.data), status: r.status })) });
});
