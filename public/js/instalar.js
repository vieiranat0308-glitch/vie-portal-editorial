// App no celular (PWA): registra o service worker, guarda o convite de instalação
// do Android e explica o passo a passo do iPhone.
import { esc, abrirCamada, icones } from './ui.js';

let pedidoAndroid = null;
const ouvintes = new Set();

export function iniciarApp() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* o portal funciona sem */ });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoAndroid = e;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    pedidoAndroid = null;
    ouvintes.forEach((f) => f());
  });
}

// Quando o Android liberar o botão "Instalar", avisa quem estiver mostrando a opção.
export function aoMudarInstalacao(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

export const jaInstalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ehIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ehAndroid = () => /Android/i.test(navigator.userAgent);
const ehCelular = () => ehIos() || ehAndroid();
// Navegadores dentro do Instagram, Facebook e afins não instalam apps.
const navegadorEmbutido = () => /Instagram|FBAN|FBAV|Line\/|LinkedInApp/i.test(navigator.userAgent);

// Mostra a opção "Instalar" no menu? Só faz sentido fora do app e onde dá para instalar.
export const mostrarInstalar = () => !jaInstalado() && (ehCelular() || !!pedidoAndroid);

export async function instalarAgora() {
  if (!pedidoAndroid) return false;
  pedidoAndroid.prompt();
  const { outcome } = await pedidoAndroid.userChoice;
  pedidoAndroid = null;
  ouvintes.forEach((f) => f());
  return outcome === 'accepted';
}

// Passo a passo para o aparelho de quem está vendo (ou os dois, no computador).
export function passosInstalacao() {
  const icCompartilhar = '<svg class="ic-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="Compartilhar"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const iphone = `
    <div class="passos-app">
      <h3>No iPhone</h3>
      <ol>
        <li>Abra o portal no <b>Safari</b>.</li>
        <li>Toque em <b>Compartilhar</b> ${icCompartilhar} na barra de baixo.</li>
        <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
        <li>Toque em <b>Adicionar</b>. O ícone da Vie aparece na tela do celular.</li>
      </ol>
    </div>`;
  const android = `
    <div class="passos-app">
      <h3>No Android</h3>
      <ol>
        <li>Abra o portal no <b>Chrome</b>.</li>
        <li>Toque em <b>Instalar app</b> quando o Chrome oferecer. Se não aparecer, toque no menu <b>⋮</b> e depois em <b>Instalar app</b> (ou “Adicionar à tela inicial”).</li>
        <li>Confirme. O ícone da Vie aparece junto com os outros apps.</li>
      </ol>
    </div>`;
  const aviso = navegadorEmbutido()
    ? `<p class="aviso-embutido">Você abriu o link por dentro de outro app. Para instalar, abra no ${ehIos() ? 'Safari' : 'Chrome'}: toque nos três pontinhos e escolha “Abrir no navegador”.</p>`
    : '';
  if (ehIos()) return aviso + iphone;
  if (ehAndroid()) return aviso + android;
  return `<div class="passos-duplos">${iphone}${android}</div>`;
}

const TEXTO_APP = 'Com o app, o portal fica com o ícone da Vie na tela do celular e abre em tela cheia, já logado. Não precisa baixar nada da loja e ele se atualiza sozinho.';

export function abrirComoInstalar() {
  const m = abrirCamada(`
    <h2>Instalar o app no celular</h2>
    <p class="muted">${TEXTO_APP}</p>
    ${passosInstalacao()}
    <div class="rodape-modal">
      <button class="btn claro" data-fechar>Fechar</button>
      ${pedidoAndroid ? `<button class="btn acc" data-instalar>${icones.baixar}Instalar app</button>` : ''}
    </div>`);
  m.el.querySelector('[data-instalar]')?.addEventListener('click', async () => {
    if (await instalarAgora()) m.fechar();
  });
}

// Página aberta, sem login: #/instalar. É o link enviado junto com o convite.
export function paginaInstalar(app) {
  document.title = 'Instalar o app · Vie Company';
  const desenhar = () => {
    app.innerHTML = `
      <div class="tela-instalar">
        <div class="caixa">
          <img class="icone-app" src="/img/app-192.png" alt="">
          <p class="mono">Vie Company · Portal Assessoria de Marketing</p>
          <h1>O portal da Vie como app no seu celular</h1>
          <p class="muted">${esc(TEXTO_APP)}</p>
          ${jaInstalado() ? '<p class="ja-instalado">O app já está instalado neste aparelho.</p>' : passosInstalacao()}
          <div class="acoes">
            ${pedidoAndroid ? `<button class="btn acc" data-instalar>${icones.baixar}Instalar app</button>` : ''}
            <a class="btn ${pedidoAndroid ? 'claro' : 'acc'}" href="#/">Entrar no portal</a>
          </div>
        </div>
      </div>`;
    app.querySelector('[data-instalar]')?.addEventListener('click', instalarAgora);
  };
  const parar = aoMudarInstalacao(() => { if (location.hash.startsWith('#/instalar')) desenhar(); else parar(); });
  desenhar();
}
