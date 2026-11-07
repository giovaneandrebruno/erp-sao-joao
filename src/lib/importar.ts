/** Leitura de itens exportados do programa de projeto (planilha CSV ou texto copiado da planilha). */

export type LinhaImportada = {
  ambiente: string | null;
  descricao: string;
  quantidade: number;
  custo_unitario: number | null;
  preco_unitario: number | null;
};

const CAMPOS: Record<keyof LinhaImportada | "largura" | "altura" | "profundidade", RegExp> = {
  ambiente: /ambiente|c[oô]modo|local/i,
  descricao: /descri|item|pe[cç]a|m[oó]dulo|produto|nome/i,
  quantidade: /qtd|quant/i,
  custo_unitario: /custo/i,
  preco_unitario: /venda|pre[cç]o|valor/i,
  largura: /^larg|^l$|^comp/i,
  altura: /^alt|^a$/i,
  profundidade: /^prof|^p$/i,
};

/** "1.234,56" → 1234.56 ; "1234.56" → 1234.56 ; "R$ 10" → 10 */
export function numeroBR(v: string | undefined): number | null {
  if (v == null) return null;
  let s = v.replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function dividir(linha: string, sep: string) {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (ch === sep && !aspas) { out.push(atual.trim()); atual = ""; }
    else atual += ch;
  }
  out.push(atual.trim());
  return out;
}

export function lerPlanilha(texto: string): { linhas: LinhaImportada[]; avisos: string[] } {
  const brutas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!brutas.length) return { linhas: [], avisos: ["Nada para importar."] };

  const sep = ["\t", ";", ","].map((s) => [s, brutas[0].split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const tabela = brutas.map((l) => dividir(l, sep));
  const cab = tabela[0];
  const temCabecalho = cab.some((c) => /[a-zA-Zà-ú]{3,}/.test(c)) && cab.filter((c) => numeroBR(c) !== null).length === 0;

  const idx: Partial<Record<keyof typeof CAMPOS, number>> = {};
  if (temCabecalho) {
    cab.forEach((c, i) => {
      for (const [campo, re] of Object.entries(CAMPOS) as [keyof typeof CAMPOS, RegExp][]) {
        if (idx[campo] === undefined && re.test(c)) { idx[campo] = i; break; }
      }
    });
  } else {
    Object.assign(idx, { ambiente: 0, descricao: 1, quantidade: 2, custo_unitario: 3, preco_unitario: 4 });
  }

  const avisos: string[] = [];
  if (idx.descricao === undefined) avisos.push("Não achei a coluna de descrição: usei a primeira coluna.");
  const linhas: LinhaImportada[] = [];
  for (const [n, col] of tabela.slice(temCabecalho ? 1 : 0).entries()) {
    const pega = (k: keyof typeof CAMPOS) => (idx[k] !== undefined ? col[idx[k]!] : undefined);
    let descricao = (pega("descricao") ?? col[0] ?? "").trim();
    if (!descricao) continue;
    const medidas = [pega("largura"), pega("altura"), pega("profundidade")].map(numeroBR);
    if (medidas.some((m) => m)) descricao += ` (${medidas.map((m) => m ?? "–").join(" × ")})`;
    const quantidade = numeroBR(pega("quantidade")) ?? 1;
    if (quantidade <= 0) { avisos.push(`Linha ${n + 1}: quantidade zerada, ignorada.`); continue; }
    linhas.push({
      ambiente: pega("ambiente")?.trim() || null,
      descricao: descricao.slice(0, 300),
      quantidade,
      custo_unitario: numeroBR(pega("custo_unitario")),
      preco_unitario: numeroBR(pega("preco_unitario")),
    });
  }
  return { linhas, avisos };
}

/** Junta todas as peças de cada ambiente numa linha só, somando custo e venda. */
export function agruparPorAmbiente(linhas: LinhaImportada[]): LinhaImportada[] {
  const mapa = new Map<string, LinhaImportada & { pecas: number }>();
  for (const l of linhas) {
    const chave = l.ambiente ?? "Geral";
    const g = mapa.get(chave) ?? { ambiente: chave, descricao: "", quantidade: 1, custo_unitario: 0, preco_unitario: null, pecas: 0 };
    g.pecas += l.quantidade;
    g.custo_unitario = (g.custo_unitario ?? 0) + (l.custo_unitario ?? 0) * l.quantidade;
    if (l.preco_unitario != null) g.preco_unitario = (g.preco_unitario ?? 0) + l.preco_unitario * l.quantidade;
    mapa.set(chave, g);
  }
  return [...mapa.values()].map(({ pecas, ...g }) => ({
    ...g,
    descricao: `Móveis planejados sob medida (${pecas.toLocaleString("pt-BR")} peças)`,
    custo_unitario: Math.round((g.custo_unitario ?? 0) * 100) / 100,
    preco_unitario: g.preco_unitario == null ? null : Math.round(g.preco_unitario * 100) / 100,
  }));
}
