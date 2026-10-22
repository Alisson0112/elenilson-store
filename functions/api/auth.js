import { handle, json } from '../_lib/http.js';
import { getDb } from '../_lib/db.js';
import { getSession, setupAvailable } from '../_lib/auth.js';
import { countUsers } from '../_lib/users.js';

// Estado do acesso ao painel: quem está logado e se a loja ainda precisa da 1ª conta.
export const onRequestGet = handle(async ({ request, env }) => {
  const db = await getDb(env);
  const session = await getSession(request, env);
  return json({ user: session?.user ?? null, setupRequired: (await countUsers(db)) === 0, setupAvailable: setupAvailable(env) });
});
