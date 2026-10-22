import { handle, json, readJson } from '../_lib/http.js';
import { getDb, getSettings, saveSettings } from '../_lib/db.js';
import { requireOwner } from '../_lib/auth.js';
import { sanitizeSettings } from '../../src/lib/logic.js';

export const onRequestPut = handle(async ({ request, env }) => {
  await requireOwner(request, env);
  const db = await getDb(env);
  const current = (await getSettings(db)).settings;
  const next = sanitizeSettings({ ...current, ...(await readJson(request, 20000)) }, current);
  await saveSettings(db, next);
  return json({ settings: next });
});
