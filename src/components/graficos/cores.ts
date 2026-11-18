/**
 * Cores dos gráficos. A ordem das séries é fixa e foi pensada para
 * daltonismo sobre o cartão branco (vizinhas bem diferentes entre si).
 * Uma série sozinha usa sempre a primeira (laranja da marca).
 * Nunca use estas cores em texto: rótulos e valores ficam na cor de tinta.
 */
export const SERIE = ["#e37f33", "#4a4a4a", "#2563d8", "#0f9488", "#c98a00", "#7a5c3a"] as const;

/** Escala ordenada (etapas do funil, faixas): uma só cor, do claro ao escuro. */
export const ORDINAL = ["#f3d6b0", "#ecb98a", "#e89a5c", "#e37f33", "#b25d1e", "#5c3010"] as const;

/** Bom / atenção / ruim. Sempre acompanhados de ícone ou texto. */
export const ESTADO = { bom: "#12935a", atencao: "#e5a000", ruim: "#d9452b" } as const;

export const TINTA = {
  forte: "#1a1a1a",
  media: "#333333",
  fraca: "#3f3f3f",
  grade: "#f3f3f3",
  base: "#d4d4d4",
  superficie: "#ffffff",
} as const;
