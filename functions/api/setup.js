import { handle, json, readJson, clientIp, HttpError } from '../_lib/http.js';
import { getDb, rateCheck, rateHit } from '../_lib/db.js';
import { assertSameOrigin, checkSetupKey, createSession, sessionCookie, isSecure } from '../_lib/auth.js';
import { countUsers, createUser } from '../_lib/users.js';

// Cria a PRIMEIRA conta (Dono). Só funciona com o banco sem usuários e com a chave de configuração correta.
export const onRequestPost = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const db = await getDb(env);
  const ip = clientIp(request);
  await rateCheck(db, ip, 'setup', 5, 3600);
  if ((await countUsers(db)) > 0) throw new HttpError(409, 'already_setup');
  const body = await readJson(request, 3000);
  if (!(await checkSetupKey(env, body.setupKey))) { await rateHit(db, ip, 'setup'); throw new HttpError(401, 'invalid_setup_key'); }
  const user = await createUser(db, { name: body.name, username: body.username, password: body.password, role: 'owner' });
  const { token, ttl } = await createSession(db, user, { userAgent: request.headers.get('user-agent') });
  return json({ user }, 201, { 'set-cookie': sessionCookie(token, ttl, isSecure(request)) });
});
