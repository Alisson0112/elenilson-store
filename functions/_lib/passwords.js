/**
 * Hash de senha com PBKDF2-SHA256 (WebCrypto nativo dos Workers).
 * 100.000 iterações é o máximo permitido pelo runtime da Cloudflare; com sal aleatório de 16 bytes por senha.
 * Formato guardado: pbkdf2-sha256$<iterações>$<sal base64>$<hash base64>
 */
const ITERATIONS = 100_000;
const enc = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

/** Sem hash (usuário inexistente) ainda faz o cálculo completo: o tempo de resposta não revela se o usuário existe. */
export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    await derive(password ?? '', crypto.getRandomValues(new Uint8Array(16)), ITERATIONS);
    return false;
  }
  const iterations = Math.min(Number(parts[1]) || ITERATIONS, ITERATIONS);
  return timingSafeEqual(await derive(password ?? '', unb64(parts[2]), iterations), unb64(parts[3]));
}
