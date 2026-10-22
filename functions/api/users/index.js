import { handle, json, readJson } from '../../_lib/http.js';
import { getDb } from '../../_lib/db.js';
import { requireOwner } from '../../_lib/auth.js';
import { createUser } from '../../_lib/users.js';

// Só o Dono: listar e criar contas.
export const onRequestGet = handle(async ({ request, env }) => {
  await requireOwner(request, env);
  const db = await getDb(env);
  const { results } = await db.prepare('SELECT id, username, name, role, active, created_at, last_login FROM users ORDER BY role DESC, name').all();
  return json({ users: results.map((u) => ({ ...u, active: u.active === 1 })) });
});

export const onRequestPost = handle(async ({ request, env }) => {
  await requireOwner(request, env);
  const db = await getDb(env);
  const body = await readJson(request, 3000);
  return json({ user: await createUser(db, body) }, 201);
});
