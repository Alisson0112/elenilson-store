import { handle, json, readJson, HttpError } from '../../_lib/http.js';
import { getDb } from '../../_lib/db.js';
import { requireOwner } from '../../_lib/auth.js';
import { getUserById, setPassword, assertNotLastOwner } from '../../_lib/users.js';
import { nameError, ROLES } from '../../../src/lib/logic.js';

async function target(db, params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id');
  const user = await getUserById(db, id);
  if (!user) throw new HttpError(404, 'user_not_found');
  return user;
}

// Só o Dono: editar nome, perfil, ativo/inativo ou redefinir a senha de alguém.
export const onRequestPatch = handle(async ({ request, env, params }) => {
  const me = await requireOwner(request, env);
  const db = await getDb(env);
  const user = await target(db, params);
  const body = await readJson(request, 3000);
  const losesOwner = user.role === 'owner' && user.active === 1 && ((body.role && body.role !== 'owner') || body.active === false);
  if (losesOwner) await assertNotLastOwner(db, user.id);
  if (user.id === me.id && body.active === false) throw new HttpError(400, 'cannot_disable_self');

  const sets = [], binds = [];
  if (body.name !== undefined) {
    const err = nameError(body.name); if (err) throw new HttpError(400, 'invalid_input', { message: err });
    sets.push('name = ?'); binds.push(String(body.name).trim());
  }
  if (body.role !== undefined) { if (!ROLES[body.role]) throw new HttpError(400, 'invalid_input', { message: 'Perfil inválido.' }); sets.push('role = ?'); binds.push(body.role); }
  if (body.active !== undefined) { sets.push('active = ?'); binds.push(body.active ? 1 : 0); }
  if (sets.length) await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, user.id).run();
  if (body.password !== undefined) await setPassword(db, user.id, body.password, user.username);
  // senha redefinida, conta desativada ou perfil reduzido: derruba as sessões abertas dessa pessoa
  if (body.password !== undefined || body.active === false || (body.role && body.role !== user.role)) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  }
  const fresh = await getUserById(db, user.id);
  return json({ user: { ...fresh, active: fresh.active === 1 } });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const me = await requireOwner(request, env);
  const db = await getDb(env);
  const user = await target(db, params);
  if (user.id === me.id) throw new HttpError(400, 'cannot_delete_self');
  if (user.role === 'owner') await assertNotLastOwner(db, user.id);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true });
});
