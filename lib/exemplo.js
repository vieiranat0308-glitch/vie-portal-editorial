// Cliente de exemplo: a linha editorial da Dra. Izabella Rebello (Out/2026),
// usada pelo botão "Criar com o exemplo da Dra. Izabella" no cadastro de clientes.

export const exemploCliente = {
  nome: 'Dra. Izabella Rebello',
  tratamento: 'Izabella',
  especialidade: 'Medicina · Emagrecimento',
  instagram: 'dra.izabellarebello',
  cor: '#7f2a2e',
  servicos: ['editorial'],
};

export const exemploEditorial = {
  periodo: 'Out · 2026',
  subtitulo: 'Posicionamento, linha editorial e banco de pautas',
  objetivo: {
    titulo: '3 ou mais novas pacientes por mês vindas do Instagram, em 6 meses',
    acompanhar: ['Formatos que mais performaram', 'Engajamento nos stories', 'Compartilhamentos e salvamentos dos Reels'],
  },
  posicionamento: {
    texto: 'Médica que acompanha mulheres no processo de emagrecimento com estratégia, escuta e individualidade, porque também já esteve do outro lado.',
    publico: 'Mulheres de 25 a 40 anos que querem começar: muitas com sobrepeso, cansadas de dietas da moda e curiosas ou receosas sobre as canetas.',
  },
  tom: {
    titulo: 'A amiga séria que sempre tem o conselho certo',
    soa: 'Acolhedora, didática e próxima. Explica o técnico em linguagem simples, com o português bem escrito que é marca dela.',
    naoSoa: 'Robótica, posada, sensacionalista ou “vendedora a qualquer custo”.',
    bordao: 'Para ter resultados diferentes, você precisa de atitudes diferentes.',
  },
  bio: {
    texto: 'Ajudo mulheres a emagrecer com estratégia: menos dieta da moda, mais qualidade de vida 🤍\n📍Barra (RJ) · Teresópolis · Online\nCRM-RJ 131009-7',
    oQueMudou: 'A frase principal mostra para quem ela trabalha e o que a paciente ganha.',
  },
  destaques: [
    { nome: 'Comece por aqui', descricao: 'A história do emagrecimento da Dra conectada ao que ela faz hoje.' },
    { nome: 'Consultas', descricao: 'Primeira consulta, retorno em até 30 dias, planos de 60 e 90 dias, atendimento online e locais. Termina no WhatsApp.' },
    { nome: 'Dúvidas', descricao: 'Respostas da caixinha da semana sobre emagrecimento, alimentação e treino.' },
    { nome: 'Resultados', descricao: 'Antes e depois e feedbacks de pacientes, com autorização.' },
  ],
  pilares: [
    { id: 'p1', nome: 'Vivo o que eu prego', percentual: 30, descricao: 'A jornada, a rotina de treino, a alimentação real e o estilo de vida da Dra.', formatos: 'Reels narrados e de rotina · carrossel com fotos' },
    { id: 'p2', nome: 'Emagrecimento a fundo', percentual: 20, descricao: 'Conteúdo denso, fundamentado em artigos, que constrói autoridade.', formatos: 'Carrossel aprofundado · Reels comentando estudo ou notícia' },
    { id: 'p3', nome: 'Hábitos e acompanhamento', percentual: 30, descricao: 'Hábitos sem dieta da moda, canetas e como funciona o acompanhamento.', formatos: 'Reels para a câmera · carrossel prático · bastidores' },
    { id: 'p4', nome: 'Topo de funil', percentual: 20, descricao: 'Trends e vídeos curtos, sem fala. No feed, entram os vencedores dos Reels de teste.', formatos: 'Reels curtos com imagens do banco' },
  ],
  frequencia: {
    resumo: 'Cerca de 20 posts por mês, na proporção 30/20/30/20.',
    gravacao: 'Em lote, com roteiro pronto · bastidores nas quintas.',
    slots: [
      { dia: 1, horario: '8h–10h', formato: 'reel', pilares: ['p1'] },
      { dia: 3, horario: '11h–13h', formato: 'carrossel', pilares: ['p2'] },
      { dia: 4, horario: '18h–21h', formato: 'reel', pilares: ['p3'] },
      { dia: 5, horario: 'Manhã', formato: 'carrossel', pilares: ['p1', 'p3'] },
      { dia: 6, horario: 'Manhã', formato: 'reel', pilares: ['p4'] },
    ],
  },
  estrategias: [
    {
      rotulo: 'Reels de teste',
      titulo: 'A estratégia de topo de funil',
      destaque: '28%',
      texto: 'das visualizações de setembro vieram de não seguidores. Os Reels de teste são mostrados primeiro só para quem não segue o perfil, sem aparecer na grade.',
      nota: '2 vídeos por dia. Cada vídeo leva no máximo 3 a 5 minutos: modelos prontos, sem edição elaborada, trechos da rotina e gravação em lote.',
      passos: [
        { titulo: 'Avaliar após 72 horas', texto: 'Retenção, compartilhamentos, salvamentos e novos seguidores.' },
        { titulo: 'Os 2 ou 3 melhores vão para o feed', texto: 'Preenchem o pilar Topo de funil.' },
        { titulo: 'Temas vencedores ganham versão aprofundada', texto: 'Regravados para os pilares 2 e 3.' },
        { titulo: 'Os que não performarem ganham novo gancho', texto: 'E são testados de novo.' },
      ],
    },
  ],
  stories: {
    resumo: 'Todos os dias: refeições, treinos, organização e as “furadas” da dieta, para mostrar a vida real.',
    dias: [
      { dia: 'Segunda', titulo: 'Rotina e caixinha da semana', itens: ['Pré e pós-treino: como come bem e rende nos dois treinos', 'Abre a caixinha “Dúvidas sobre emagrecimento, alimentação, treino…”'] },
      { dia: 'Terça', titulo: 'Story denso sobre um tema', itens: ['Um tema por semana, ao vivo ou gravado', 'Rodízio: hábitos, hormônios, exercício + alimentação, mitos'] },
      { dia: 'Quarta', titulo: 'Rotina e prova de resultado', itens: ['Rotina de alimentação e treino', 'Feedback de paciente ou caso comentado: movimento e resultado dos protocolos'] },
      { dia: 'Quinta', titulo: 'Dia de consultório', itens: ['Look do dia e “atendendo no consultório da Barra”', 'Sempre um protocolo: acompanhamento, diferencial, paciente satisfeita ou caso', 'Chamada para o WhatsApp'] },
      { dia: 'Sexta a domingo', titulo: 'Equilíbrio na vida real', itens: ['Hábitos com lazer, esportes, saídas e as saídas da dieta', 'Equilíbrio é fazer boas escolhas e aproveitar com consciência'] },
    ],
  },
  series: [
    {
      nome: 'Tudo sobre o meu processo de emagrecimento',
      episodios: [
        { titulo: 'Ep. 1', formato: 'Falado, íntimo e próximo, de frente para a câmera', fala: 'Eu perdi 13 kg e vou contar para vocês como foi esse processo de emagrecimento.' },
        { titulo: 'Ep. 2', formato: 'Editado e narrado, contando os desafios do processo', fala: 'Vocês já sabem que eu emagreci 13 kg, e esses foram os desafios que eu passei ao longo desse processo.' },
        { titulo: 'Ep. 3', formato: 'A virada de chave: mescla dos dois formatos. Começa falando para a câmera, com vídeos e fotos de apoio', fala: 'Hábitos que eu não abro mão na minha rotina depois que passei pelo meu processo de emagrecimento.' },
      ],
    },
  ],
  formato: {
    titulo: 'O óbvio também precisa ser dito',
    texto: 'Seguiremos o formato de conteúdo lo-fi: mais simples de ser produzido e alinhado ao estilo que buscamos.',
  },
  proximosPassos: [
    { titulo: 'Perfil', texto: 'Atualizar a bio, o link do WhatsApp e os destaques.' },
    { titulo: 'Série', texto: 'Gravar “Tudo sobre o meu processo de emagrecimento”.' },
    { titulo: 'Reels de teste', texto: 'Abastecer o banco de imagens e começar os testes.' },
    { titulo: 'Roteiros', texto: 'Usar o agente de IA da VIE para os roteiros.' },
    { titulo: 'Acompanhamento', texto: 'Revisar as métricas todo mês, com setembro como base.' },
  ],
};

