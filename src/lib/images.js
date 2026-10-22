/* Processamento de fotos no navegador (redimensiona + comprime) e armazenamento local (IndexedDB) para o modo sem servidor. */

const FULL = { side: 960, quality: 0.82, maxChars: 600_000 };
const THUMB = { side: 400, quality: 0.75, maxChars: 140_000 };
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const MIME = (() => {
  try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'; }
  catch { return 'image/jpeg'; }
})();

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* tenta o caminho clássico */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta imagem.')); };
    img.src = url;
  });
}

/** Desenha em canvas (fundo branco p/ PNG transparente) e reduz qualidade/tamanho até caber no limite. */
function encode(src, { side, quality, maxChars }) {
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  let s = Math.min(1, side / Math.max(w0, h0));
  for (let attempt = 0; attempt < 6; attempt++, s *= 0.8) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * s)); canvas.height = Math.max(1, Math.round(h0 * s));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    for (let q = quality; q >= 0.5; q -= 0.08) {
      const url = canvas.toDataURL(MIME, q);
      if (url.length <= maxChars) return url;
    }
  }
  throw new Error('Imagem grande demais mesmo após reduzir.');
}

/** File → { full, thumb } (data URLs). */
export async function processImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WebP).');
  if (file.size > MAX_FILE_BYTES) throw new Error('Imagem maior que 25 MB.');
  const bmp = await decode(file);
  try { return { full: encode(bmp, FULL), thumb: encode(bmp, THUMB) }; }
  finally { bmp.close?.(); }
}

/* ---------- IndexedDB (modo local) ---------- */
const cache = new Map(); // chave -> object URL

const openDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open('es_images', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('blobs');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const idb = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('blobs', mode);
    const r = fn(t.objectStore('blobs'));
    t.oncomplete = () => { db.close(); resolve(r?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
};
const toBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

/** Guarda a foto no aparelho e devolve a referência 'idb:<id>'. */
export async function saveLocalImage({ full, thumb }) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const [bf, bt] = [await toBlob(full), await toBlob(thumb)];
  await idb('readwrite', (s) => { s.put(bf, id); s.put(bt, `${id}-sm`); });
  cache.set(id, URL.createObjectURL(bf)); cache.set(`${id}-sm`, URL.createObjectURL(bt));
  return `idb:${id}`;
}

/** Carrega para a memória as fotos 'idb:' usadas pelos produtos (chamar antes de renderizar). */
export async function preloadLocalImages(products) {
  const keys = new Set();
  for (const p of products) for (const src of p.images || []) if (src.startsWith('idb:')) { keys.add(src.slice(4)); keys.add(`${src.slice(4)}-sm`); }
  const missing = [...keys].filter((k) => !cache.has(k));
  if (!missing.length) return false;
  try {
    for (const k of missing) {
      const blob = await idb('readonly', (s) => s.get(k));
      if (blob) cache.set(k, URL.createObjectURL(blob));
    }
  } catch { /* IndexedDB indisponível (aba privada): fotos locais não aparecem */ }
  return true;
}

/** Converte a referência de imagem em algo que o <img> entende. */
export const resolveSrc = (src) => (src.startsWith('idb:') ? cache.get(src.slice(4)) || '' : src);
