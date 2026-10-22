import { HttpError } from './http.js';
import { nowSec } from './db.js';
import { hashPassword } from './passwords.js';
import { normalizeUsername, usernameError, passwordError, nameError, ROLES } from '../../src/lib/logic.js';

export const countUsers = async (db) => (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n;
export const findUser = (db, username) =>
  db.prepare('SELECT id, username, name, role, pass, active FROM users WHERE username = ?').bind(normalizeUsername(username)).first();
export const getUserById = (db, id) => db.prepare('SELECT id, username, name, role, active FROM users WHERE id = ?').bind(id).first();

const fail = (msg) => { throw new HttpError(400, 'invalid_input', { message: msg }); };

/** Valida e cria uma conta. Lança 409 se o usuário já existir. */
export async function createUser(db, { name, username, password, role }) {
  const u = normalizeUsername(username);
  const err = nameError(name) || usernameError(u) || passwordError(password, u) || (ROLES[role] ? '' : 'Perfil inválido.');
  if (err) fail(err);
  if (await findUser(db, u)) throw new HttpError(409, 'username_taken');
  const res = await db.prepare('INSERT INTO users (username, name, role, pass, active, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)')
    .bind(u, String(name).trim(), role, await hashPassword(password), nowSec()).run();
  return { id: res.meta.last_row_id, username: u, name: String(name).trim(), role };
}

export async function setPassword(db, userId, password, username) {
  const err = passwordError(password, username);
  if (err) fail(err);
  await db.prepare('UPDATE users SET pass = ?1 WHERE id = ?2').bind(await hashPassword(password), userId).run();
}

/** Garante que sempre sobra pelo menos um Dono ativo. */
export async function assertNotLastOwner(db, userId) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND active = 1 AND id <> ?").bind(userId).first();
  if (row.n === 0) throw new HttpError(400, 'last_owner');
}
