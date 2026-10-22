import { handle, json, readJson, clientIp, HttpError } from '../_lib/http.js';
import { getDb, rateCheck, rateHit, rateClear } from '../_lib/db.js';
import { createSession, sessionCookie, clearCookie, assertSameOrigin, isSecure, getSession, publicUser } from '../_lib/auth.js';
import { verifyPassword } from '../_lib/passwords.js';
import { findUser } from '../_lib/users.js';
import { normalizeUsername } from '../../src/lib/logic.js';

// Entrar: usuário + senha. Limites: 8 erros/15 min por IP e 20 erros/15 min por usuário.
export const onRequestPost = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const db = await getDb(env);
  const ip = clientIp(request);
  const body = await readJson(request, 2000);
  const username = normalizeUsername(body.username).slice(0, 40);
  await rateCheck(db, ip, 'login', 8, 900);
  if (username) await rateCheck(db, `u:${username}`, 'login', 20, 900);

  const user = username ? await findUser(db, username) : null;
  const ok = await verifyPassword(String(body.password ?? '').slice(0, 200), user?.pass);
  if (!user || !ok || !user.active) {
    await rateHit(db, ip, 'login');
    if (username) await rateHit(db, `u:${username}`, 'login');
    // mensagem única: não revela se o usuário existe ou se está desativado
    throw new HttpError(401, 'invalid_credentials');
  }
  await rateClear(db, ip, 'login');
  const { token, ttl } = await createSession(db, user, { remember: body.remember === true, userAgent: request.headers.get('user-agent') });
  return json({ user: publicUser(user) }, 200, { 'set-cookie': sessionCookie(token, ttl, isSecure(request)) });
});

// Sair (só este aparelho) ou ?all=1 (todos os aparelhos deste usuário)
export const onRequestDelete = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const session = await getSession(request, env);
  if (session) {
    const db = await getDb(env);
    const all = new URL(request.url).searchParams.get('all') === '1';
    await (all
      ? db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(session.user.id)
      : db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash)).run();
  }
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(isSecure(request)) });
});
