import { HttpError } from './http.js';

const enc = new TextEncoder();
const COOKIE = 'es_admin';
const TTL = 12 * 3600;

const secretOf = (env) => {
  const pw = env.ADMIN_PASSWORD;
  if (!pw) throw new HttpError(503, 'admin_not_configured');
  if (String(pw).length < 8) throw new HttpError(503, 'weak_password');
  return env.SESSION_SECRET || pw;
};

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const equal = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

/** Compara a senha sem vazar tamanho/conteúdo por tempo (compara HMACs de tamanho fixo). */
export async function checkPassword(env, given) {
  const secret = secretOf(env);
  return equal(await hmac(secret, 'pw:' + String(given ?? '')), await hmac(secret, 'pw:' + env.ADMIN_PASSWORD));
}

export async function sessionCookie(env, secure = true) {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const sig = b64url(await hmac(secretOf(env), 'admin.' + exp));
  return `${COOKIE}=${exp}.${sig}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${TTL}`;
}
export const clearCookie = (secure = true) => `${COOKIE}=; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`;

export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD || String(env.ADMIN_PASSWORD).length < 8) return false;
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`).exec(request.headers.get('cookie') || '');
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  const expected = await hmac(secretOf(env), 'admin.' + m[1]);
  return b64url(expected) === m[2];
}

/** Exige sessão de admin. Em métodos que alteram dados exige também cabeçalho customizado e mesma origem (anti-CSRF). */
export async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) throw new HttpError(401, 'unauthorized');
  assertSameOrigin(request);
}

export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (request.headers.get('x-requested-with') !== 'es-admin') throw new HttpError(403, 'forbidden');
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, 'forbidden');
}

export const isSecure = (request) => new URL(request.url).protocol === 'https:';
