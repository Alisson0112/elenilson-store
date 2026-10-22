import { DEFAULT_SETTINGS } from './data.js';
import { sanitizeSettings } from './logic.js';

/**
 * mode: null (ainda verificando) | 'server' (Cloudflare Functions + D1 configurados) | 'local' (só navegador).
 * No modo local tudo continua funcionando, mas as edições ficam apenas no aparelho de quem editou.
 */
export const backend = { mode: null, admin: false, adminConfigured: false, seeded: false };

/** Configurações editáveis da loja (objeto compartilhado e mutável). */
export const settings = { ...DEFAULT_SETTINGS };
export function applySettings(raw) {
  return Object.assign(settings, sanitizeSettings(raw, DEFAULT_SETTINGS));
}

/** fetch JSON com timeout. Lança Error(code) com .status e .data em respostas de erro. */
export async function api(method, path, body, timeoutMs = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method,
      headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-requested-with': 'es-admin' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: ctl.signal,
    });
    const isJson = (res.headers.get('content-type') || '').includes('json');
    const data = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok) throw Object.assign(new Error(data?.error || `http_${res.status}`), { status: res.status, data });
    if (data === null) throw Object.assign(new Error('bad_response'), { status: res.status });
    return data;
  } finally { clearTimeout(timer); }
}

export const fetchCatalog = (all = false) => api('GET', `/api/catalog${all ? '?all=1' : ''}`, undefined, 8000);

const MESSAGES = {
  wrong_password: 'Senha incorreta.',
  too_many_requests: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  unauthorized: 'Sessão expirada. Entre novamente.',
  invalid_image: 'Imagem inválida ou grande demais.',
  invalid_product: 'Confira o nome e o preço do produto.',
  payload_too_large: 'Arquivo grande demais.',
  admin_not_configured: 'A senha do painel ainda não foi configurada na Cloudflare.',
  weak_password: 'A senha configurada na Cloudflare precisa ter pelo menos 8 caracteres.',
};
export const friendlyError = (err) =>
  MESSAGES[err?.message] || (err?.name === 'AbortError' ? 'Tempo esgotado. Verifique a conexão.' : 'Não foi possível concluir. Tente novamente.');
