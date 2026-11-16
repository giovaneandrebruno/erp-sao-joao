/**
 * Leitura de planilhas Excel (.xlsx) no navegador.
 * Devolve cada aba como uma tabela de textos.
 */
import { unzipSync, strFromU8 } from "fflate";

export type Aba = { nome: string; linhas: string[][] };

export const EXT_PLANILHA = /\.xlsx$/i;
export const AVISO_FORMATO = "O sistema lê planilhas em .xlsx. No Excel, use Arquivo › Salvar como › Pasta de Trabalho do Excel (.xlsx) e envie de novo.";

export async function lerPlanilhaArquivo(arquivo: File): Promise<Aba[]> {
  if (!EXT_PLANILHA.test(arquivo.name)) throw new Error(AVISO_FORMATO);
  return lerXlsx(new Uint8Array(await arquivo.arrayBuffer()));
}

// ---------------------------------------------------------------- texto colado (itens do orçamento)

export function lerTexto(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primeira = limpo.split("\n").find((l) => l.trim()) ?? "";
  const sep = ["\t", ";", ","].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: string[][] = [];
  let linha: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') { atual += '"'; i++; }
      else if (ch === '"') aspas = false;
      else atual += ch;
    } else if (ch === '"' && atual.trim() === "") { aspas = true; atual = ""; }
    else if (ch === sep) { linha.push(atual.trim()); atual = ""; }
    else if (ch === "\n") { linha.push(atual.trim()); linhas.push(linha); linha = []; atual = ""; }
    else atual += ch;
  }
  if (atual || linha.length) { linha.push(atual.trim()); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c));
}

/** Volta uma tabela para texto separado por tabulação (para o importador de itens do orçamento). */
export function paraTexto(linhas: string[][]) {
  return linhas.map((l) => l.map((c) => (c ?? "").replace(/[\t\n]/g, " ")).join("\t")).join("\n");
}

// ---------------------------------------------------------------- Excel (.xlsx)

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const tags = (n: Document | Element, nome: string) => Array.from(n.getElementsByTagNameNS("*", nome));

function colunaIndice(ref: string) {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

const FORMATOS_DATA = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function serialParaData(serial: number) {
  const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${dt.getUTCFullYear()}`;
}

function lerXlsx(buf: Uint8Array): Aba[] {
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(buf, { filter: (f) => f.name.startsWith("xl/") && f.name.endsWith(".xml") || f.name.endsWith(".rels") });
  } catch {
    throw new Error("Não consegui abrir a planilha. Ela pode estar protegida por senha ou corrompida.");
  }
  const ler = (nome: string) => (arquivos[nome] ? strFromU8(arquivos[nome]) : null);

  // textos compartilhados
  const compartilhados: string[] = [];
  const ss = ler("xl/sharedStrings.xml");
  if (ss) {
    for (const si of tags(xml(ss), "si")) {
      compartilhados.push(tags(si, "t").filter((t) => (t.parentElement?.localName ?? "") !== "rPh").map((t) => t.textContent ?? "").join(""));
    }
  }

  // quais estilos são datas
  const estiloData: boolean[] = [];
  const st = ler("xl/styles.xml");
  if (st) {
    const doc = xml(st);
    const proprios = new Map<number, string>();
    for (const f of tags(doc, "numFmt")) proprios.set(Number(f.getAttribute("numFmtId")), f.getAttribute("formatCode") ?? "");
    const cellXfs = tags(doc, "cellXfs")[0];
    if (cellXfs) {
      for (const xf of Array.from(cellXfs.children).filter((e) => e.localName === "xf")) {
        const id = Number(xf.getAttribute("numFmtId") ?? 0);
        const codigo = (proprios.get(id) ?? "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
        estiloData.push(FORMATOS_DATA.has(id) || (/[dy]/i.test(codigo) && !/[#0]/.test(codigo)));
      }
    }
  }

  // abas na ordem do arquivo
  const wb = xml(ler("xl/workbook.xml") ?? "<workbook/>");
  const rels = xml(ler("xl/_rels/workbook.xml.rels") ?? "<Relationships/>");
  const alvo = new Map(tags(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""]));
  const abas: Aba[] = [];
  for (const sh of tags(wb, "sheet")) {
    if (sh.getAttribute("state") === "hidden" || sh.getAttribute("state") === "veryHidden") continue;
    const rid = sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? sh.getAttribute("r:id");
    let caminho = alvo.get(rid) ?? "";
    caminho = caminho.startsWith("/") ? caminho.slice(1) : `xl/${caminho}`;
    const conteudo = ler(caminho.replace(/\/\.\//g, "/"));
    if (!conteudo) continue;
    const linhas: string[][] = [];
    for (const row of tags(xml(conteudo), "row")) {
      const r = Number(row.getAttribute("r") ?? linhas.length + 1) - 1;
      if (r > 20000) break;
      const linha: string[] = [];
      for (const c of Array.from(row.children).filter((e) => e.localName === "c")) {
        const i = colunaIndice(c.getAttribute("r") ?? "");
        const t = c.getAttribute("t");
        const v = tags(c, "v")[0]?.textContent ?? "";
        let valor = "";
        if (t === "s") valor = compartilhados[Number(v)] ?? "";
        else if (t === "inlineStr") valor = tags(c, "t").map((x) => x.textContent ?? "").join("");
        else if (t === "b") valor = v === "1" ? "VERDADEIRO" : "FALSO";
        else if (t === "e") valor = "";
        else if (t === "str") valor = v;
        else if (v !== "") {
          const n = Number(v);
          const s = Number(c.getAttribute("s") ?? 0);
          valor = estiloData[s] && Number.isFinite(n) && n > 0 && n < 100000 ? serialParaData(n) : String(Math.round(n * 1e6) / 1e6);
        }
        linha[i] = valor.trim();
      }
      linhas[r] = Array.from(linha, (x) => x ?? "");
    }
    abas.push({ nome: sh.getAttribute("name") ?? `Aba ${abas.length + 1}`, linhas: Array.from(linhas, (l) => l ?? []).filter((l) => l.some((c) => c)) });
  }
  if (!abas.length) throw new Error("A planilha não tem abas com dados.");
  return abas;
}

