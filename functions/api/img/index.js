import { handle, json, readJson, HttpError } from '../../_lib/http.js';
import { getDb, nowSec } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';

const MAX = { full: 700_000, sm: 160_000 }; // tamanho máximo em caracteres base64

/** Confere o tipo real pelos primeiros bytes (não confia só no que o navegador declarou). */
function sniff(b64) {
  const head = atob(b64.slice(0, 24));
  const b = [...head].map((c) => c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && head.slice(1, 4) === 'PNG') return 'image/png';
  if (head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function parse(dataUrl, size) {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ''));
  if (!m || m[2].length > MAX[size]) throw new HttpError(400, 'invalid_image');
  const real = sniff(m[2]);
  if (!real || real !== m[1]) throw new HttpError(400, 'invalid_image');
  return { type: real, data: m[2] };
}

// Recebe a foto já redimensionada pelo navegador: { full, thumb } em data URL. Responde com o endereço público.
export const onRequestPost = handle(async ({ request, env }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await readJson(request, 1_000_000);
  const full = parse(body.full, 'full'), sm = parse(body.thumb, 'sm');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const t = nowSec();
  await db.batch([
    db.prepare('INSERT INTO images (id, size, type, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, 'full', full.type, full.data, t),
    db.prepare('INSERT INTO images (id, size, type, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, 'sm', sm.type, sm.data, t),
  ]);
  return json({ url: `/api/img/${id}` }, 201);
});
