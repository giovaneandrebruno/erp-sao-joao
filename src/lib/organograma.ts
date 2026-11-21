/**
 * Organograma: pessoas (ou vagas em aberto), quem responde a quem e as funções de cada um.
 * A carga de cada pessoa é a soma das horas por semana das funções dela. Quando uma função
 * é dividida entre várias pessoas, as horas são divididas igualmente entre elas.
 * Vaga em aberto não conta como gente: função que só tem vaga é "sem ninguém" (precisa contratar).
 */

export type PessoaOrg = {
  id: string;
  nome: string | null;
  cargo: string;
  setor: string | null;
  chefe_id: string | null;
  horas_semana: number;
  observacoes: string | null;
  ordem: number;
  pos_x: number;
  pos_y: number;
  largura: number;
  altura: number;
  cor: string;
  texto: string | null;
};

/** As 16 cores que dá para escolher para cada quadro. */
export const CORES_QUADRO: { id: string; nome: string; hex: string }[] = [
  { id: "branco", nome: "Branco", hex: "#d4d4d4" },
  { id: "cinza", nome: "Cinza", hex: "#8a8a8a" },
  { id: "grafite", nome: "Grafite", hex: "#3d3d3d" },
  { id: "vermelho", nome: "Vermelho", hex: "#dc2626" },
  { id: "laranja", nome: "Laranja", hex: "#e37f33" },
  { id: "ambar", nome: "Âmbar", hex: "#d99a06" },
  { id: "amarelo", nome: "Amarelo", hex: "#eab308" },
  { id: "lima", nome: "Verde-limão", hex: "#84cc16" },
  { id: "verde", nome: "Verde", hex: "#16a34a" },
  { id: "turquesa", nome: "Turquesa", hex: "#14b8a6" },
  { id: "ciano", nome: "Ciano", hex: "#06b6d4" },
  { id: "azul", nome: "Azul", hex: "#2563eb" },
  { id: "indigo", nome: "Anil", hex: "#4f46e5" },
  { id: "roxo", nome: "Roxo", hex: "#9333ea" },
  { id: "rosa", nome: "Rosa", hex: "#db2777" },
  { id: "marrom", nome: "Marrom", hex: "#8f4a18" },
];
export const corDoQuadro = (id: string | null | undefined) => CORES_QUADRO.find((c) => c.id === id) ?? CORES_QUADRO[0];
export type FuncaoOrg = { id: string; nome: string; setor: string | null; horas_semana: number; descricao: string | null };
export type AtribuicaoOrg = { funcao_id: string; pessoa_id: string };

export type Nivel = "vaga" | "sem_funcao" | "folga" | "normal" | "limite" | "sobrecarregada";

export type Carga = {
  funcoes: { funcao: FuncaoOrg; horas: number; dividida: number }[];
  horas: number;
  capacidade: number;
  /** Porcentagem da capacidade (null quando não dá para calcular). */
  pct: number | null;
  nivel: Nivel;
};

export const NIVEL: Record<Nivel, { rotulo: string; cor: "stone" | "amber" | "green" | "red" | "blue"; barra: string }> = {
  vaga: { rotulo: "Vaga em aberto", cor: "blue", barra: "bg-madeira-400" },
  sem_funcao: { rotulo: "Sem função", cor: "stone", barra: "bg-stone-300" },
  folga: { rotulo: "Com folga", cor: "stone", barra: "bg-stone-400" },
  normal: { rotulo: "Normal", cor: "green", barra: "bg-neon" },
  limite: { rotulo: "No limite", cor: "amber", barra: "bg-amber-500" },
  sobrecarregada: { rotulo: "Sobrecarregada", cor: "red", barra: "bg-rosa" },
};

export const ehVaga = (p: Pick<PessoaOrg, "nome">) => !p.nome?.trim();
export const nomeDaPessoa = (p: Pick<PessoaOrg, "nome">) => (ehVaga(p) ? "Vaga em aberto" : p.nome!.trim());

export const horas = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")}h`;

function nivelPorPct(pct: number): Nivel {
  if (pct > 100) return "sobrecarregada";
  if (pct >= 90) return "limite";
  if (pct >= 50) return "normal";
  return "folga";
}

