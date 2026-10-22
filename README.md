# Elenilson Store — v0.5

Loja virtual em Vite + JavaScript puro, hospedada grátis na **Cloudflare Pages**, com **painel administrativo completo** e banco de dados **Cloudflare D1**.

## Painel da loja (`seusite/#admin`)
Tudo é editável, sem mexer em código:
- **Produtos:** nome, categoria (pode criar nova), preço, preço antigo (mostra % de desconto), etiqueta (OFERTA, NOVO…), descrição, ícone, cor, **visível/oculto**, **esgotado**, ordem na vitrine, duplicar e excluir.
- **Preço direto na lista:** digite e aperte Enter. Vazio = “Consulte o preço”.
- **Fotos:** envie do computador ou tire na hora pelo celular (até 8 por produto), escolha a principal e reordene. As fotos são reduzidas automaticamente no navegador (uma foto de 3 MB vira ~120 KB).
- **Pedidos:** todos os pedidos dos clientes, com status (Aguardando, Pago, Enviado, Entregue, Cancelado), botão para o WhatsApp do cliente e exportação para planilha (CSV).
- **Loja:** nome, aviso do topo, texto de boas-vindas, WhatsApp e chave Pix.
- **Backup:** baixar/importar backup e restaurar o catálogo inicial.

## No celular (pelo link, sem instalar nada)
- Barra inferior de app: Início, Categorias, Buscar, Favoritos e Carrinho.
- Produto, carrinho e checkout abrem como telas que sobem de baixo; fotos passam com o dedo.
- O botão **Voltar** do celular fecha a tela aberta em vez de sair da loja.
- Campos com 16px: o iPhone não dá zoom ao digitar.
- Cada produto tem link próprio (`/?p=ID`) e botão **Compartilhar**. Ao mandar esse link no WhatsApp, a prévia mostra a **foto, o nome e o preço do produto** (gerada no servidor por `functions/index.js`).
- Quem quiser pode "Adicionar à tela inicial": há ícones e manifesto de app.

## ⚠️ Ativar o banco de dados (obrigatório para as edições valerem para todos)
Sem esta etapa, a loja funciona normalmente, mas o painel abre em **modo local**: as alterações ficam só no navegador de quem editou. Faça uma vez (≈5 min), no painel da Cloudflare:

1. **Criar o banco:** *Workers & Pages* → **D1 SQL Database** → *Create* → nome `elenilson-store` → *Create*.
2. **Ligar o banco ao site:** *Workers & Pages* → projeto **elenilson-store** → *Settings* → **Bindings** → *Add* → **D1 database** → *Variable name*: `DB` (exatamente assim, maiúsculo) → escolha o banco `elenilson-store` → *Save*.
3. **Criar a senha do painel:** no mesmo projeto → *Settings* → **Variables and Secrets** → *Add* → *Type*: **Secret** → *Variable name*: `ADMIN_PASSWORD` → *Value*: sua senha (mínimo 8 caracteres; use uma forte) → *Save*.
4. **Republicar:** *Deployments* → no último deploy, menu **⋯** → **Retry deployment** (as configurações só valem a partir de um novo deploy).
5. Abra `https://elenilson-store.pages.dev/#admin`, entre com a senha. No primeiro acesso o catálogo atual é copiado para o banco automaticamente e tudo fica editável.

As tabelas são criadas sozinhas — não precisa rodar SQL. O plano gratuito do D1 (5 GB, milhões de leituras/dia) é mais que suficiente.

## Segurança
- Senha só no servidor (segredo da Cloudflare); sessão por **cookie HttpOnly + Secure + SameSite=Strict**, assinado com HMAC e válido por 12 h.
- Bloqueio após 8 senhas erradas em 15 min; limite de 15 pedidos/hora por IP.
- Proteção anti-CSRF (cabeçalho próprio + checagem de origem) em todas as alterações.
- **Preços e totais do pedido são recalculados no servidor** — o cliente não consegue alterar o valor pelo navegador.
- Fotos validadas pelo conteúdo real (JPG/PNG/WebP; SVG e arquivos disfarçados são recusados); todo texto é escapado contra XSS.

## Estrutura
```
functions/            API (Cloudflare Pages Functions)
  api/catalog.js      GET catálogo público (admin: ?all=1 inclui ocultos)
  api/login.js        POST entrar · DELETE sair
  api/products/…      POST criar · PUT editar · DELETE excluir · PUT order (reordenar)
  api/img/…           POST enviar foto · GET foto (cache longo)
  api/orders/…        POST pedido (público) · GET listar · PATCH status · DELETE
  api/settings.js     PUT dados da loja
  api/import.js       POST substituir catálogo (ativação, backup, restaurar)
src/main.js           vitrine
src/admin.js          painel (carregado só ao abrir #admin)
src/lib/              lógica compartilhada pela vitrine e pela API (validações, pedido, etc.)
tests/                testes (Vitest)
```

## Desenvolvimento
```bash
npm install
npm run dev          # só a vitrine (painel em modo local)
npm test             # testes unitários
npm run build        # gera dist/
# loja + API + banco local (opcional):
npx wrangler pages dev dist --d1 DB=local-db --binding ADMIN_PASSWORD=umaSenhaForte
```

## Publicação
Cada commit na `main` do GitHub é publicado automaticamente pela Cloudflare Pages (preset **Vite**, build `npm run build`, saída `dist`). A pasta `functions/` é detectada sozinha.
