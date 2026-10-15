// Mostra um PDF página por página com o PDF.js (incluído em /vendor/pdfjs).
// Funciona igual em qualquer navegador, inclusive no iPhone, onde o PDF dentro
// de um quadro costuma mostrar só a primeira página.
import { esc } from '../ui.js';

let pdfjs;
async function carregarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('/vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  }
  return pdfjs;
}

export async function mostrarPdf(el, url) {
  el.innerHTML = '<p class="muted" style="padding:24px;text-align:center">Carregando o PDF…</p>';
  try {
    const lib = await carregarPdfjs();
    const doc = await lib.getDocument({ url, withCredentials: true }).promise;
    el.innerHTML = '';
    const largura = Math.min(el.clientWidth || 900, 1200);
    const nitidez = Math.min(window.devicePixelRatio || 1, 2);

    // Cada página ganha um espaço do tamanho certo e só é desenhada quando
    // chega perto da tela, para não pesar com documentos longos.
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach(async (entrada) => {
        if (!entrada.isIntersecting || entrada.target.dataset.pronta) return;
        entrada.target.dataset.pronta = '1';
        observador.unobserve(entrada.target);
        const pagina = await doc.getPage(Number(entrada.target.dataset.pagina));
        const base = pagina.getViewport({ scale: 1 });
        const vista = pagina.getViewport({ scale: (largura / base.width) * nitidez });
        const canvas = document.createElement('canvas');
        canvas.width = vista.width;
        canvas.height = vista.height;
        entrada.target.append(canvas);
        await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
      });
    }, { rootMargin: '900px 0px' });

    const primeira = (await doc.getPage(1)).getViewport({ scale: 1 });
    for (let i = 1; i <= doc.numPages; i++) {
      const folha = document.createElement('div');
      folha.className = 'folha-pdf';
      folha.dataset.pagina = i;
      folha.style.aspectRatio = `${primeira.width} / ${primeira.height}`;
      el.append(folha);
      observador.observe(folha);
    }
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="vazio">Não foi possível mostrar o PDF aqui. Use “Abrir em tela cheia” ou “Baixar”.<br><span style="font-size:12px">${esc(err.message || '')}</span></div>`;
  }
}
