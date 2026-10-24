export const BASE_CATEGORIES = ['Relógios', 'Perfumes', 'Beleza', 'Acessórios', 'Bem-estar', 'Natural', 'Eletrônicos', 'Moda', 'Casa'];
export const FAVORITES = 'Favoritos';
export const ALL = 'Todos';

/** Fotos ficam em public/img/fNN.webp (grande) e fNN-sm.webp (miniatura). */
const f = (...n) => n.map((i) => `img/f${String(i).padStart(2, '0')}.webp`);
/** Fotos do 2º lote (out/2026): public/img/nNN.webp */
const nw = (...n) => n.map((i) => `img/n${String(i).padStart(2, '0')}.webp`);

// price: 0 = "Consulte o preço". Preços preenchidos apenas onde havia etiqueta legível na foto.
const P = (id, category, name, price, images, desc, emoji, color) =>
  ({ id, category, name, price, oldPrice: 0, images, desc, emoji, color, tag: '' });

const WATCH = '#e9e7ff', TECH = '#e8efff', BEAUTY = '#fce7ee', WELL = '#e5f5ec', NAT = '#f8f1d9', HOME = '#e4f5f7', MODA = '#fde4e4', PERF = '#efe7ff', ACC = '#fde4f0';
/** Produto do 2º lote: entra no banco pela sincronização (versão 2) e chega com a etiqueta NOVO. */
const N = (...a) => ({ ...P(...a), tag: 'NOVO', since: 2 });

