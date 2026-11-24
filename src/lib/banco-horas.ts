/**
 * Banco de horas: compara as horas batidas no relógio ponto com a jornada de cada pessoa.
 * Jornada do dia = horas por semana ÷ 5, de segunda a sexta (feriados nacionais não contam).
 * Dia com atestado não conta como previsto. Sábado, domingo e feriado trabalhados entram como hora a mais.
 * Os dias depois da última marcação importada não contam (a planilha ainda não chegou).
 */
import { diasUteisDoPeriodo } from "@/lib/dias-uteis";

export type Atest = { data_inicio: string; data_fim: string };
export type DiaPonto = { dia: string; minutos_trabalhados: number | null };

/** Saldo do período: trabalhado − previsto, em minutos. */
export function saldoDoPeriodo({
  de, ate, horasSemana, dias, atestados,
}: { de: string; ate: string; horasSemana: number; dias: DiaPonto[]; atestados: Atest[] }) {
  if (ate < de) return { previsto: 0, trabalhado: 0, saldo: 0, diasPrevistos: 0, faltas: 0 };
  const jornada = Math.round((horasSemana * 60) / 5);
  const comAtestado = (d: string) => atestados.some((a) => a.data_inicio <= d && a.data_fim >= d);
  const noPeriodo = dias.filter((d) => d.dia >= de && d.dia <= ate);
  const batidos = new Set(noPeriodo.filter((d) => (d.minutos_trabalhados ?? 0) > 0).map((d) => d.dia));
  const uteis = diasUteisDoPeriodo(de, ate).filter((d) => !comAtestado(d));
  const previsto = uteis.length * jornada;
  const trabalhado = noPeriodo.reduce((t, d) => t + (d.minutos_trabalhados ?? 0), 0);
  return { previsto, trabalhado, saldo: trabalhado - previsto, diasPrevistos: uteis.length, faltas: uteis.filter((d) => !batidos.has(d)).length };
}

/** "5h30", "-2:15", "1,5" (horas) → minutos. Vazio = 0. */
export function minutosDoTexto(t: string | null | undefined) {
  const s = (t ?? "").trim().replace(/\s+/g, "");
  if (!s) return 0;
  const neg = /^[-−]/.test(s);
  const corpo = s.replace(/^[-−+]/, "");
  let min: number;
  const m = corpo.match(/^(\d+)[h:](\d{1,2})?m?$/i);
  if (m) min = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if (/^\d+([.,]\d+)?h?$/i.test(corpo)) min = Math.round(Number(corpo.replace(/h$/i, "").replace(",", ".")) * 60);
  else return null;
  return neg ? -min : min;
}
