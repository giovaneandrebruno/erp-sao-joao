/**
 * Leitura de PDF e de fotos de documentos no navegador, sem nenhum serviço de fora.
 * - PDF com texto: o texto de cada página é lido com a posição de cada pedaço.
 * - PDF escaneado ou foto: o reconhecimento de letras (OCR) roda aqui mesmo, em português.
 * Depois, os pedaços são arrumados em linhas e colunas, virando uma tabela como a de uma planilha.
 */

type Pedaco = { texto: string; x0: number; x1: number; y: number; h: number };
export type Progresso = (texto: string) => void;

const OCR = "/ocr";
const MAX_PAGINAS_OCR = 15;

export async function lerDocumento(arquivo: File, progresso: Progresso = () => {}): Promise<{ linhas: string[][]; observacao: string }> {
  if (/\.pdf$/i.test(arquivo.name)) return lerPdf(arquivo, progresso);
  progresso("Reconhecendo o texto da imagem…");
  const linhas = await ocr([arquivo], progresso);
  return { linhas: montarTabela(linhas), observacao: "Texto reconhecido da imagem. Confira os valores na prévia: fotos tortas ou escuras podem trocar letras." };
}

// ---------------------------------------------------------------- PDF

async function lerPdf(arquivo: File, progresso: Progresso) {
  progresso("Abrindo o PDF…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${OCR}/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;

  const paginas: Pedaco[][] = [];
  let caracteres = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 1 });
    const conteudo = await pagina.getTextContent();
    const pedacos: Pedaco[] = [];
    for (const item of conteudo.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , d, x, y] = item.transform as number[];
      const h = Math.abs(d) || item.height || 10;
      // posições em proporção da página, para juntar páginas de tamanhos diferentes
      pedacos.push({ texto: item.str, x0: x / vista.width, x1: (x + item.width) / vista.width, y: (vista.height - y) / vista.height + n, h: h / vista.height });
      caracteres += item.str.length;
    }
    paginas.push(pedacos);
  }

  // pouco texto = PDF escaneado: desenha cada página e reconhece as letras
  if (caracteres < doc.numPages * 20) {
    const total = Math.min(doc.numPages, MAX_PAGINAS_OCR);
    const imagens: Blob[] = [];
    for (let n = 1; n <= total; n++) {
      progresso(`Preparando a página ${n} de ${total}…`);
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vista.width);
      canvas.height = Math.ceil(vista.height);
      await pagina.render({ canvas, viewport: vista }).promise;
      imagens.push(await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao desenhar a página."))), "image/png")));
    }
    const linhas = await ocr(imagens, progresso);
    const aviso = doc.numPages > total ? ` Só as primeiras ${total} páginas foram lidas.` : "";
    return { linhas: montarTabela(linhas), observacao: `O PDF é escaneado: o texto foi reconhecido das imagens. Confira os valores na prévia.${aviso}` };
  }

  progresso("Organizando a tabela…");
  const linhas = paginas.flatMap((p) => agruparLinhas(p));
  return { linhas: montarTabela(linhas), observacao: `Texto lido de ${doc.numPages} página(s) do PDF.` };
}

// ---------------------------------------------------------------- OCR (fotos e PDF escaneado)

