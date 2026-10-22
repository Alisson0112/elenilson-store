export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });

/** Envolve um handler: erros conhecidos viram JSON com status; o resto vira 500 sem vazar detalhes. */
export const handle = (fn) => async (ctx) => {
  try { return await fn(ctx); }
  catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
    console.error('api_error', e?.stack || e);
    return json({ error: 'internal_error' }, 500);
  }
};

export async function readJson(request, maxChars = 1_000_000) {
  const text = await request.text();
  if (text.length > maxChars) throw new HttpError(413, 'payload_too_large');
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'invalid_json'); }
}

export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';
