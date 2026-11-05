# Publicar (tudo nos planos gratuitos)

1. **GitHub**: crie um repositório novo (privado) para a empresa e suba a pasta gerada (`git init`, `git add -A`, `git commit`, `git push`). Não reaproveite o repositório da Vie.
2. **Vercel**: *Add New → Project* → importe o repositório. Não mude nada no build (o `vercel.json` já define a pasta `public` e as funções).
3. **Banco de dados**: no projeto, *Storage → Create → Upstash Redis* (plano gratuito) e conecte. A Vercel cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_*`); o portal aceita os dois.
4. **Arquivos**: *Storage → Create → Blob* e conecte. A Vercel cria `BLOB_STORE_ID` (ou `BLOB_READ_WRITE_TOKEN`).
5. **Variáveis** (*Settings → Environment Variables*):
   - `ADMIN_EMAIL`: e-mail de login da dona da empresa (conta principal).
   - `ADMIN_PASSWORD`: senha forte.
   - `ADMIN_NOME`: como o portal chama essa pessoa.
   - E-mail do lembrete de produção (opcional, grátis com Gmail): `SMTP_USER` (o e-mail) e `SMTP_PASS` (senha de app do Google, com verificação em duas etapas ligada). Sem elas, o lembrete sai só no app.
   - Opcionais: `GOOGLE_API_KEY` (ler pastas do Drive pela API oficial, grátis), `CRON_SECRET` (protege a rotina diária de notificações), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (fixar as chaves de push; sem elas o portal cria e guarda no banco).
6. **Redeploy** (*Deployments → Redeploy*) para as variáveis valerem.
7. Entre com o e-mail e a senha, crie um cliente (ou o de exemplo), convide a equipe (*Equipe*) e os clientes (*Acessos do cliente*).
8. **Domínio próprio** (opcional): *Settings → Domains* na Vercel e um registro CNAME no provedor do domínio.

## Conferir depois de publicar
- Login, menu e cores certas; logo no menu e no login.
- No celular: “Instalar app no celular” e, com o app instalado, “Ativar notificações” → “Enviar teste” em Minha conta.
- Subir um PDF em Documentos (confirma o Blob).
- A rotina das 8h aparece em *Settings → Cron Jobs* da Vercel.

## Limites do plano gratuito a lembrar
- Vercel Hobby: até 12 funções (o portal usa 10), agendamentos diários, uploads de até ~4,5 MB por envio (o portal limita a 4 MB).
- Uso comercial na Vercel Hobby: a Vercel pede o plano Pro para uso comercial; avise a pessoa para avaliar.
