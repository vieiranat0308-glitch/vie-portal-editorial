// Leitor mínimo de planilhas .xlsx (sem dependências): abre o zip, lê os textos
// compartilhados e devolve cada aba como uma lista de linhas de texto.
import zlib from 'node:zlib';

function descompactar(buf) {
  const arquivos = {};
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('Planilha inválida (não é um .xlsx).');
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10);
    const tamanho = buf.readUInt32LE(p + 20);
    const nomeTam = buf.readUInt16LE(p + 28);
    const extraTam = buf.readUInt16LE(p + 30);
    const comentarioTam = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nomeTam);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(inicio, inicio + tamanho);
    if (/^xl\/(sharedStrings|worksheets\/sheet\d+|workbook)\.xml$/.test(nome)) {
      arquivos[nome] = (metodo === 8 ? zlib.inflateRawSync(dados) : dados).toString('utf8');
    }
    p += 46 + nomeTam + extraTam + comentarioTam;
  }
  return arquivos;
}

const xml = (t) => String(t)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const textosDe = (trecho) => [...trecho.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xml(m[1])).join('');

function coluna(ref) {
  let n = 0;
  for (const c of ref.replace(/\d+/g, '')) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Datas do Excel chegam como número de dias desde 30/12/1899.
export function dataDoExcel(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(serial)) * 864e5);
  return d.toISOString().slice(0, 10);
}

// Devolve [{ nome, linhas: [[celula, ...], ...] }]. Números que parecem data vêm como "AAAA-MM-DD".
export function lerXlsx(buf) {
  const arquivos = descompactar(Buffer.from(buf));
  const compartilhados = [...(arquivos['xl/sharedStrings.xml'] || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textosDe(m[1]));
  const nomes = [...(arquivos['xl/workbook.xml'] || '').matchAll(/<sheet\b[^>]*name="([^"]*)"/g)].map((m) => xml(m[1]));
  const abas = Object.keys(arquivos)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  return abas.map((nome, i) => {
    const linhas = [];
    for (const [, linha] of arquivos[nome].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const celulas = [];
      for (const [, atributos, corpo] of linha.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = (atributos.match(/\br="([A-Z]+\d+)"/) || [])[1];
        const tipo = (atributos.match(/\bt="(\w+)"/) || [])[1];
        const estilo = Number((atributos.match(/\bs="(\d+)"/) || [])[1] || 0);
        const v = (String(corpo || '').match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let valor = '';
        if (tipo === 's') valor = compartilhados[Number(v)] ?? '';
        else if (tipo === 'inlineStr') valor = textosDe(corpo || '');
        else if (v != null) valor = xml(v);
        // Número com estilo de data (o caso das colunas "Data"): converte.
        if ((!tipo || tipo === 'n') && v != null && estilo && /^\d{5}(\.\d+)?$/.test(valor) && Number(valor) > 40000 && Number(valor) < 60000) valor = dataDoExcel(valor);
        celulas[ref ? coluna(ref) : celulas.length] = valor;
      }
      linhas.push(Array.from(celulas, (c) => (c == null ? '' : String(c))));
    }
    return { nome: nomes[i] || `Aba ${i + 1}`, linhas };
  });
}
