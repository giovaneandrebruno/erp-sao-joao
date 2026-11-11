/**
 * Cálculos dos painéis de análise: séries por mês, tendência, previsão e
 * detecção de valores fora do normal. Funções puras, sem acesso ao banco.
 */

export const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11" → "nov/26" */
export function rotuloMes(mes: string, comAno = true) {
  const nome = NOMES_MES[Number(mes.slice(5, 7)) - 1];
  return comAno ? `${nome}/${mes.slice(2, 4)}` : nome;
}

/** Soma `delta` meses a "AAAA-MM". */
export function somarMeses(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Os `n` meses que terminam em `fim`, do mais antigo para o mais novo. */
export function mesesAte(fim: string, n: number) {
  return Array.from({ length: n }, (_, i) => somarMeses(fim, i - n + 1));
}

/** Soma por mês. `data` devolve a data (AAAA-MM-DD...) do item ou null para ignorar. */
export function somaMensal<T>(lista: T[], data: (x: T) => string | null | undefined, valor: (x: T) => number, meses: string[]) {
  const pos = new Map(meses.map((m, i) => [m, i]));
  const out = meses.map(() => 0);
  for (const x of lista) {
    const d = data(x);
    if (!d) continue;
    const i = pos.get(d.slice(0, 7));
    if (i !== undefined) out[i] += valor(x);
  }
  return out;
}

export function soma(v: number[]) {
  return v.reduce((s, x) => s + x, 0);
}

export function mediana(v: number[]) {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

/** Média móvel simples; os primeiros pontos sem janela completa ficam null. */
export function mediaMovel(v: number[], janela = 3): (number | null)[] {
  return v.map((_, i) => (i < janela - 1 ? null : soma(v.slice(i - janela + 1, i + 1)) / janela));
}

/** Variação percentual; null quando não há base de comparação. */
export function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Saldo acumulado a partir de um valor inicial. */
export function acumulado(v: number[], inicial = 0) {
  let s = inicial;
  return v.map((x) => (s += x));
}

export type Previsao = {
  valores: number[];
  baixo: number[];
  alto: number[];
  /** Meses de histórico usados. Menos de 6 = estimativa inicial. */
  historico: number;
  sazonal: boolean;
};

/**
 * Previsão por suavização exponencial com tendência (Holt), com faixa de 80%.
 * Usa a série a partir do primeiro mês com movimento. Com 24 meses ou mais,
 * aplica um ajuste sazonal suavizado (índice do mesmo mês do ano anterior).
 * Devolve null com menos de 3 meses de histórico.
 */
export function prever(serie: number[], passos = 3): Previsao | null {
  const inicio = serie.findIndex((x) => x !== 0);
  if (inicio < 0) return null;
  const s = serie.slice(inicio);
  if (s.length < 3) return null;

  // Ajuste sazonal: índice de cada mês = valor ÷ média móvel de 12 meses.
  const sazonal = s.length >= 24;
  const indice = new Array(12).fill(1);
  if (sazonal) {
    const media12 = soma(s.slice(-24)) / 24;
    if (media12 > 0) {
      const ult = s.slice(-24);
      for (let k = 0; k < 12; k++) {
        const bruto = (ult[k] + ult[k + 12]) / 2 / media12;
        indice[k] = 0.5 + 0.5 * bruto; // suavizado: metade do efeito, para não exagerar
      }
    }
  }
  // posição do mês dentro do ciclo de 12, alinhado ao fim da série
  const fase = (i: number) => (((i - (s.length - 24)) % 12) + 12) % 12;
  const ds = sazonal ? s.map((x, i) => x / (indice[fase(i)] || 1)) : s;

  let melhor = { erro: Infinity, a: 0.5, b: 0.1 };
  for (const a of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    for (const b of [0.05, 0.1, 0.2, 0.3]) {
      const { erro } = holt(ds, a, b);
      if (erro < melhor.erro) melhor = { erro, a, b };
    }
  }
  const { nivel, tendencia, rmse } = holt(ds, melhor.a, melhor.b);
  // Tendência amortecida: evita projetar uma subida (ou queda) forte para sempre.
  const phi = 0.85;
  const valores: number[] = [];
  const baixo: number[] = [];
  const alto: number[] = [];
  let amort = 0;
  for (let k = 1; k <= passos; k++) {
    amort += Math.pow(phi, k);
    const idx = sazonal ? indice[fase(s.length - 1 + k)] : 1;
    const v = Math.max(0, (nivel + amort * tendencia) * idx);
    const margem = 1.28 * rmse * Math.sqrt(k) * idx;
    valores.push(v);
    baixo.push(Math.max(0, v - margem));
    alto.push(v + margem);
  }
  return { valores, baixo, alto, historico: s.length, sazonal };
}

function holt(s: number[], a: number, b: number) {
  let nivel = s[0];
  let tendencia = s.length > 1 ? s[1] - s[0] : 0;
  let sq = 0;
  let n = 0;
  for (let i = 1; i < s.length; i++) {
    const prev = nivel + tendencia;
    sq += (s[i] - prev) ** 2;
    n++;
    const novo = a * s[i] + (1 - a) * (nivel + tendencia);
    tendencia = b * (novo - nivel) + (1 - b) * tendencia;
    nivel = novo;
  }
  const rmse = n ? Math.sqrt(sq / n) : 0;
  return { nivel, tendencia, rmse, erro: sq };
}

/**
 * Valor fora do normal comparado com o próprio histórico, pelo desvio robusto
 * (mediana e MAD). Devolve o desvio em relação à mediana (%) ou null se normal.
 * Precisa de pelo menos 4 pontos de histórico.
 */
export function anomalia(atual: number, historico: number[], limite = 3) {
  const h = historico.filter((x) => Number.isFinite(x));
  if (h.length < 4) return null;
  const med = mediana(h);
  const mad = mediana(h.map((x) => Math.abs(x - med)));
  const escala = mad > 0 ? mad / 0.6745 : soma(h.map((x) => Math.abs(x - med))) / h.length || med * 0.25 || 1;
  const z = (atual - med) / escala;
  const desvio = med ? ((atual - med) / med) * 100 : null;
  if (Math.abs(z) < limite || desvio === null || Math.abs(desvio) < 20) return null;
  return { desvio, mediana: med, z };
}

/** Diferença em dias entre duas datas AAAA-MM-DD (b − a). */
export function dias(a: string, b: string) {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);
}

const compacto = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** R$ curto para eixos e rótulos: R$ 850, R$ 12 mil, R$ 1,2 mi. */
export function brlCurto(v: number) {
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (a >= 1_000_000) return `${sinal}R$ ${compacto.format(a / 1_000_000)} mi`;
  if (a >= 1_000) return `${sinal}R$ ${compacto.format(a >= 100_000 ? Math.round(a / 1_000) : a / 1_000)} mil`;
  return `${sinal}R$ ${Math.round(a)}`;
}
