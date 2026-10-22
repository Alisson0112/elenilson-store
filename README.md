# Elenilson Store — v0.3

Loja virtual de demonstração em Vite + JavaScript puro (sem framework), pronta para hospedagem estática gratuita (Cloudflare Pages ou GitHub Pages).

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

## Publicar na Cloudflare Pages (ou GitHub Pages)
O projeto está ligado ao GitHub: a cada commit na `main`, a Cloudflare Pages roda o build e republica sozinha.
- Framework preset: **Vite** · Build command: `npm run build` · Output directory: `dist`
- Ao enviar uma nova versão pelo site do GitHub (*Add file → Upload files*), envie **todas as pastas** (`src`, `public`, `tests`) junto com os arquivos da raiz. Enviar só alguns arquivos deixa a loja misturando versões.
- Depois do commit, acompanhe em *Cloudflare → Workers & Pages → elenilson-store → Deployments*. Se o build falhar, o site continua na versão anterior.
- Dica: no navegador, use Ctrl+F5 para ignorar o cache.

Para aparecer no Google, cadastre o site no Google Search Console e solicite a indexação.
