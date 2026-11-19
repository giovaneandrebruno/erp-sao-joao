import "server-only";
import { strToU8, zipSync } from "fflate";

/** Uma aba da planilha: nome e linhas (a primeira linha é o cabeçalho). */
export type AbaGravar = { nome: string; linhas: unknown[][] };

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // caracteres de controle não são aceitos no XML da planilha
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function coluna(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function celula(v: unknown, ref: string, negrito: boolean) {
  if (v === null || v === undefined || v === "") return "";
  const estilo = negrito ? ' s="1"' : "";
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
  if (typeof v === "boolean") return `<c r="${ref}" t="inlineStr"${estilo}><is><t>${v ? "sim" : "não"}</t></is></c>`;
  const texto = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `<c r="${ref}" t="inlineStr"${estilo}><is><t xml:space="preserve">${esc(texto.slice(0, 32000))}</t></is></c>`;
}

function folha(linhas: unknown[][]) {
  const corpo = linhas
    .map((l, r) => `<row r="${r + 1}">${l.map((v, c) => celula(v, `${coluna(c)}${r + 1}`, r === 0)).join("")}</row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${corpo}</sheetData></worksheet>`;
}

/** Monta um arquivo .xlsx (sem bibliotecas de fora) com uma aba para cada assunto. */
export function gravarPlanilha(abas: AbaGravar[]): Uint8Array {
  const nomes = abas.map((a, i) => esc(a.nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Aba ${i + 1}`));
  const arquivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    ),
  };
  abas.forEach((a, i) => (arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(folha(a.linhas))));
  return zipSync(arquivos, { level: 6 });
}
