# Elenilson Store — primeira versão

Loja virtual responsiva em React-free Vite/JavaScript para facilitar a publicação inicial em hospedagem estática gratuita.

## Executar localmente
1. Instale Node.js em um ambiente que permita isso.
2. Dentro da pasta, execute `npm install`.
3. Execute `npm run dev` e abra o endereço mostrado no terminal.
4. Para validar a versão de publicação, execute `npm run build`. A pasta final será `dist/`.

## Recursos da demonstração
- Catálogo, categorias, busca e ordenação por preço.
- Carrinho persistido no navegador.
- Formulário para registrar um pedido de demonstração.
- Cadastro e remoção local de produtos pelo botão “Minha loja”.
- Exportação dos pedidos de demonstração em JSON.
- Layout responsivo e metadados básicos para mecanismos de busca.

## Importante antes de vender de verdade
Esta primeira versão ainda NÃO é um sistema de produção: catálogo, carrinho e pedidos ficam apenas no navegador atual (`localStorage`); o pedido não é enviado à loja nem salvo em servidor. O painel administrativo não tem login e serve apenas para demonstração. O Pix ainda não tem chave configurada e nenhum pagamento é processado.

Próxima etapa necessária: conectar a um projeto Supabase, criar tabelas e políticas de segurança (RLS), proteger o painel com autenticação, registrar pedidos no banco, configurar a chave Pix e o contato da loja, e só então publicar. Nunca colocar chave secreta de servidor no frontend.

## Publicar gratuitamente na Cloudflare Pages
Após configurar o projeto no GitHub, importe o repositório na Cloudflare Pages com:
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`

A Cloudflare fornece um subdomínio `*.pages.dev`. A publicação exige que o proprietário entre na sua conta e autorize a integração. Para aparecer no Google, após a publicação configure Google Search Console e solicite indexação; isso pode levar tempo e não garante posições.
