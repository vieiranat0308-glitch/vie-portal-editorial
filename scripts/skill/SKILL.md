---
name: portal-assessoria
description: Cria o portal de clientes de uma agência ou assessoria (o mesmo portal da Vie Company) para outra empresa, com a marca dela. Use quando pedirem para "copiar o portal", "criar o portal para outra empresa/agência", "montar um portal de clientes igual ao da Vie", "replicar o portal assessoria", ou para personalizar nome, cores, fontes e logos desse portal. Entrega o projeto pronto para publicar na Vercel (grátis), com área da equipe e área exclusiva de cada cliente.
---

# Portal de clientes para agências (modelo Vie Company)

Esta skill gera, para outra empresa, o portal que a Vie Company usa com os clientes dela: a equipe vê todos os clientes, e cada cliente tem um login exclusivo para acompanhar entregas, cronogramas, aprovações e resultados. O resultado é um projeto completo, pronto para subir no GitHub e publicar na Vercel, sem custo mensal.

O que o portal tem (detalhes em `referencias/funcionalidades.md`):
- Serviços com etiquetas por cliente (Gestão de Instagram, Produção de vídeo, Tráfego, Consultoria editorial), e cada serviço libera as abas que o cliente vê.
- Linha editorial (em PDF ou editável), cronograma mensal (montado no portal, em HTML interativo ou lido das pastas do Google Drive), cronograma da agência separado do cronograma do cliente.
- Aprovação post a post com botões Aprovado / Alterar, banco de ideias, evolução do perfil, métricas e documentos.
- Equipe com acesso a todos os clientes ou só a alguns; convites por link (WhatsApp).
- App instalável no celular (PWA) e notificações push grátis (lembretes diários e avisos de aprovação).

## Como conduzir

### 1. Levantar os dados da empresa nova
Pergunte o que faltar (numa mensagem só) e monte o `marca.json` a partir de `marca.exemplo.json`:

| Campo | O que é | Exemplo |
|---|---|---|
| `empresa` | nome completo | Lume Studio |
| `marca` | nome curto (ícone do app, “equipe Lume”); até 12 letras | Lume |
| `genero` | `a` (da Vie, a Vie) ou `o` (do Lume, o Lume) | o |
| `portal` | nome do portal | Portal do Cliente |
| `nicho` | frase curta no rodapé do login | Marketing para restaurantes |
| `frase_login` | frase grande do login | O marketing do seu restaurante, mês a mês, em um só lugar. |
| `resultado` | rótulo da métrica de resultado do cliente | Novos pedidos / Novos pacientes / Novos alunos |
| `nome_admin` | como o portal chama a dona no teste local | Carol |
| `email`, `dominio` | contato e domínio futuro (opcionais) | contato@lume.com.br |
| `cores` | `principal` (destaque, botões), `escura` (menu lateral), `clara` (textos e logo sobre o escuro), `fundo` (fundo das páginas) | hex `#2f6b4f` |
| `fontes` | `titulo` e `texto` (nomes da marca) + `google_titulo` e `google_texto` (as do Google Fonts que entram enquanto não houver os arquivos da fonte da marca) | Playfair Display / Inter |
| `logos` | caminhos dos PNG: `clara` (para fundo escuro), `escura` (para fundo claro), `icone` (símbolo para o app, opcional) | |

Regras:
- Textos sem aspas, crase, `<`, `>` ou `$` (entram dentro do código). O script recusa e diz qual campo corrigir.
- Cores: se a pessoa mandar o manual da marca ou o logo, tire as cores dele. A `escura` precisa contrastar com a `clara`; o `fundo` é bem claro (quase branco).
- Fontes da marca pagas (fora do Google Fonts): use parecidas do Google em `google_titulo`/`google_texto` e avise que os arquivos da fonte (com licença para web) podem ir para `public/fonts/` depois.
- Sem logo: o script cria um provisório com o nome. Peça o logo em PNG com fundo transparente, nas versões clara e escura.

### 2. Gerar o projeto
```bash
python3 <pasta-da-skill>/scripts/personalizar.py --marca marca.json --destino ./portal-<marca>
```
O script copia o modelo, troca nome, artigos (da/do), cores (e calcula as derivadas), fontes, textos do nicho e gera logos e ícones do app (precisa do Pillow: `pip install pillow`). Ele avisa se sobrar algum marcador `{{...}}`.

### 3. Ajustar ao nicho (leia `referencias/personalizacao.md`)
Revise e adapte, conversando com a pessoa:
- `api/clientes.js` → `SERVICOS_PADRAO`: os serviços que a empresa vende e as abas de cada um (também editáveis depois na tela Serviços).
- `lib/exemplo.js`: o cliente de exemplo (hoje uma médica). Troque por um exemplo do nicho novo ou deixe como demonstração.
- Textos que citam “consultório”, “pacientes”, Instagram etc., se o nicho for outro (`grep -rn "pacientes\|consultório" public api lib`).
- O README do projeto já sai com o nome novo; confira a seção de identidade visual.

### 4. Testar no computador
```bash
cd portal-<marca> && npm install && npm run dev
```
Abre em http://localhost:3000 com `admin@portal.local` / `vie12345` (dados só na memória). Confira login, menu, cores, logo, crie um cliente de exemplo e abra as abas. Se tiver navegador disponível, tire prints para a pessoa aprovar.

### 5. Publicar (siga `referencias/publicacao.md`)
Repositório novo no GitHub → projeto na Vercel → Upstash Redis e Vercel Blob em Storage → variáveis `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOME` → Redeploy. Tudo nos planos gratuitos. Domínio próprio é opcional.

### 6. Entregar
Diga o que foi feito, o link (se publicou) e o que ficou para a pessoa: logo definitivo, fontes da marca, domínio, chave do Google (opcional) para ler o Drive pela API oficial.

## Cuidados
- Não copie dados de clientes da Vie: o modelo só leva o código. Cada empresa tem banco (Redis) e arquivos (Blob) próprios.
- Não reaproveite as variáveis de ambiente nem o banco de outro portal.
- Nada pago: o portal foi feito para rodar nos planos gratuitos (Vercel Hobby, Upstash, Blob). Não adicione serviços que cobrem sem a pessoa pedir.
- A Vercel Hobby permite até 12 funções em `api/`; o portal usa 10.
