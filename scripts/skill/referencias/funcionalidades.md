# O que o portal faz

## Duas áreas
- **Equipe da agência** (admin): visão geral de todos os clientes do mês, filtro por serviço, página Serviços, Equipe, e cada cliente com todas as abas mais Acessos e Configurações.
- **Cliente**: login exclusivo, só vê o próprio portal, só meses liberados, nunca as notas internas.
- Equipe pode ter acesso a **todos os clientes** ou a **uma lista** (escolhida no convite ou no botão “Clientes”). Quem tem lista não mexe em Serviços, Equipe, nem cria/exclui clientes. A checagem é no servidor (`lib/base.js → exigirAcessoCliente`, `exigirEquipeCompleta`).

## Serviços e abas
`api/clientes.js → SERVICOS_PADRAO`. Cada serviço libera abas: `linha`, `cronograma`, `cronogramaVie` (divide o cronograma em “da agência” e “do cliente”), `aprovacao`, `ideias`, `evolucao`, `metricas`. Visão geral e Documentos aparecem sempre. Editável na tela Serviços.

## Abas
- **Visão geral**: saudação, seguidores, alcance, fluxo do mês, “Para você produzir” e “A agência vai publicar” (Gestão de Instagram). Clientes só de tráfego veem um painel de resultados.
- **Linha editorial**: PDF pronto (leitor PDF.js embutido) e/ou versão web editável por seções (pilares, frequência, stories…).
- **Cronograma**: calendário, lista, prévia do feed, stories. Três jeitos de alimentar:
  1. montado no portal (“Montar pela linha editorial” + banco de ideias);
  2. **HTML interativo** pronto (o portal lê os posts sem IA: modelos “cronograma” e “roteiros de gravação”, em `lib/cronograma-html.js`; caixinhas Feito/Publicado/Gravado sincronizadas);
  3. **pasta do Google Drive** (`lib/drive.js`): subpastas por data (22.10…), vídeo = reels, imagens = carrossel, “story” no nome = stories, Doc/.txt = legenda; confere sozinho a cada 10 min; arte trocada volta para aprovação.
- **Aprovação**: Aprovado / Alterar em cada conteúdo; num HTML, aprovação do mês inteiro; botão **Aprovar tudo** no topo (conteúdos, HTMLs, moodboards e datas sazonais).
- **Moodboard** (`api/planejamento.js?tipo=moodboard`): roteiro de gravação em PDF (visor embutido), Word ou link, com aprovação, nova versão e conversa.
- **Calendário sazonal** (`tipo=sazonal`): datas com ação de marketing para aprovar; sugestões dos próximos 12 meses em `public/js/paginas/sazonal.js → datasSugeridas` (ajuste a lista ao nicho).
- **Próxima produção** (`tipo=producao`): cartão na visão geral; lembrete na véspera no app e por e-mail (`lib/email.js`, SMTP).
- **Banco de ideias**, **Evolução do perfil** (perfil inicial + acompanhamento com prints), **Métricas** (mês a mês, leitura da agência), **Documentos** (PDF/imagem até 4 MB ou links).
- **Acessos**: convites por link de 7 dias (copiar ou WhatsApp).

## Celular
- PWA: `public/manifest.webmanifest`, `public/sw.js`, página pública `/#/instalar`.
- Notificações push (Web Push, `lib/push.js`, `api/notificacoes.js`): chaves criadas sozinhas e guardadas no Redis; rotina diária às 8h de Brasília (`vercel.json → crons`) com “Grave seu story de hoje”, “Grave o reels de hoje”, “Tem cronograma para você aprovar!”; avisos na hora para cliente e equipe. No iPhone só com o app instalado (iOS 16.4+), e a permissão tem de ser pedida direto no toque (já é assim em `public/js/notificacoes.js`).

## Pilha técnica
HTML/CSS/JS puro (sem build) em `public/`, funções serverless em `api/`, Redis (Upstash) para dados, Vercel Blob para arquivos (privados, download sempre pela API com checagem). Senhas com scrypt, sessão em cookie HttpOnly, limite de tentativas de login, HTML do cronograma isolado (sandbox).
