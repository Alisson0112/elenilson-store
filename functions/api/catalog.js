import { handle, json } from '../_lib/http.js';
import { getDb, listProducts, getSettings } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';

// Público: só produtos visíveis. Admin logado com ?all=1 recebe também os ocultos.
export const onRequestGet = handle(async ({ request, env }) => {
  const db = await getDb(env);
  const session = await getSession(request, env);
  const admin = Boolean(session);
  const all = admin && new URL(request.url).searchParams.get('all') === '1';
  const [products, { settings, seeded }] = await Promise.all([listProducts(db), getSettings(db)]);
  return json({
    products: all ? products : products.filter((p) => p.active !== false),
    settings, seeded, admin,
  });
});