export const initialProducts = [
  // Relógios
  P(1, 'Relógios', 'Relógio Feminino Trevo com Cristais — Preto', 0, f(25, 29), 'Pulseira em formato de trevo com cristais e mostrador preto.', '⌚', WATCH),
  P(2, 'Relógios', 'Relógio Feminino Trevo com Cristais — Rosa', 0, f(37, 29), 'Pulseira em formato de trevo com cristais e mostrador rosa.', '⌚', WATCH),
  P(3, 'Relógios', 'Relógio de Silicone Quadrado — Branco', 0, f(26), 'Pulseira de silicone branca e caixa quadrada com números grandes.', '⌚', WATCH),
  P(4, 'Relógios', 'Relógio Digital Tecivet — Dourado', 0, f(27, 28), 'Relógio digital com pulseira de aço dourada, resistente à água.', '⌚', WATCH),
  P(5, 'Relógios', 'Relógio Digital Tecivet — Prata', 0, f(30, 35), 'Relógio digital com pulseira de aço prateada, resistente à água.', '⌚', WATCH),
  P(6, 'Relógios', 'Relógio Digital Tecivet Hora Mundial — Prata', 0, f(39, 40), 'Relógio digital com função de hora mundial, acompanha estojo.', '⌚', WATCH),
  P(7, 'Relógios', 'Relógio Tecivet Misto — Mostrador Dourado', 0, f(32, 31, 33, 34), 'Pulseira prata e dourada com mostrador dourado e números romanos.', '⌚', WATCH),
  P(8, 'Relógios', 'Relógio Tecivet Misto — Mostrador Preto', 0, f(43, 44), 'Pulseira prata e dourada com mostrador preto e marcações em brilho.', '⌚', WATCH),
  P(9, 'Relógios', 'Relógio Feminino Prata — Mostrador Azul', 0, f(42, 36), 'Relógio feminino de aço prateado com mostrador azul-escuro.', '⌚', WATCH),
  P(10, 'Relógios', 'Relógio Feminino Prata com Cristais', 0, f(38), 'Caixa quadrada com cristais e pulseira prateada.', '⌚', WATCH),
  P(11, 'Relógios', 'Relógio Newrex Oval com Cristais', 0, f(41, 48), 'Caixa oval com cristais ao redor e mostrador azul-escuro.', '⌚', WATCH),
  // Eletrônicos
  P(12, 'Eletrônicos', 'Fone de Ouvido F-070 — Cores Sortidas', 0, f(9), 'Fone de ouvido com fio, disponível em várias cores.', '🎧', TECH),
  P(13, 'Eletrônicos', 'Fone de Ouvido Atomo Hi-Fi MO-EJ-36', 0, f(10), 'Fone com fio e microfone, disponível em azul, rosa e amarelo.', '🎧', TECH),
  P(14, 'Eletrônicos', 'Fone de Ouvido A\'Gold Extra Bass', 0, f(11), 'Fone com fio e graves reforçados, em verde, preto e rosa.', '🎧', TECH),
  P(15, 'Eletrônicos', 'Fone de Ouvido Stereo Headphone MS-5V', 0, f(13), 'Fone estéreo com fio, em vermelho e roxo.', '🎧', TECH),
  P(16, 'Eletrônicos', 'Carregador Turbo H\'Maston 3.1A — 2 USB', 25, f(14), 'Carregador de parede com duas saídas USB, 3.1A.', '🔌', TECH),
  P(17, 'Eletrônicos', 'Carregador Rápido Altomex 2 USB — 5.1A', 25, f(15), 'Carregador rápido com duas saídas USB e cabo, 5.1A.', '🔌', TECH),
  // Moda
  P(18, 'Moda', 'Sutiã com Renda — Vermelho', 0, f(2), 'Sutiã com bojo e acabamento em renda.', '👙', MODA),
  P(19, 'Moda', 'Sutiã com Renda — Preto', 0, f(3), 'Sutiã com bojo e acabamento em renda.', '👙', MODA),
  // Beleza
  P(20, 'Beleza', 'Máscara Capilar Botox Kosnattu\'s 500g', 0, f(53, 66), 'Linha Botox Redutor e Botox Quiabo com Aloe Vera.', '💇', BEAUTY),
  P(21, 'Beleza', 'Óleo Capilar Viva Mais Abacate 130ml', 0, nw(46), 'Nutrição intensa, recuperação e hidratação dos fios, 130ml.', '🧴', BEAUTY),
  P(22, 'Beleza', 'Hidratante Óleo de Amêndoas Nutri Derme 400ml', 0, f(50), 'Hidratante corporal Kosnattu\'s com óleo de amêndoas, 400ml.', '🧴', BEAUTY),
  P(23, 'Beleza', 'Hidratante Rosa Mosqueta Nutri Derme 400ml', 0, f(55), 'Hidratante corporal Kosnattu\'s com rosa mosqueta, 400ml.', '🌹', BEAUTY),
  P(24, 'Beleza', 'Sabonete Íntimo — Várias Fragrâncias', 0, f(52), 'Sabonetes íntimos Apinil, Charmelle e Bell Corpus. Consulte as fragrâncias.', '🧼', BEAUTY),
  P(25, 'Beleza', 'Sabonete Líquido Micosinan 400ml', 0, nw(37), 'Sabonete líquido glicerinado Kosnattu\'s, uso corporal, facial e íntimo.', '🧼', BEAUTY),
  P(26, 'Beleza', 'Sabonete Líquido Mix Magic Pitanga 1L', 0, f(57), 'Sabonete líquido para mãos e corpo, aroma de pitanga, 1 litro.', '🧼', BEAUTY),
  P(27, 'Beleza', 'Sabonete Líquido Mix Magic Hortelã e Menta 1L', 0, nw(34), 'Sabonete líquido para mãos e corpo, aroma de hortelã e menta, 1 litro.', '🧼', BEAUTY),
  P(28, 'Beleza', 'Creme para os Pés Avon Care Footworks', 0, f(58), 'Creme hidratante desodorante 3 em 1 para os pés.', '🦶', BEAUTY),
  P(29, 'Beleza', 'Banhos de Lavanda 500ml', 0, f(46), 'Frescor de lavanda para toda a família, 500ml.', '💜', BEAUTY),
  // Bem-estar
  P(30, 'Bem-estar', 'Creme para Massagem Alívio — Bálsamo Selva 30g', 0, f(49, 1), 'Creme massageador com mentol e cânfora.', '🌿', WELL),
  P(31, 'Bem-estar', 'Gel Massageador PTD Sebo de Carneiro 250g', 0, f(4, 59), 'Gel massageador Apinil com sebo de carneiro e pimenta negra.', '🫙', WELL),
  P(32, 'Bem-estar', 'Gel para Massagem Cordial Sebo de Carneiro e Arnica 200g', 0, f(5, 59), 'Gel para massagem com sebo de carneiro, arnica e mentol.', '🧴', WELL),
  P(33, 'Bem-estar', 'Artrogel Gel Massageador Charmelle 150g', 0, nw(54), 'Gel massageador com arnica, centella asiática, cânfora e andiroba.', '💪', WELL),
  P(34, 'Bem-estar', 'Crossfire Gel Massageador Charmelle 150g', 0, f(51), 'Gel massageador com arnica e andiroba.', '💪', WELL),
  P(35, 'Bem-estar', 'Pomada Preta Premium Apinil 150g', 0, nw(55), 'Pomada com eucalipto, copaíba, castanha da Índia e mentol.', '🫙', WELL),
  P(36, 'Bem-estar', 'Pomada Micosinan 50g', 0, nw(51), 'Pomada Kosnattu\'s Micosinan, 50g.', '🫙', WELL),
  P(37, 'Bem-estar', 'Óleo de Menta Natural Apinil 10ml', 0, f(54), 'Óleo de menta natural em frasco conta-gotas de 10ml.', '🌿', WELL),
  // Natural
  P(38, 'Natural', 'Melão de São Caetano — 60 Cápsulas', 20, nw(19), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  P(39, 'Natural', 'Babosa Aloe Vera — 60 Cápsulas', 0, f(8), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  P(40, 'Natural', 'Espinheira Santa AVIN — 60 Cápsulas', 0, f(16), 'Suplemento alimentar em cápsulas de 500mg, frasco com 60 unidades.', '💊', NAT),
  P(41, 'Natural', 'Mounjaro Natural AVIN — 60 Cápsulas', 30, f(17), 'Suplemento alimentar em cápsulas de 500mg, frasco com 60 unidades.', '💊', NAT),
  P(42, 'Natural', 'Ginkgo Biloba com Ginseng AVIN — 60 Cápsulas', 0, nw(18), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  P(43, 'Natural', 'Elixir de São Caetano 500ml', 0, nw(59), 'Suplemento alimentar líquido, pronto para consumo. Agite antes de beber.', '🍯', NAT),
  P(44, 'Natural', 'Chá Misto ProstVida Homem 500ml', 0, nw(57), 'Chá misto com vegetal, zero açúcar, 500ml.', '🍵', NAT),
  P(45, 'Natural', 'Chá Misto Semente de Sucupira Composta 500ml', 0, f(22), 'Chá misto, zero açúcar, 500ml.', '🍵', NAT),
  P(46, 'Natural', 'Chá Misto GineVida Plus Mulher 500ml', 20, nw(56), 'Chá misto com vegetal, zero açúcar, 500ml.', '🍵', NAT),
  P(47, 'Natural', 'Chá Misto Bálsamo 500ml', 0, nw(60), 'Chá misto 100% natural, zero açúcar, 500ml.', '🍵', NAT),
  P(48, 'Natural', 'Xarope Misto Natusbel 220g — Hortelã ou Abacaxi e Hortelã', 0, f(47), 'Xarope misto nas versões Hortelã e Abacaxi com Hortelã, 220g.', '🍯', NAT),
  // Casa
  P(49, 'Casa', 'Cadeado Pedra Top Security 38mm', 20, f(12), 'Cadeado de 38mm com chaves.', '🔒', HOME),

  /* ---------- 2º lote (out/2026) — preços onde havia etiqueta legível na foto ---------- */
  // Acessórios
  N(50, 'Acessórios', 'Kit Presilhas de Cabelo — Pérolas e Corações Pretos', 10, nw(1), 'Cartela com presilhas de pérolas, corações e flores pretas.', '🎀', ACC),
  N(51, 'Acessórios', 'Kit Presilhas de Cabelo — Pérola e Corações', 10, nw(2), 'Cartela com presilha de pérola grande, corações e flores.', '🎀', ACC),
  N(52, 'Acessórios', 'Kit Presilhas de Cabelo — Flores Lilás', 10, nw(3), 'Cartela com presilhas de flores lilás, strass e pérola.', '🎀', ACC),
  N(53, 'Acessórios', 'Kit Presilhas de Cabelo — Laço de Strass e Corações', 10, nw(4), 'Cartela com laço de strass, corações de pérola e florzinhas.', '🎀', ACC),
  // Relógios
  N(54, 'Relógios', 'Relógio Feminino Oval Dourado', 0, nw(5), 'Relógio bracelete dourado com mostrador oval e números romanos. Acompanha caixa.', '⌚', WATCH),
  N(55, 'Relógios', 'Relógio Feminino Oval com Strass — Dourado', 0, nw(9), 'Mostrador oval cravejado com strass e pulseira bracelete dourada. Acompanha caixa.', '⌚', WATCH),
  N(56, 'Relógios', 'Relógio Newrex Quadrado Dourado — Mostrador Preto', 0, nw(6), 'Caixa quadrada dourada, mostrador preto e pulseira de aço. Acompanha caixa.', '⌚', WATCH),
  N(57, 'Relógios', 'Relógio Newrex Quadrado Rosé — Mostrador Preto', 0, nw(7), 'Caixa quadrada rosé, mostrador preto e pulseira de aço. Acompanha caixa.', '⌚', WATCH),
  N(58, 'Relógios', 'Relógio Newrex Dourado — Mostrador Dourado com Data', 100, nw(16), 'Caixa dourada, mostrador dourado com calendário e pulseira de aço.', '⌚', WATCH),
  N(59, 'Relógios', 'Relógio Xiaoma Pulseira de Couro — Preto', 50, nw(13), 'Caixa dourada, pulseira de couro preta. À prova d’água (20m).', '⌚', WATCH),
  N(60, 'Relógios', 'Relógio Xiaoma Pulseira de Couro — Caramelo', 50, nw(15), 'Caixa escura, pulseira de couro caramelo. À prova d’água (20m).', '⌚', WATCH),
  // Casa
  N(61, 'Casa', 'Acendedor Elétrico Recarregável USB — Cores Sortidas', 0, nw(20), 'Acendedor a arco elétrico, recarrega pelo cabo USB. Ideal para fogão e churrasqueira.', '🔥', HOME),
  // Perfumes
  N(62, 'Perfumes', 'Deo Colônia La Bela — La’Post 100ml', 0, nw(21), 'Deo colônia spray feminina, 100ml.', '🌸', PERF),
  N(63, 'Perfumes', 'Deo Colônia 521 VIP — La’Post 100ml', 0, nw(23), 'Deo colônia spray, 100ml.', '🖤', PERF),
  N(64, 'Perfumes', 'Deo Colônia 521 Rosé VIP — La’Post 100ml', 0, nw(24), 'Deo colônia spray feminina, 100ml.', '🌹', PERF),
  N(65, 'Perfumes', 'Deo Colônia Ferraz — La’Post 100ml', 0, nw(25), 'Deo colônia spray masculina, 100ml.', '🖤', PERF),
  N(66, 'Perfumes', 'Deo Colônia Silvestre Sent — La’Post 100ml', 0, nw(26), 'Deo colônia spray, 100ml.', '🌿', PERF),
  N(67, 'Perfumes', 'Deo Colônia Lourd Gizz — La’Post 100ml', 0, nw(28), 'Deo colônia spray, 100ml.', '✨', PERF),
  N(68, 'Perfumes', 'Deo Colônia Alfazema DragoMed 1L', 0, nw(31), 'Deo colônia desodorante de alfazema, 1 litro.', '💜', PERF),
  // Beleza
  N(69, 'Beleza', 'Botox Matizador Kosnattu’s 500g', 0, nw(27), 'Botox matizador redutor de volume com argan e ojon, 500g.', '💇', BEAUTY),
  N(70, 'Beleza', 'Botox Redutor Plástica dos Fios Kosnattu’s 500g', 0, nw(33), 'Máscara anti-frizz com reposição de massa, 500g.', '💇', BEAUTY),
  N(71, 'Beleza', 'Banhos de Lavanda Talco 500ml', 0, nw(29), 'Frescor para toda a família, aroma de talco, 500ml.', '💗', BEAUTY),
  N(72, 'Beleza', 'Banhos de Lavanda Alfazema 500ml', 0, nw(30), 'Frescor para toda a família, aroma de alfazema, 500ml.', '💚', BEAUTY),
  N(73, 'Beleza', 'Sabonete Líquido Corporal Kapelli Erva Doce 1L', 0, nw(32), 'Limpeza profunda e hidratação suave, 1 litro.', '🧼', BEAUTY),
  N(74, 'Beleza', 'Sabonete Líquido Mix Magic Maracujá 1L', 0, nw(35), 'Sabonete líquido para mãos e corpo, aroma de maracujá, 1 litro.', '🧼', BEAUTY),
  N(75, 'Beleza', 'Sabonete Íntimo Apinil Morango 200ml', 0, nw(36), 'Com extratos de barbatimão, aroeira e malva. pH balanceado.', '🍓', BEAUTY),
  N(76, 'Beleza', 'Sabonete Íntimo Apinil Barbatimão e Flor de Algodão 200ml', 0, nw(38), 'Com extratos de barbatimão, aroeira e malva. pH balanceado.', '🌼', BEAUTY),
  N(77, 'Beleza', 'Sabonete Íntimo Apinil Amora Negra 200ml', 0, nw(39), 'Com extrato de amora. pH balanceado.', '🫐', BEAUTY),
  N(78, 'Beleza', 'Sabonete Íntimo Apinil Maçã Hot 200ml', 0, nw(40), 'Com extrato de maçã. pH balanceado.', '🍎', BEAUTY),
  N(79, 'Beleza', 'Sabonete Íntimo Apinil Haus Preto 200ml', 0, nw(41), 'Com extratos de barbatimão, aroeira e malva. pH balanceado.', '🖤', BEAUTY),
  N(80, 'Beleza', 'Óleo Capilar Viva Mais Argan 130ml', 0, nw(43), 'Fortalece, nutre, hidrata e auxilia no crescimento, 130ml.', '🧴', BEAUTY),
  N(81, 'Beleza', 'Óleo Capilar Viva Mais Coco 130ml', 0, nw(44), 'Hidrata, nutre e revitaliza os fios, 130ml.', '🥥', BEAUTY),
  N(82, 'Beleza', 'Óleo Capilar Viva Mais Babosa 130ml', 0, nw(47), 'Ajuda a prevenir a queda, fortalece e elimina o frizz, 130ml.', '🌵', BEAUTY),
  N(83, 'Beleza', 'Óleo de Mutamba Viva Mais 130ml', 0, nw(48), 'Óleo capilar e corporal adstringente e hidratante, 130ml.', '🧴', BEAUTY),
  N(84, 'Beleza', 'Óleo Cavalo Imperial Viva Mais 130ml', 0, nw(49), 'Óleo capilar e corporal com biotina e óleo de rícino, 130ml.', '🐴', BEAUTY),
  N(85, 'Beleza', 'Sabonete em Barra Barbatimão Genial 90g', 0, nw(50), 'Sabonete glicerinado 100% natural, 90g.', '🧼', BEAUTY),
  N(86, 'Beleza', 'Sabonete Hidratante Xô Micose MajuProfection 90g', 0, nw(53), 'Sabonete hidratante uniformizador de tom 7 em 1, 90g.', '🧼', BEAUTY),
  // Bem-estar
  N(87, 'Bem-estar', 'Unguento AntiGripal Vick 30g', 0, nw(42), 'Unguento com mentol, cânfora e óleo de eucalipto, 30g.', '🌿', WELL),
  // Natural
  N(88, 'Natural', 'Pata de Vaca Selva do Brasil — 60 Cápsulas', 0, nw(63), 'Produto 100% natural em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  N(89, 'Natural', 'Espinheira Santa Selva do Brasil — 60 Cápsulas', 0, nw(64), 'Com extratos de macela, boldo e hortelã. Cápsulas de 500mg, caixa com 60.', '💊', NAT),
  N(90, 'Natural', 'Mounjaro Natural Selva do Brasil — 60 Cápsulas', 0, nw(65), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
];

/**
 * Sincronização do catálogo com o banco (quando o painel já foi ativado).
 * Ao entrar, o Dono recebe as mudanças das versões que o banco ainda não tem:
 * - produtos com `since: N` são ADICIONADOS (se não existirem);
 * - `updates` trocam fotos/nome SÓ se o produto ainda estiver como veio do catálogo
 *   (fotos originais do site e nome antigo) — nada que você editou no painel é sobrescrito.
 */
export const CATALOG_VERSION = 2;
const imgs = (id) => initialProducts.find((p) => p.id === id).images;
export const CATALOG_UPDATES = {
  2: {
    21: { images: imgs(21), name: 'Óleo Capilar Viva Mais Abacate 130ml', fromName: 'Óleo Capilar Viva Mais 130ml — Babosa ou Abacate', desc: 'Nutrição intensa, recuperação e hidratação dos fios, 130ml.' },
    25: { images: imgs(25) }, 27: { images: imgs(27) }, 33: { images: imgs(33) }, 35: { images: imgs(35) }, 36: { images: imgs(36) },
    38: { images: imgs(38) }, 42: { images: imgs(42) }, 43: { images: imgs(43) }, 44: { images: imgs(44) }, 45: { images: imgs(45) },
    46: { images: imgs(46) }, 47: { images: imgs(47) },
  },
};

/** Valores iniciais das configurações editáveis no painel. */
export const DEFAULT_SETTINGS = {
  storeName: 'Elenilson Store',
  announcement: '✦ Ofertas especiais e novidades esperando por você ✦',
  heroText: 'Produtos para facilitar sua rotina, renovar seu estilo e surpreender você — tudo em um só lugar.',
  whatsappNumber: '',
  pixKey: '',
};
