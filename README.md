# Elenilson Store — v0.3

Loja virtual de demonstração em Vite + JavaScript puro (sem framework), pronta para hospedagem estática gratuita (GitHub Pages).

## Rodar localmente
```bash
npm install
npm run dev      # desenvolvimento
npm test         # testes unitários (Vitest)
npm run build    # gera dist/
```

## Configurar a loja
Edite `src/config.js`:
- `whatsappNumber`: número da loja com país e DDD, só dígitos (ex.: `5583999999999`). Com ele, o pedido abre direto no WhatsApp com o resumo pronto. Vazio = o cliente copia o resumo.
- `pixKey`: chave Pix exibida no pedido (opcional).

## Catálogo e fotos
O catálogo real fica em `src/lib/data.js` (49 produtos, 7 categorias). As fotos ficam em `public/img/` (`fNN.webp` grande e `fNN-sm.webp` miniatura).
- Para trocar um preço, edite o número em `P(id, categoria, nome, PREÇO, ...)`. **Preço `0` = "Consulte o preço"** (o item entra no pedido e a loja informa o valor no atendimento).
- Preços já preenchidos vieram das etiquetas visíveis nas fotos (cadeado, carregadores, Melão de São Caetano, Mounjaro Natural, GineVida). Confira.
- Se mudar o catálogo depois de já ter aberto a loja num navegador, o catálogo salvo localmente prevalece; use "Restaurar catálogo" em `#admin` ou limpe os dados do site.

## Painel "Minha loja" (demonstração)
Fica oculto para clientes. Acesse `seusite/#admin` para ver o botão. Cadastra/remove produtos e exporta pedidos, mas **só no navegador atual** (localStorage) e **sem login** — não é seguro nem compartilhado entre dispositivos.

## Publicar no GitHub Pages
1. Suba o projeto num repositório (branch `main`).
2. Em *Settings → Pages*, escolha **Source: GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` roda os testes, gera o build e publica a cada push.

Para aparecer no Google, cadastre o site no Google Search Console e solicite a indexação.

## O que mudou na v0.2
**Bugs corrigidos:** categorias/busca/ordenação não funcionavam (handlers inline fora do escopo do módulo); carrinho fechava ao alterar quantidade; tela de sucesso do pedido sumia; XSS por nome/descrição/cor de produto; app quebrava com localStorage corrompido; categoria "Outros" inacessível; build sem `base` (quebrava em subcaminho); dependência `lucide` não usada; emoji duplicado.

**Melhorias:** código modular e testado; busca instantânea sem perder o foco e sem depender de acento; favoritos persistentes; detalhe do produto; selo de desconto e ordenação por maior desconto; validação e máscara de telefone no checkout; pedido via WhatsApp; limite de quantidade; sincronização entre abas; modais acessíveis (Esc, foco preso, ARIA); link "pular para o conteúdo"; respeita `prefers-reduced-motion`; favicon, manifest, Open Graph e robots.txt; deploy automático.

## Antes de vender de verdade
Pedidos e catálogo ainda ficam só no navegador. Para uso real: banco de dados (ex.: Supabase com RLS), login no painel, chave Pix e WhatsApp configurados. Nunca coloque chaves secretas no frontend.
