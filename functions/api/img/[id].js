import { handle, HttpError } from '../../_lib/http.js';
import { getDb } from '../../_lib/db.js';

// Público e imutável (o id é único e nunca é reutilizado) → cache longo no navegador e na borda.
export const onRequestGet = handle(async ({ request, env, params }) => {
  if (!/^[\w-]{6,40}$/.test(params.id)) throw new HttpError(404, 'not_found');
  const wanted = new URL(request.url).searchParams.get('size');
  const size = ['sm', 'og'].includes(wanted) ? wanted : 'full';
  const db = await getDb(env);
  const q = db.prepare('SELECT type, data FROM images WHERE id = ?1 AND size = ?2');
  // fotos enviadas antes da variante 'og' existir caem para a versão grande
  const row = (await q.bind(params.id, size).first()) ?? (size === 'og' ? await q.bind(params.id, 'full').first() : null);
  if (!row) throw new HttpError(404, 'not_found');
  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'content-type': row.type,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
});
