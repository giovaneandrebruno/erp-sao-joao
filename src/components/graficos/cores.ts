/**
 * Cores dos gráficos. A ordem das séries é fixa e foi validada para
 * daltonismo sobre o cartão branco (diferença mínima entre vizinhas ΔE 9,4).
 * Uma série sozinha usa sempre a primeira (violeta da marca).
 * Nunca use estas cores em texto: rótulos e valores ficam na cor de tinta.
 */
export const SERIE = ["#6c47ff", "#d6367a", "#c98a00", "#0096b8", "#e8590c", "#0f9d58"] as const;

/** Escala ordenada (etapas do funil, faixas): uma só cor, do claro ao escuro. */
export const ORDINAL = ["#a690ff", "#8466ff", "#6c47ff", "#5530e0", "#4220ad", "#2e157a"] as const;

/** Bom / atenção / ruim. Sempre acompanhados de ícone ou texto. */
export const ESTADO = { bom: "#00a862", atencao: "#e5a000", ruim: "#f0306a" } as const;

export const TINTA = {
  forte: "#14142b",
  media: "#50546a",
  fraca: "#6b7086",
  grade: "#eef0f4",
  base: "#cfd2dc",
  superficie: "#ffffff",
} as const;
