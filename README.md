# Vie Company · Portal Editorial

Portal da **consultoria editorial** da Vie Company. A equipe Vie acompanha todos os clientes num só lugar, e cada cliente tem um **acesso exclusivo** para ver o que foi entregue a ele.

## O que tem no portal

| Página | Equipe Vie | Cliente |
|---|---|---|
| **Visão geral** | Todos os clientes do mês: cronogramas liberados ou em rascunho, ajustes pedidos, o que está esperando aprovação | Saudação, seguidores e alcance, fluxo do mês, calendário, conteúdos de hoje e próximos, roteiro de stories do dia |
| **Linha editorial** | Edita por seções: objetivo, posicionamento, tom de voz, bio, destaques, pilares, frequência, estratégias, stories, séries, formato e próximos passos | Lê a estratégia em formato de documento (substitui o PDF) e pode imprimir ou salvar em PDF |
| **Cronograma** | Monta o mês automaticamente pela frequência da linha editorial + banco de ideias, edita cada conteúdo e libera para o cliente | Vê o mês em calendário, lista, prévia do feed e stories |
| **Aprovação** | Vê os ajustes pedidos e o que está com o cliente | Aprova ou pede ajuste com comentário; marca como gravado ou postado |
| **Banco de ideias** | Cadastra pautas por pilar e formato; “Usar no cronograma” | Consulta as pautas e **sugere ideias** |
| **Métricas** | Registra os números do mês e escreve a leitura da Vie | Vê a evolução mês a mês |
| **Documentos** | Envia PDFs/imagens (até 4 MB) ou links (Drive, Canva, Netlify) | Abre e baixa |
| **Acessos** | Gera links de convite (copiar ou enviar pelo WhatsApp) e remove acessos | — |

**Isolamento entre clientes:** toda checagem de permissão acontece no servidor (`lib/base.js → exigirAcessoCliente`). Um cliente só consegue ler os dados do próprio cliente, não vê meses em rascunho nem as notas internas da Vie. Os arquivos nunca ficam com link público: o download passa pela API, que confere quem está pedindo.

### Linha editorial em PDF

A estratégia que já está pronta em PDF (feita no Canva, por exemplo) pode ser enviada direto: abra o cliente → **Linha editorial** → **Subir PDF pronto**. O cliente vê todas as páginas dentro do portal (também no celular), com **Abrir em tela cheia** e **Baixar**. Para trocar, use **Substituir PDF**.

- Limite de 4 MB por arquivo. No Canva, exporte como “PDF padrão” se o “para impressão” ficar maior.
- Se o cliente também tiver a versão preenchida no portal, aparecem duas abas: “Estratégia em PDF” (primeiro) e “Versão web”. A versão web continua sendo a fonte dos pilares e da frequência usados no cronograma.
- O leitor de PDF (PDF.js, licença Apache 2.0) fica dentro do projeto em `public/vendor/pdfjs/`, sem depender de serviço externo.

### Cronograma pronto (HTML interativo)

Se o cronograma do mês é feito fora do portal (como os sites que vocês publicavam no Netlify), dá para **subir o arquivo .html pronto**:

1. Abra o cliente → **Cronograma** → escolha o mês → **Subir cronograma pronto (HTML)**.
2. Confira como ficou (ele aparece dentro do portal, com todos os cliques e interações do arquivo) e clique em **Liberar para o cliente**.
3. O cliente vê o cronograma na área exclusiva dele e pode **aprovar o cronograma** ou **pedir ajuste** com um comentário. O pedido aparece para a Vie na visão geral e na página Aprovação.
4. Precisa corrigir? **Substituir HTML**: o cliente passa a ver a nova versão, que volta a esperar aprovação.

Regras do arquivo: um único `.html` de até 4 MB (imagens dentro do arquivo ou em links externos). O HTML roda isolado do portal: ele não consegue acessar a sessão nem os dados de ninguém, e só abre para quem tem acesso àquele cliente. Assim, não fica mais um link público como no Netlify.

