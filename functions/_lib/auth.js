/**
 * Autenticação do painel: contas (usuário + senha) e sessões guardadas no D1.
 * - Cookie com token aleatório de 256 bits; no banco fica só o SHA-256 do token (vazar o banco não vaza sessões).
 * - Sessão some ao sair, ao trocar a senha, ao desativar/excluir o usuário ou ao expirar.
 * - ADMIN_PASSWORD (segredo da Cloudflare) virou "chave de configuração": só serve para criar a 1ª conta e recuperar acesso.
 */
import { HttpError } from './http.js';
import { getDb, nowSec } from './db.js';
import { timingSafeEqual } from './passwords.js';

const COOKIE = 'es_session';
const TTL_SHORT = 12 * 3600;        // padrão: 12 horas
const TTL_LONG = 30 * 24 * 3600;    // "manter conectado": 30 dias
const enc = new TextEncoder();

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role });
export const isSecure = (request) => new URL(request.url).protocol === 'https:';

/* ---------- sessões ---------- */
export async function createSession(db, user, { remember = false, userAgent = '' } = {}) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const ttl = remember ? TTL_LONG : TTL_SHORT;
  const t = nowSec();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at, user_agent) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(await sha256(token), user.id, t + ttl, t, String(userAgent || '').slice(0, 200)),
    db.prepare('UPDATE users SET last_login = ?1 WHERE id = ?2').bind(t, user.id),
  ]);
  return { token, ttl };
}
export const sessionCookie = (token, ttl, secure = true) =>
  `${COOKIE}=${token}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${ttl}`;
export const clearCookie = (secure = true) => `${COOKIE}=; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`;

const readToken = (request) => /(?:^|;\s*)es_session=([\w-]{40,64})(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1] ?? null;

/** Sessão válida → { tokenHash, user }; caso contrário null. Nunca lança por falta de banco. */
export async function getSession(request, env) {
  if (!env.DB) return null;
  const token = readToken(request);
  if (!token) return null;
  const db = await getDb(env);
  const row = await db.prepare(
    'SELECT s.token_hash, s.expires_at, u.id, u.username, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.active = 1',
  ).bind(await sha256(token)).first();
  if (!row || row.expires_at < nowSec()) return null;
  return { tokenHash: row.token_hash, user: publicUser(row) };
}

export const isAdmin = async (request, env) => Boolean(await getSession(request, env).catch(() => null));

/** Exige usuário logado (dono ou funcionário). Em alterações exige também proteção anti-CSRF. Devolve o usuário. */
export async function requireAdmin(request, env) {
  assertSameOrigin(request);
  const session = await getSession(request, env);
  if (!session) throw new HttpError(401, 'unauthorized');
  return session.user;
}
/** Exige o perfil Dono (dados da loja, backup, usuários). */
export async function requireOwner(request, env) {
  const user = await requireAdmin(request, env);
  if (user.role !== 'owner') throw new HttpError(403, 'owner_only');
  return user;
}

export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (request.headers.get('x-requested-with') !== 'es-admin') throw new HttpError(403, 'forbidden');
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, 'forbidden');
}

/* ---------- chave de configuração (ADMIN_PASSWORD) ---------- */
export const setupAvailable = (env) => Boolean(env.ADMIN_PASSWORD) && String(env.ADMIN_PASSWORD).length >= 8;

/** Compara a chave sem vazar informação por tempo (compara SHA-256 de tamanho fixo). */
export async function checkSetupKey(env, given) {
  if (!setupAvailable(env)) throw new HttpError(503, 'setup_not_configured');
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode('k:' + String(given ?? ''))),
    crypto.subtle.digest('SHA-256', enc.encode('k:' + env.ADMIN_PASSWORD)),
  ]);
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}
