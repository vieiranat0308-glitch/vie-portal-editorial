// E-mails do portal (lembrete da produção de conteúdo), por SMTP comum: grátis
// com uma conta do Gmail (senha de app) ou o e-mail do domínio da empresa.
// Variáveis: SMTP_USER e SMTP_PASS (obrigatórias); SMTP_HOST (padrão smtp.gmail.com),
// SMTP_PORT (padrão 465) e EMAIL_REMETENTE (padrão: o próprio SMTP_USER).
import nodemailer from 'nodemailer';

export const emailConfigurado = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporte;
function conexao() {
  if (!transporte) {
    const porta = Number(process.env.SMTP_PORT || 465);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: porta,
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Corpo simples, com as cores do portal. `linhas` são pares [rótulo, valor].
function modelo({ titulo, saudacao, texto, linhas = [], botao, link, empresa }) {
  return `<!doctype html><html><body style="margin:0;background:#efe9e3;font-family:Arial,Helvetica,sans-serif;color:#2b1a14">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="background:#22150f;color:#f1e6b2;border-radius:18px 18px 0 0;padding:22px 26px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${escapar(empresa)}</div>
    <div style="background:#fcfaf7;border-radius:0 0 18px 18px;padding:26px">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 14px">${escapar(titulo)}</h1>
      <p style="margin:0 0 10px;font-size:15px">${escapar(saudacao)}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.55">${escapar(texto)}</p>
      ${linhas.filter(([, v]) => v).map(([r, v]) => `<p style="margin:0 0 6px;font-size:15px"><b>${escapar(r)}:</b> ${escapar(v)}</p>`).join('')}
      ${link ? `<p style="margin:22px 0 0"><a href="${escapar(link)}" style="background:#8a391b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-size:15px">${escapar(botao || 'Abrir o portal')}</a></p>` : ''}
    </div>
  </div></body></html>`;
}

// Nunca derruba quem chamou: devolve quantos e-mails saíram.
export async function enviarEmail(para, dados) {
  if (!emailConfigurado() || !para.length) return 0;
  const remetente = process.env.EMAIL_REMETENTE || process.env.SMTP_USER;
  let enviados = 0;
  for (const destino of [...new Set(para)]) {
    try {
      await conexao().sendMail({
        from: `"${String(dados.empresa).replace(/"/g, '')}" <${remetente}>`,
        to: destino,
        subject: dados.assunto,
        text: [dados.saudacao, dados.texto, ...(dados.linhas || []).filter(([, v]) => v).map(([r, v]) => `${r}: ${v}`), dados.link].filter(Boolean).join('\n\n'),
        html: modelo(dados),
      });
      enviados++;
    } catch (err) {
      console.error('E-mail falhou', destino, err.message);
    }
  }
  return enviados;
}