### Fluxo de um mês montado no portal

1. Na **linha editorial**, preencha os pilares e a **frequência do feed** (dia, horário, formato, pilar).
2. No **cronograma** do mês, clique em **Montar mês pela linha editorial**: o portal cria os conteúdos nos dias certos e puxa as ideias ainda não usadas do banco, do mesmo pilar e formato.
3. Revise, ajuste títulos, ganchos, roteiros e legendas, escreva o **foco do mês** e clique em **Liberar para o cliente**. Com a opção marcada, os conteúdos vão para “Para aprovar”.
4. O cliente aprova ou pede ajuste. Os pedidos aparecem na visão geral da Vie e na página **Aprovação**.
5. No acompanhamento mensal, registre as **métricas** e suba os **documentos**.

## Identidade visual

- Logos em `public/img/` (`logo-creme.png` para fundos escuros, `logo-terracota.png` para fundos claros) e ícone da aba em `icone.png`.
- Cores da marca: terracota `#8a391b` e creme `#f1e6b2`, com chocolate e areia de apoio (variáveis no topo de `public/css/estilo.css`).
- Fontes: **Black Mango** nos títulos e **BW Modelica** nos textos. Elas são pagas e não estão no Google Fonts, então, enquanto os arquivos não forem colocados em `public/fonts/`, o portal usa Bodoni Moda e Outfit, que são parecidas. Quem tem as fontes instaladas no computador já as vê.

## Stack

O mesmo modelo dos outros projetos: Vercel com HTML/JS puro (sem build), funções serverless em `api/`, Redis (Upstash) para os dados e Vercel Blob para os arquivos.

- `public/`: telas (`js/app.js` cuida das rotas; cada página fica em `js/paginas/`).
- `api/`: `auth` (login, convites, senha), `clientes`, `editorial`, `cronograma`, `ideias`, `metricas`, `documentos`, `usuarios`.
- `lib/base.js`: Redis, sessões, senhas (scrypt) e permissões. `lib/exemplo.js` traz a linha editorial da Dra. Izabella como exemplo.

## Configuração na Vercel (uma vez)

1. **Importar**: Vercel → *Add New → Project* → este repositório. Não precisa mudar nada no build.
2. **Banco de dados**: no projeto, *Storage → Create → Upstash Redis* (o plano gratuito serve) e conecte ao projeto.
3. **Arquivos**: *Storage → Create → Blob* e conecte ao projeto. Isso cria a variável `BLOB_READ_WRITE_TOKEN` sozinho.
4. **Variáveis de ambiente** (*Settings → Environment Variables*):
   - `ADMIN_EMAIL`: o seu e-mail de login (conta principal da Vie).
   - `ADMIN_PASSWORD`: a sua senha (use uma senha forte).
   - `ADMIN_NOME`: como o portal te chama (ex.: Natalia).
5. Faça um novo deploy (*Deployments → Redeploy*) para as variáveis valerem.
6. Entre com o e-mail e a senha acima, clique em **Novo cliente** e, se quiser ver tudo funcionando, use **Criar com o exemplo da Dra. Izabella**.
7. Para dar acesso a um cliente: abra o cliente → **Acessos do cliente** → **Convidar**. Envie o link pelo WhatsApp; ele vale 7 dias e o cliente cria a própria senha.
8. Para a equipe da Vie: **Equipe Vie** → **Convidar**.

Domínio próprio (ex.: `portal.viecompany.com.br`): *Settings → Domains* na Vercel.

## Testar no computador

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000` com o login `admin@vie.local` / `vie12345`. Nesse modo os dados ficam só na memória e somem ao reiniciar.

## Próximos passos possíveis

- Gerar o cronograma do mês com IA (como na Spice Cronogramas), a partir da linha editorial e das métricas.
- Puxar as métricas direto do Instagram (Meta Graph API).
- Aviso por e-mail ou WhatsApp quando há conteúdo para aprovar ou ajuste pedido.
- Redefinição de senha por e-mail (hoje a Vie gera um novo convite).