async function ocr(imagens: Blob[], progresso: Progresso): Promise<Pedaco[][]> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  let atual = 0;
  const worker = await createWorker("por", OEM.LSTM_ONLY, {
    workerPath: `${OCR}/tesseract.worker.min.js`,
    corePath: OCR,
    langPath: OCR,
    gzip: true,
    logger: (m) => {
      if (m.status === "recognizing text") progresso(`Reconhecendo o texto${imagens.length > 1 ? ` da página ${atual + 1} de ${imagens.length}` : ""}… ${Math.round(m.progress * 100)}%`);
      else if (/load|initializ/.test(m.status)) progresso("Preparando o reconhecimento de texto (a primeira vez demora um pouco)…");
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    // no modo "texto espalhado" o OCR acha as palavras de tabelas; as linhas são remontadas pela altura
    const linhas: Pedaco[][] = [];
    for (const [i, img] of imagens.entries()) {
      atual = i;
      const { data } = await worker.recognize(img, {}, { blocks: true });
      const bitmap = await createImageBitmap(img);
      const largura = bitmap.width || 1;
      bitmap.close();
      const palavras: Pedaco[] = [];
      for (const bloco of data.blocks ?? []) {
        for (const par of bloco.paragraphs) {
          for (const linha of par.lines) {
            for (const w of linha.words) {
              const texto = w.text.replace(/[|\[\]]/g, " ").trim();
              if (!texto || w.confidence < 10) continue;
              const { x0, x1, y0, y1 } = w.bbox;
              palavras.push({ texto, x0: x0 / largura, x1: x1 / largura, y: i * 10 + (y0 + y1) / 2 / largura, h: (y1 - y0) / largura });
            }
          }
        }
      }
      linhas.push(...agruparLinhas(palavras));
    }
    return linhas;
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------- arrumar em linhas e colunas

/** Junta pedaços que estão na mesma altura da página. */
function agruparLinhas(pedacos: Pedaco[]): Pedaco[][] {
  const ordenados = [...pedacos].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const linhas: Pedaco[][] = [];
  for (const p of ordenados) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(ultima[0].y - p.y) < Math.max(ultima[0].h, p.h) * 0.5) ultima.push(p);
    else linhas.push([p]);
  }
  return linhas.map((l) => l.sort((a, b) => a.x0 - b.x0));
}

/** Dentro de uma linha, pedaços separados por um espaço grande viram células diferentes. */
function celulas(linha: Pedaco[]): Pedaco[] {
  const saida: Pedaco[] = [];
  for (const p of linha) {
    const ultima = saida[saida.length - 1];
    const vao = ultima ? p.x0 - ultima.x1 : Infinity;
    if (ultima && vao < Math.max(p.h, ultima.h) * 1.2) {
      ultima.texto += (vao > p.h * 0.15 ? " " : "") + p.texto;
      ultima.x1 = Math.max(ultima.x1, p.x1);
    } else saida.push({ ...p });
  }
  return saida.map((c) => ({ ...c, texto: c.texto.replace(/\s+/g, " ").trim() })).filter((c) => c.texto);
}

/** Acha as colunas pelo começo das células que se repetem em várias linhas e monta a tabela. */
function montarTabela(linhasBrutas: Pedaco[][]): string[][] {
  const brutas = linhasBrutas.filter((l) => l.length);
  const linhas = brutas.map(celulas).filter((l) => l.length);
  if (!linhas.length) return [];
  const tolerancia = 0.015;

  // colunas: grupos de inícios de célula parecidos que aparecem em pelo menos 2 linhas
  const inicios = linhas.flatMap((l) => l.map((c) => c.x0)).sort((a, b) => a - b);
  const grupos: { soma: number; n: number; max: number }[] = [];
  for (const x of inicios) {
    const g = grupos[grupos.length - 1];
    if (g && x - g.max <= tolerancia) { g.soma += x; g.n++; g.max = x; }
    else grupos.push({ soma: x, n: 1, max: x });
  }
  const minimo = Math.max(2, Math.floor(linhas.length * 0.08));
  let colunas = grupos.filter((g) => g.n >= minimo).map((g) => g.soma / g.n);
  if (!colunas.length) colunas = [0];

  // cada pedaço vai para a coluna em que começa; assim células coladas na foto ainda se separam
  return brutas.map((l) => {
    const saida = colunas.map(() => "");
    for (const c of l) {
      // a coluna é a última que começa antes (ou quase) desta célula
      let i = 0;
      for (let k = 0; k < colunas.length; k++) if (colunas[k] <= c.x0 + tolerancia) i = k;
      saida[i] = saida[i] ? `${saida[i]} ${c.texto}` : c.texto;
    }
    return saida.map((t) => t.replace(/\s+/g, " ").trim());
  }).filter((l) => l.some(Boolean));
}

