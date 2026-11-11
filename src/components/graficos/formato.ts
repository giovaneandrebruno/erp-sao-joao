/** Formatação de números dos gráficos (servidor e navegador). */

export type Formato = "brl" | "num" | "pct" | "dias";

const brlCheio = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatar(v: number | null | undefined, f: Formato = "brl") {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (f === "brl") return brlCheio.format(v);
  if (f === "pct") return `${num.format(v)}%`;
  if (f === "dias") return `${num.format(v)} ${Math.abs(v) === 1 ? "dia" : "dias"}`;
  return num.format(v);
}

/** Rótulo curto de eixo. */
export function curto(v: number, f: Formato) {
  if (f === "pct") return `${num.format(v)}%`;
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  const pre = f === "brl" ? "R$ " : "";
  if (a >= 1_000_000) return `${s}${pre}${num.format(a / 1_000_000)} mi`;
  if (a >= 1_000) return `${s}${pre}${num.format(a / 1_000)} mil`;
  return `${s}${pre}${num.format(a)}`;
}
