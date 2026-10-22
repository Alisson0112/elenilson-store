import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { getDb } from '../_lib/db.js';
import { requireAdmin, getSession } from '../_lib/auth.js';
import { verifyPassword } from '../_lib/passwords.js';
import { setPassword } from '../_lib/users.js';
import { nameError } from '../../src/lib/logic.js';

// Minha conta: trocar nome e/ou senha (exige a senha atual). Trocar a senha encerra as sessões dos outros aparelhos.
export const onRequestPut = handle(async ({ request, env }) => {
  const me = await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await readJson(request, 3000);
  if (body.name !== undefined) {
    const err = nameError(body.name);
    if (err) throw new HttpError(400, 'invalid_input', { message: err });
    await db.prepare('UPDATE users SET name = ?1 WHERE id = ?2').bind(String(body.name).trim(), me.id).run();
  }
  if (body.newPassword !== undefined) {
    const row = await db.prepare('SELECT pass FROM users WHERE id = ?').bind(me.id).first();
    if (!(await verifyPassword(String(body.currentPassword ?? ''), row?.pass))) throw new HttpError(401, 'wrong_current_password');
    await setPassword(db, me.id, body.newPassword, me.username);
    const { tokenHash } = await getSession(request, env);
    await db.prepare('DELETE FROM sessions WHERE user_id = ?1 AND token_hash <> ?2').bind(me.id, tokenHash).run();
  }
  const user = await db.prepare('SELECT id, username, name, role FROM users WHERE id = ?').bind(me.id).first();
  return json({ user });
});
