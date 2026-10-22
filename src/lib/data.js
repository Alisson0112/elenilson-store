export const BASE_CATEGORIES = ['Relógios', 'Eletrônicos', 'Moda', 'Beleza', 'Bem-estar', 'Natural', 'Casa'];
export const FAVORITES = 'Favoritos';
export const ALL = 'Todos';

/** Fotos ficam em public/img/fNN.webp (grande) e fNN-sm.webp (miniatura). */
const f = (...n) => n.map((i) => `img/f${String(i).padStart(2, '0')}.webp`);

// price: 0 = "Consulte o preço". Preços preenchidos apenas onde havia etiqueta legível na foto.
const P = (id, category, name, price, images, desc, emoji, color) =>
  ({ id, category, name, price, oldPrice: 0, images, desc, emoji, color, tag: '' });

const WATCH = '#e9e7ff', TECH = '#e8efff', BEAUTY = '#fce7ee', WELL = '#e5f5ec', NAT = '#f8f1d9', HOME = '#e4f5f7', MODA = '#fde4e4';

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
  P(21, 'Beleza', 'Óleo Capilar Viva Mais 130ml — Babosa ou Abacate', 0, f(45), 'Óleo capilar nas versões Babosa e Abacate, 130ml.', '🧴', BEAUTY),
  P(22, 'Beleza', 'Hidratante Óleo de Amêndoas Nutri Derme 400ml', 0, f(50), 'Hidratante corporal Kosnattu\'s com óleo de amêndoas, 400ml.', '🧴', BEAUTY),
  P(23, 'Beleza', 'Hidratante Rosa Mosqueta Nutri Derme 400ml', 0, f(55), 'Hidratante corporal Kosnattu\'s com rosa mosqueta, 400ml.', '🌹', BEAUTY),
  P(24, 'Beleza', 'Sabonete Íntimo — Várias Fragrâncias', 0, f(52), 'Sabonetes íntimos Apinil, Charmelle e Bell Corpus. Consulte as fragrâncias.', '🧼', BEAUTY),
  P(25, 'Beleza', 'Sabonete Líquido Micosinan 400ml', 0, f(56), 'Sabonete líquido glicerinado Kosnattu\'s, uso corporal, facial e íntimo.', '🧼', BEAUTY),
  P(26, 'Beleza', 'Sabonete Líquido Mix Magic Pitanga 1L', 0, f(57), 'Sabonete líquido para mãos e corpo, aroma de pitanga, 1 litro.', '🧼', BEAUTY),
  P(27, 'Beleza', 'Sabonete Líquido Mix Magic Hortelã e Menta 1L', 0, f(60), 'Sabonete líquido para mãos e corpo, aroma de hortelã e menta, 1 litro.', '🧼', BEAUTY),
  P(28, 'Beleza', 'Creme para os Pés Avon Care Footworks', 0, f(58), 'Creme hidratante desodorante 3 em 1 para os pés.', '🦶', BEAUTY),
  P(29, 'Beleza', 'Banhos de Lavanda 500ml', 0, f(46), 'Frescor de lavanda para toda a família, 500ml.', '💜', BEAUTY),
  // Bem-estar
  P(30, 'Bem-estar', 'Creme para Massagem Alívio — Bálsamo Selva 30g', 0, f(49, 1), 'Creme massageador com mentol e cânfora.', '🌿', WELL),
  P(31, 'Bem-estar', 'Gel Massageador PTD Sebo de Carneiro 250g', 0, f(4, 59), 'Gel massageador Apinil com sebo de carneiro e pimenta negra.', '🫙', WELL),
  P(32, 'Bem-estar', 'Gel para Massagem Cordial Sebo de Carneiro e Arnica 200g', 0, f(5, 59), 'Gel para massagem com sebo de carneiro, arnica e mentol.', '🧴', WELL),
  P(33, 'Bem-estar', 'Artrogel Gel Massageador Charmelle 150g', 0, f(6), 'Gel massageador com arnica, centella asiática, cânfora e andiroba.', '💪', WELL),
  P(34, 'Bem-estar', 'Crossfire Gel Massageador Charmelle 150g', 0, f(51), 'Gel massageador com arnica e andiroba.', '💪', WELL),
  P(35, 'Bem-estar', 'Pomada Preta Premium Apinil 150g', 0, f(51), 'Pomada com eucalipto, copaíba, castanha da Índia e mentol.', '🫙', WELL),
  P(36, 'Bem-estar', 'Pomada Micosinan 50g', 0, f(64), 'Pomada Kosnattu\'s Micosinan, 50g.', '🫙', WELL),
  P(37, 'Bem-estar', 'Óleo de Menta Natural Apinil 10ml', 0, f(54), 'Óleo de menta natural em frasco conta-gotas de 10ml.', '🌿', WELL),
  // Natural
  P(38, 'Natural', 'Melão de São Caetano — 60 Cápsulas', 20, f(18, 7), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  P(39, 'Natural', 'Babosa Aloe Vera — 60 Cápsulas', 0, f(8), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  P(40, 'Natural', 'Espinheira Santa AVIN — 60 Cápsulas', 0, f(16), 'Suplemento alimentar em cápsulas de 500mg, frasco com 60 unidades.', '💊', NAT),
  P(41, 'Natural', 'Mounjaro Natural AVIN — 60 Cápsulas', 30, f(17), 'Suplemento alimentar em cápsulas de 500mg, frasco com 60 unidades.', '💊', NAT),
  P(42, 'Natural', 'Ginkgo Biloba com Ginseng AVIN — 60 Cápsulas', 0, f(20), 'Suplemento alimentar em cápsulas de 500mg, caixa com 60 unidades.', '💊', NAT),
  P(43, 'Natural', 'Elixir de São Caetano 500ml', 0, f(19, 61), 'Suplemento alimentar líquido, pronto para consumo. Agite antes de beber.', '🍯', NAT),
  P(44, 'Natural', 'Chá Misto ProstVida Homem 500ml', 0, f(21, 63), 'Chá misto com vegetal, zero açúcar, 500ml.', '🍵', NAT),
  P(45, 'Natural', 'Chá Misto Semente de Sucupira Composta 500ml', 0, f(22, 62), 'Chá misto, zero açúcar, 500ml.', '🍵', NAT),
  P(46, 'Natural', 'Chá Misto GineVida Plus Mulher 500ml', 20, f(23), 'Chá misto com vegetal, zero açúcar, 500ml.', '🍵', NAT),
  P(47, 'Natural', 'Chá Misto Bálsamo 500ml', 0, f(24, 65), 'Chá misto 100% natural, zero açúcar, 500ml.', '🍵', NAT),
  P(48, 'Natural', 'Xarope Misto Natusbel 220g — Hortelã ou Abacaxi e Hortelã', 0, f(47), 'Xarope misto nas versões Hortelã e Abacaxi com Hortelã, 220g.', '🍯', NAT),
  // Casa
  P(49, 'Casa', 'Cadeado Pedra Top Security 38mm', 20, f(12), 'Cadeado de 38mm com chaves.', '🔒', HOME),
];