const reel = (pilarId, titulo, gancho) => ({ formato: 'reel', pilarId, titulo, gancho });
const carrossel = (pilarId, titulo, gancho) => ({ formato: 'carrossel', pilarId, titulo, gancho });

export const exemploIdeias = [
  reel('p1', 'Tudo sobre o meu processo de emagrecimento, ep. 1', 'Eu perdi 13 kg e vou contar para vocês como foi esse processo de emagrecimento.'),
  reel('p1', 'Tudo sobre o meu processo de emagrecimento, ep. 2', 'Vocês já sabem que eu emagreci 13 kg, e esses foram os desafios que eu passei ao longo desse processo.'),
  reel('p1', 'Tudo sobre o meu processo de emagrecimento, ep. 3', 'Hábitos que eu não abro mão na minha rotina depois que passei pelo meu processo de emagrecimento.'),
  reel('p1', 'Como me alimento para render em dois treinos no mesmo dia', 'Musculação e futevôlei no mesmo dia: se eu não me alimentar direito, eu não rendo. Vou te mostrar o que eu como antes e depois de cada treino.'),
  reel('p1', 'Um dia real da minha rotina', 'Muita gente me pergunta como é a minha rotina de verdade. Então vem passar um dia comigo, das refeições aos treinos.'),
  reel('p1', 'Dieta x fim de semana', 'Eu sei que no fim de semana dá vontade de comer algo fora do plano, e faz parte! Mas vou te ensinar a fazer isso de um jeito que minimize os danos no seu processo de emagrecimento.'),
  reel('p1', 'Organização da semana', 'Se você trabalha fora, estuda e tem uma rotina corrida, você vai precisar se organizar para conseguir emagrecer. Vou te mostrar como eu faço.'),
  reel('p1', 'O que mudou na minha relação com a comida', 'Eu já vivi de dieta em dieta. Hoje eu como de outro jeito, e não é sobre proibir. Vou te contar o que mudou.'),
  reel('p1', 'O que eu como em um dia de consultório', 'Dia de consultório é corrido, mas eu não abro mão de me alimentar bem. Vou te mostrar o que eu como do café ao jantar.'),
  reel('p1', 'Os lanches que vivem na minha bolsa', 'Sabe quando a fome bate no meio da tarde e você come qualquer coisa? Eu resolvi isso assim. Vou te mostrar o que eu sempre carrego.'),

  reel('p2', 'Efeito platô no emagrecimento', 'No começo o peso desce rápido, e depois parece que trava. Isso tem nome: efeito platô. Vou te explicar o que acontece no seu corpo e por que fica mais difícil continuar emagrecendo com o tempo.'),
  reel('p2', 'Perder peso x perder gordura', 'Perder peso e perder gordura não são a mesma coisa, e essa diferença muda tudo no seu resultado. Vou te explicar a fundo o que a balança não mostra.'),
  reel('p2', 'Jejum intermitente: o que os estudos mostram', 'Você já deve ter ouvido que o jejum é o segredo para emagrecer. Vou te mostrar o que os estudos realmente dizem e para quem ele faz sentido.'),
  reel('p2', 'Efeito sanfona', 'Se você já testou várias dietas da moda, emagreceu e não conseguiu manter por muito tempo, esse vídeo é para você. Não é falta de força de vontade, e eu vou te explicar por quê.'),
  reel('p2', 'Sono e emagrecimento', 'Você está fazendo dieta, treinando, mas dorme mal? Isso pode estar atrapalhando o seu emagrecimento mais do que você imagina.'),
  reel('p2', 'Os hormônios da fome', 'Tem dias em que a fome parece não ter fim, né? Existe uma explicação hormonal para isso, e eu vou te explicar de um jeito simples.'),
  reel('p2', 'Proteína: quanto você realmente precisa', 'Se você quer emagrecer sem perder massa muscular, precisa olhar para a proteína. E provavelmente está comendo menos do que precisa.'),
  reel('p2', 'Estresse e gordura abdominal', 'Você já ouviu que o cortisol é o vilão da barriga? Vou te explicar o que é verdade e o que é exagero.'),
  reel('p2', 'Ciclo menstrual, fome e inchaço', 'Se em alguns dias do mês você sente mais fome, mais vontade de doce e mais inchaço, não é coisa da sua cabeça. Vou te explicar o que acontece.'),
  reel('p2', 'Atividade física e prevenção do câncer de mama (Outubro Rosa)', 'Neste Outubro Rosa, quero falar sobre algo que pouca gente associa à prevenção: o seu treino.'),

  reel('p3', 'Caneta: para quem é indicada e para quem não é', 'Você está pensando em usar caneta para emagrecer? Antes de qualquer coisa, precisa saber se ela é indicada para você.'),
  reel('p3', 'Caneta comprada fora da farmácia', 'Se você comprou uma caneta sem registro na Anvisa, precisa ouvir isso antes da próxima aplicação.'),
  reel('p3', 'Parei a caneta, e agora?', 'Muita mulher tem medo de parar a caneta e engordar tudo de novo. Vou te explicar o que acontece e como se preparar para essa fase.'),
  reel('p3', 'Caneta e massa muscular', 'Emagrecer com caneta sem cuidar da alimentação e do treino pode levar embora a sua massa muscular. Vou te explicar como evitar isso.'),
  reel('p3', 'Vontade de doce depois do almoço', 'Se depois do almoço bate aquela vontade de doce todos os dias, saiba que isso tem explicação e tem solução.'),
  reel('p3', 'Trocas no mercado sem dieta da moda', 'Você não precisa encher o carrinho de produto ‘fit’ para emagrecer. Vou te mostrar trocas simples que fazem diferença.'),
  reel('p3', 'Como comer fora sem abandonar o objetivo', 'Jantar fora não precisa ser o fim da sua dieta. Vou te ensinar a fazer boas escolhas sem deixar de aproveitar.'),
  reel('p3', 'Como é a primeira consulta comigo', 'Se você tem vontade de começar um acompanhamento, mas não sabe como funciona, vou te mostrar a primeira consulta comigo, do começo ao fim.'),
  reel('p3', 'Retorno e acompanhamento de perto', 'Eu não sou a médica que vai montar o seu protocolo e depois nunca mais falar com você.'),
  reel('p3', 'Acompanhamento de 60 e 90 dias', 'Emagrecer não se resolve em uma consulta. Por isso eu acompanho de perto, e vou te mostrar como funciona.'),

  ...[
    'Você não precisa cortar o carboidrato. Precisa de estratégia.',
    'Uma refeição fora do plano não estraga o seu processo. Desistir, sim.',
    'Dieta da moda dura semanas. Hábito fica.',
    'A balança não mostra quanto de gordura você perdeu.',
    'Emagrecer não é sobre sofrer. É sobre constância.',
    'Você não precisa de produto fit. Precisa de comida de verdade.',
    'Nem todo treino vai ser perfeito. Todo treino conta.',
    'A caneta pode ajudar. Quem sustenta o resultado são os seus hábitos.',
    'Organização também emagrece.',
    'Para ter resultados diferentes, você precisa de atitudes diferentes.',
  ].map((frase) => ({ ...reel('p4', frase, ''), roteiro: 'Reel curto, sem fala, com imagens do banco. A frase entra como texto na tela.' })),

  carrossel('p1', 'Médica também aceita desafio', 'Entrei num desafio de treino e fui para o pódio. O que eu aprendi estando do outro lado'),
  carrossel('p1', 'Meu dia de treino duplo', 'Musculação e futevôlei no mesmo dia: tudo o que eu como para render'),
  carrossel('p1', 'O que eu faço toda semana para não sair da rotina', '5 hábitos que me mantêm no caminho, mesmo nas semanas corridas'),
  carrossel('p1', 'Saí da dieta, e agora?', 'Eu também saio da dieta. A diferença é o que eu faço no dia seguinte'),
  carrossel('p1', 'Eu antes x eu hoje: os hábitos', 'O que mudou na minha rotina desde que eu parei de viver de dieta'),

  carrossel('p2', 'Por que você emagrece rápido no começo e depois trava', 'O peso desceu rápido nas primeiras semanas e agora não sai do lugar? Isso tem explicação'),
  carrossel('p2', 'Composição corporal: mais importante que o peso', 'Duas mulheres com o mesmo peso podem ter corpos completamente diferentes'),
  carrossel('p2', 'Dietas da moda: a promessa x o que os estudos mostram', 'Low carb, jejum, detox, cetogênica: o que cada uma promete e o que realmente entrega'),
  carrossel('p2', 'Massa muscular: a aliada que ninguém conta', 'Se você quer emagrecer e manter o resultado, precisa olhar para os seus músculos'),
  carrossel('p2', 'Hormônios femininos e emagrecimento', 'Por que em algumas semanas do mês é tão mais difícil seguir o plano'),

  carrossel('p3', 'Antes de começar a caneta', '5 perguntas que você precisa fazer antes de usar caneta para emagrecer'),
  carrossel('p3', 'Um prato que sustenta, sem dieta da moda', 'Como montar um prato que te deixa satisfeita sem precisar de nada ‘fit’'),
  carrossel('p3', 'Guia para comer fora', 'Vai jantar fora no fim de semana? Leia isso antes'),
  carrossel('p3', 'Como funciona o acompanhamento comigo', 'Do primeiro contato ao resultado: como é ser acompanhada por mim'),
  carrossel('p3', 'Você não precisa de mais uma dieta', 'Sinais de que você precisa de acompanhamento, e não de mais uma dieta da moda'),
];

// Base de setembro (período de 7/9 a 6/10), ponto de partida para medir a evolução.
export const exemploMetricas = {
  '2026-09': {
    seguidores: 2977,
    novosSeguidores: 70,
    visualizacoes: 174113,
    naoSeguidores: 27.4,
    visitasPerfil: 2425,
    toquesLink: 13,
    interacoes: 3122,
    reels: 2,
    posts: 9,
    stories: 152,
    pacientes: null,
    observacoes: 'Base de setembro (7/9 a 6/10). É o ponto de partida para medir a evolução mês a mês.',
  },
};

// Perfil no início da consultoria (números do print da estratégia, out/2026).
export const exemploEvolucao = [
  {
    data: '2026-10-07',
    inicial: true,
    posts: 92,
    seguidores: 2977,
    seguindo: 1492,
    bio: '',
    link: 'linktr.ee/rebelloizabella',
    destaques: [],
    analise: 'Ponto de partida da consultoria: base de setembro com 174 mil visualizações e 27% de não seguidores.',
    prints: [],
  },
];
