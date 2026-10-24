import { handle, json } from '../_lib/http.js';
import { getDb, listProducts, saveProduct, getSettings, saveSettings } from '../_lib/db.js';
import { requireOwner } from '../_lib/auth.js';
import { mergeCatalog } from '../../src/lib/logic.js';
import { initialProducts, CATALOG_VERSION, CATALOG_UPDATES } from '../../src/lib/data.js';

/**
 * Traz para o banco os produtos/fotos de versões novas do catálogo (ex.: lote de fotos novo),
 * sem sobrescrever o que o dono editou. Chamado automaticamente quando o Dono abre o painel.
 * Idempotente: depois de aplicada, a versão fica registrada e nada é refeito.
 */
export const onRequestPost = handle(async ({ request, env }) => {
  await requireOwner(request, env);
  const db = await getDb(env);
  const { seeded } = await getSettings(db);
  if (!seeded) return json({ version: CATALOG_VERSION, added: [], updated: [], skipped: 'not_seeded' });
  const row = await db.prepare("SELECT value FROM settings WHERE key = '_catalogVersion'").first();
  const fromVersion = row ? Number(JSON.parse(row.value)) || 1 : 1; // bancos ativados antes do versionamento = versão 1
  if (fromVersion >= CATALOG_VERSION) return json({ version: fromVersion, added: [], updated: [] });

  const current = await listProducts(db);
  const { products, added, updated } = mergeCatalog(current, { fromVersion, toVersion: CATALOG_VERSION, initial: initialProducts, updates: CATALOG_UPDATES });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of updated) {
    const pos = (await db.prepare('SELECT position FROM products WHERE id = ?').bind(id).first())?.position;
    await saveProduct(db, byId.get(id), pos);
  }
  for (const id of added) await saveProduct(db, byId.get(id)); // novos entram no fim da ordem
  await saveSettings(db, { _catalogVersion: CATALOG_VERSION });
  return json({ version: CATALOG_VERSION, added, updated });
});
