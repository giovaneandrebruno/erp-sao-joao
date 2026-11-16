/**
 * Cores dos gráficos. A ordem das séries é fixa e foi pensada para
 * daltonismo sobre o cartão branco (vizinhas bem diferentes entre si).
 * Uma série sozinha usa sempre a primeira (azul da marca).
 * Nunca use estas cores em texto: rótulos e valores ficam na cor de tinta.
 */
export const SERIE = ["#2563d8", "#d6367a", "#c98a00", "#0f9488", "#e8590c", "#6b4fd8"] as const;

/** Escala ordenada (etapas do funil, faixas): uma só cor, do claro ao escuro. */
export const ORDINAL = ["#9fc0f7", "#6e9ef0", "#3f7ae3", "#2560c9", "#1c47a0", "#13294b"] as const;

/** Bom / atenção / ruim. Sempre acompanhados de ícone ou texto. */
export const ESTADO = { bom: "#12935a", atencao: "#e5a000", ruim: "#d9452b" } as const;

export const TINTA = {
  forte: "#0f1d33",
  media: "#4b5871",
  fraca: "#66748c",
  grade: "#eef2f7",
  base: "#cbd3df",
  superficie: "#ffffff",
} as const;