/** Calcula a carga de cada pessoa e o que está sem ninguém. */
export function calcularOrganograma(pessoas: PessoaOrg[], funcoes: FuncaoOrg[], atribuicoes: AtribuicaoOrg[]) {
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const genteDaFuncao = new Map<string, PessoaOrg[]>();
  const vagasDaFuncao = new Map<string, PessoaOrg[]>();
  for (const a of atribuicoes) {
    const p = porId.get(a.pessoa_id);
    if (!p) continue;
    const mapa = ehVaga(p) ? vagasDaFuncao : genteDaFuncao;
    mapa.set(a.funcao_id, [...(mapa.get(a.funcao_id) ?? []), p]);
  }

  const cargas = new Map<string, Carga>();
  for (const p of pessoas) {
    const vaga = ehVaga(p);
    const minhas = atribuicoes.filter((a) => a.pessoa_id === p.id).map((a) => funcoes.find((f) => f.id === a.funcao_id)).filter((f): f is FuncaoOrg => Boolean(f));
    const lista = minhas.map((f) => {
      // vaga: mostra quanto a função vai tomar de quem for contratado
      const dividida = vaga ? (vagasDaFuncao.get(f.id)?.length ?? 1) + (genteDaFuncao.get(f.id)?.length ?? 0) : genteDaFuncao.get(f.id)?.length ?? 1;
      return { funcao: f, dividida, horas: Number(f.horas_semana) / Math.max(dividida, 1) };
    });
    const total = lista.reduce((s, x) => s + x.horas, 0);
    const capacidade = Number(p.horas_semana) || 0;
    const pct = capacidade > 0 ? (total / capacidade) * 100 : null;
    const nivel: Nivel = vaga ? "vaga" : !lista.length ? "sem_funcao" : pct === null ? "normal" : nivelPorPct(pct);
    cargas.set(p.id, { funcoes: lista.sort((a, b) => b.horas - a.horas), horas: total, capacidade, pct, nivel });
  }

  const semNinguem = funcoes
    .filter((f) => !genteDaFuncao.get(f.id)?.length)
    .map((f) => ({ funcao: f, vagas: vagasDaFuncao.get(f.id) ?? [] }));
  const vagas = pessoas.filter(ehVaga);
  const sobrecarregadas = pessoas.filter((p) => cargas.get(p.id)?.nivel === "sobrecarregada");
  const genteDe = (funcaoId: string) => [...(genteDaFuncao.get(funcaoId) ?? []), ...(vagasDaFuncao.get(funcaoId) ?? [])];

  return { cargas, semNinguem, vagas, sobrecarregadas, genteDe };
}

/** Ids de quem está abaixo da pessoa (subordinados, subordinados deles...). */
export function abaixoDe(id: string, pessoas: Pick<PessoaOrg, "id" | "chefe_id">[]) {
  const fora = new Set<string>();
  const fila = [id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const p of pessoas) if (p.chefe_id === atual && !fora.has(p.id)) { fora.add(p.id); fila.push(p.id); }
  }
  return fora;
}

export type No = { pessoa: PessoaOrg; filhos: No[] };

/** Monta a árvore. Quem não responde a ninguém (ou responde a alguém que sumiu) fica no topo. */
export function montarArvore(pessoas: PessoaOrg[]): No[] {
  const ids = new Set(pessoas.map((p) => p.id));
  const ordenar = (a: PessoaOrg, b: PessoaOrg) => a.ordem - b.ordem || a.cargo.localeCompare(b.cargo, "pt-BR") || nomeDaPessoa(a).localeCompare(nomeDaPessoa(b), "pt-BR");
  const montar = (chefe: string | null, visto: Set<string>): No[] =>
    pessoas
      .filter((p) => (chefe === null ? !p.chefe_id || !ids.has(p.chefe_id) : p.chefe_id === chefe) && !visto.has(p.id))
      .sort(ordenar)
      .map((p) => {
        visto.add(p.id);
        return { pessoa: p, filhos: montar(p.id, visto) };
      });
  return montar(null, new Set());
}

/** "Atender clientes - 10h" → { nome: "Atender clientes", horas: 10 }. */
export function lerFuncaoNova(linha: string) {
  const t = linha.trim();
  if (!t) return null;
  const m = t.match(/^(.*?)[\s;:,–-]+(\d+(?:[.,]\d+)?)\s*(?:h|hs|horas?)?\s*$/i);
  if (m && m[1].trim()) return { nome: m[1].trim(), horas: Math.min(Number(m[2].replace(",", ".")), 168) };
  return { nome: t, horas: 0 };
}
