import { handle, json, readJson, clientIp, HttpError } from '../_lib/http.js';
import { getDb, rateCheck, rateHit } from '../_lib/db.js';
import { assertSameOrigin, checkSetupKey, createSession, sessionCookie, isSecure, publicUser } from '../_lib/auth.js';
import { findUser, setPassword } from '../_lib/users.js';

// "Esqueci minha senha": com a chave de configuração da Cloudflare, define nova senha, reativa a conta e encerra as sessões antigas.
export const onRequestPost = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const db = await getDb(env);
  const ip = clientIp(request);
  await rateCheck(db, ip, 'recover', 5, 3600);
  const body = await readJson(request, 3000);
  if (!(await checkSetupKey(env, body.setupKey))) { await rateHit(db, ip, 'recover'); throw new HttpError(401, 'invalid_setup_key'); }
  const user = await findUser(db, body.username);
  if (!user) throw new HttpError(404, 'user_not_found');
  await setPassword(db, user.id, body.password, user.username);
  await db.batch([
    db.prepare('UPDATE users SET active = 1 WHERE id = ?').bind(user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
  ]);
  const { token, ttl } = await createSession(db, user, { userAgent: request.headers.get('user-agent') });
  return json({ user: publicUser(user) }, 200, { 'set-cookie': sessionCookie(token, ttl, isSecure(request)) });
});
