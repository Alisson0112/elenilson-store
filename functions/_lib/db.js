import { HttpError } from './http.js';
import { sanitizeProduct, sanitizeSettings } from '../../src/lib/logic.js';
import { DEFAULT_SETTINGS } from '../../src/lib/data.js';

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, data TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS images (id TEXT NOT NULL, size TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (id, size))',
  'CREATE TABLE IF NOT EXISTS orders (number TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at)',
  'CREATE TABLE IF NOT EXISTS rate (ip TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_rate ON rate (ip, kind, at)',
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','staff')), pass TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_login INTEGER)",
  'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, user_agent TEXT)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)',
];

let ready = null;
/** Devolve o D1 já com as tabelas criadas (idempotente, 1x por isolate). */
export async function getDb(env) {
  if (!env.DB) throw new HttpError(503, 'not_configured');
  if (!ready) ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { ready = null; throw e; });
  await ready;
  return env.DB;
}

export const nowSec = () => Math.floor(Date.now() / 1000);

/* ---------- produtos ---------- */
export async function listProducts(db) {
  const { results } = await db.prepare('SELECT data FROM products ORDER BY position, id').all();
  return results.map((r) => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);
}

export async function saveProduct(db, product, position) {
  const pos = position ?? (await db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM products').first()).n;
  await db.prepare(
    'INSERT INTO products (id, data, position, updated_at) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  ).bind(product.id, JSON.stringify(product), pos, nowSec()).run();
  await markSeeded(db);
}

export const nextProductId = async (db) => (await db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM products').first()).n;

/* ---------- configurações ---------- */
export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const raw = {};
  for (const r of results) { try { raw[r.key] = JSON.parse(r.value); } catch { /* ignora */ } }
  return { settings: sanitizeSettings(raw, DEFAULT_SETTINGS), seeded: raw._seeded === true };
}

export async function saveSettings(db, settings) {
  await db.batch(Object.entries(settings).map(([k, v]) =>
    db.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, JSON.stringify(v))));
}

// "seeded" = o dono já assumiu o catálogo; a partir daí catálogo vazio significa vazio (não volta o padrão).
export const markSeeded = (db) =>
  db.prepare("INSERT INTO settings (key, value) VALUES ('_seeded', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();

/* ---------- imagens ---------- */
/** Apaga imagens enviadas que nenhum produto usa mais (com 10 min de tolerância para edições em andamento). */
export async function gcImages(db) {
  const used = new Set();
  for (const p of await listProducts(db)) {
    for (const src of sanitizeProduct(p)?.images ?? []) { const m = /^\/api\/img\/([\w-]+)/.exec(src); if (m) used.add(m[1]); }
  }
  const { results } = await db.prepare('SELECT DISTINCT id FROM images WHERE created_at < ?').bind(nowSec() - 600).all();
  const orphans = results.map((r) => r.id).filter((id) => !used.has(id));
  if (orphans.length) await db.batch(orphans.map((id) => db.prepare('DELETE FROM images WHERE id = ?').bind(id)));
}

/* ---------- limite de requisições ---------- */
export async function rateCheck(db, ip, kind, max, windowSec) {
  const t = nowSec();
  await db.prepare('DELETE FROM rate WHERE at < ?').bind(t - 86400).run();
  const row = await db.prepare('SELECT COUNT(*) AS n FROM rate WHERE ip = ?1 AND kind = ?2 AND at > ?3').bind(ip, kind, t - windowSec).first();
  if (row.n >= max) throw new HttpError(429, 'too_many_requests');
}
export const rateHit = (db, ip, kind) => db.prepare('INSERT INTO rate (ip, kind, at) VALUES (?1, ?2, ?3)').bind(ip, kind, nowSec()).run();
export const rateClear = (db, ip, kind) => db.prepare('DELETE FROM rate WHERE ip = ?1 AND kind = ?2').bind(ip, kind).run();
