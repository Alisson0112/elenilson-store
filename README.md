# Elenilson Store — v0.6

Loja virtual em Vite + JavaScript puro, hospedada grátis na **Cloudflare Pages**, com **painel administrativo completo** e banco de dados **Cloudflare D1**.

## Painel da loja (`seusite/#admin`)
Acesso com **usuário e senha**. Tudo é editável, sem mexer em código:
- **Produtos:** nome, categoria (pode criar nova), preço, preço antigo (mostra % de desconto), etiqueta (OFERTA, NOVO…), descrição, ícone, cor, **visível/oculto**, **esgotado**, ordem na vitrine, duplicar e excluir.
- **Preço direto na lista:** digite e aperte Enter. Vazio = “Consulte o preço”.
- **Fotos:** envie do computador ou tire na hora pelo celular (até 8 por produto), escolha a principal e reordene. As fotos são reduzidas automaticamente no navegador (uma foto de 3 MB vira ~120 KB).
- **Pedidos:** todos os pedidos dos clientes, com status (Aguardando, Pago, Enviado, Entregue, Cancelado), botão para o WhatsApp do cliente e exportação para planilha (CSV).
- **Loja:** nome, aviso do topo, texto de boas-vindas, WhatsApp e chave Pix.
- **Backup:** baixar/importar backup e restaurar o catálogo inicial.
- **Usuários:** o Dono cria contas para funcionários, define o perfil, desativa, redefine senha ou exclui.
- **Minha conta:** cada pessoa troca o próprio nome e senha e pode “Sair de todos os aparelhos”.

### Perfis
| | Dono | Funcionário |
|---|:-:|:-:|
| Produtos, fotos, preços, esgotado/visível | ✓ | ✓ |
| Pedidos (ver, mudar status, exportar) | ✓ | ✓ |
| Dados da loja (nome, WhatsApp, Pix…) | ✓ | — |
| Backup / importar / restaurar catálogo | ✓ | — |
| Criar e gerenciar usuários | ✓ | — |

### Esqueci a senha
- **Funcionário:** o Dono redefine em *Usuários → Editar → Nova senha*.
- **Dono:** na tela de login, “Esqueci minha senha” → informe a **chave de configuração** (o `ADMIN_PASSWORD` da Cloudflare), o usuário e a nova senha.

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
3. **Criar a chave de configuração:** no mesmo projeto → *Settings* → **Variables and Secrets** → *Add* → *Type*: **Secret** → *Variable name*: `ADMIN_PASSWORD` → *Value*: uma chave longa e secreta (mínimo 8 caracteres) → *Save*. Ela **não** é a senha do dia a dia: serve só para criar a primeira conta e recuperar o acesso. Guarde-a em local seguro.
4. **Republicar:** *Deployments* → no último deploy, menu **⋯** → **Retry deployment** (as configurações só valem a partir de um novo deploy).
5. Abra `https://elenilson-store.pages.dev/#admin` → tela **“Criar conta do dono”** → informe a chave de configuração, seu nome, um **usuário** e uma **senha** → *Criar conta e entrar*. O catálogo atual é copiado para o banco automaticamente e tudo fica editável. A partir daí, entre sempre com usuário e senha.

As tabelas são criadas sozinhas — não precisa rodar SQL. O plano gratuito do D1 (5 GB, milhões de leituras/dia) é mais que suficiente.

## Segurança
- Contas individuais; senhas guardadas só como hash **PBKDF2-SHA256** (100 mil iterações, sal único por senha) — ninguém, nem quem tiver acesso ao banco, vê a senha.
- Sessões no servidor: o cookie (**HttpOnly + Secure + SameSite=Strict**) leva um token aleatório de 256 bits; o banco guarda só o hash dele. Duração de 12 h, ou 30 dias com “Manter conectado”.
- Trocar/redefinir a senha, desativar ou excluir alguém encerra as sessões dessa pessoa na hora; “Sair de todos os aparelhos” disponível em *Minha conta*.
- Login com mensagem única (“usuário ou senha incorretos”) e tempo de resposta igual para usuário existente ou não — não dá para descobrir quem tem conta.
- Bloqueio após 8 tentativas erradas em 15 min por IP (e 20 por usuário); criação da 1ª conta e recuperação limitadas a 5 por hora.
- A loja nunca fica sem Dono: não dá para excluir, desativar ou rebaixar o último Dono ativo.
- Limite de 15 pedidos/hora por IP.
- Proteção anti-CSRF (cabeçalho próprio + checagem de origem) em todas as alterações.
- **Preços e totais do pedido são recalculados no servidor** — o cliente não consegue alterar o valor pelo navegador.
- Fotos validadas pelo conteúdo real (JPG/PNG/WebP; SVG e arquivos disfarçados são recusados); todo texto é escapado contra XSS.

## Estrutura
```
functions/            API (Cloudflare Pages Functions)
  api/catalog.js      GET catálogo público (admin: ?all=1 inclui ocultos)
  api/auth.js         GET quem está logado / se falta criar a 1ª conta
  api/login.js        POST entrar · DELETE sair (?all=1 = todos os aparelhos)
  api/setup.js        POST criar a conta do Dono (só com banco vazio + chave)
  api/recover.js      POST redefinir senha com a chave de configuração
  api/account.js      PUT minha conta (nome, trocar senha)
  api/users/…         GET/POST/PATCH/DELETE usuários (só Dono)
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
npx wrangler pages dev dist --d1 DB=local-db --binding ADMIN_PASSWORD=umaChaveDeConfiguracao
```

## Publicação
Cada commit na `main` do GitHub é publicado automaticamente pela Cloudflare Pages (preset **Vite**, build `npm run build`, saída `dist`). A pasta `functions/` é detectada sozinha.
