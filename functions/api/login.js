import { handle, json, readJson, clientIp, HttpError } from '../_lib/http.js';
import { getDb, rateCheck, rateHit, rateClear } from '../_lib/db.js';
import { checkPassword, sessionCookie, clearCookie, assertSameOrigin, isSecure } from '../_lib/auth.js';

export const onRequestPost = handle(async ({ request, env }) => {
  assertSameOrigin(request);
  const db = await getDb(env);
  const ip = clientIp(request);
  await rateCheck(db, ip, 'login', 8, 900); // 8 falhas / 15 min por IP
  const { password } = await readJson(request, 2000);
  if (!(await checkPassword(env, password))) {
    await rateHit(db, ip, 'login');
    throw new HttpError(401, 'wrong_password');
  }
  await rateClear(db, ip, 'login');
  return json({ ok: true }, 200, { 'set-cookie': await sessionCookie(env, isSecure(request)) });
});

// Logout: apaga o cookie
export const onRequestDelete = handle(async ({ request }) => {
  assertSameOrigin(request);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(isSecure(request)) });
});
