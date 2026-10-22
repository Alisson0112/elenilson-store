import { handle, json } from '../_lib/http.js';
import { getDb, listProducts, getSettings } from '../_lib/db.js';
import { isAdmin } from '../_lib/auth.js';

// Público: só produtos visíveis. Admin logado com ?all=1 recebe também os ocultos.
export const onRequestGet = handle(async ({ request, env }) => {
  const db = await getDb(env);
  const admin = await isAdmin(request, env);
  const all = admin && new URL(request.url).searchParams.get('all') === '1';
  const [products, { settings, seeded }] = await Promise.all([listProducts(db), getSettings(db)]);
  return json({
    products: all ? products : products.filter((p) => p.active !== false),
    settings, seeded, admin,
    adminConfigured: Boolean(env.ADMIN_PASSWORD) && String(env.ADMIN_PASSWORD).length >= 8,
  });
});
