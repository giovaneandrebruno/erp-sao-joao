"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/perfil";

export type MovimentoBanco = { data: string; descricao: string; valor: number };
export type Par = {
  mov: MovimentoBanco;
  lancamento: { id: string; tipo: string; descricao: string; valor: number; vencimento: string } | null;
};

const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/**
 * Procura, para cada linha do extrato, uma conta em aberto com o mesmo valor
 * (entrada = a receber, saída = a pagar) e vencimento até 10 dias de distância.
 */
export async function conferirExtrato(movs: MovimentoBanco[]): Promise<Par[]> {
  await exigirAdmin();
  const validos = movs.filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.data) && Number.isFinite(m.valor) && m.valor !== 0).slice(0, 2000);
  if (!validos.length) return [];
  const datas = validos.map((m) => m.data).sort();
  const mover = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const supabase = await createClient();
  const { data: abertos } = await supabase
    .from("lancamentos")
    .select("id, tipo, descricao, valor, vencimento")
    .is("pago_em", null)
    .gte("vencimento", mover(datas[0], -10))
    .lte("vencimento", mover(datas[datas.length - 1], 10))
    .limit(5000);
  const livres = [...(abertos ?? [])];
  return validos.map((mov) => {
    const tipo = mov.valor > 0 ? "receber" : "pagar";
    const alvo = Math.round(Math.abs(mov.valor) * 100);
    let melhor = -1;
    for (let i = 0; i < livres.length; i++) {
      const l = livres[i];
      if (l.tipo !== tipo || Math.round(Number(l.valor) * 100) !== alvo || dias(l.vencimento, mov.data) > 10) continue;
      if (melhor < 0 || dias(l.vencimento, mov.data) < dias(livres[melhor].vencimento, mov.data)) melhor = i;
    }
    const achado = melhor >= 0 ? livres.splice(melhor, 1)[0] : null;
    return { mov, lancamento: achado ? { ...achado, valor: Number(achado.valor) } : null };
  });
}

/** Marca como pagas as contas escolhidas, com a data em que caíram no banco. */
export async function darBaixaPeloExtrato(baixas: { id: string; data: string }[]): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  for (const b of baixas.slice(0, 2000)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data)) continue;
    const { error } = await supabase.from("lancamentos").update({ pago_em: b.data }).eq("id", b.id).is("pago_em", null);
    if (error) return `Não foi possível dar baixa: ${error.message}`;
  }
  revalidatePath("/financeiro");
  revalidatePath("/");
  return null;
}
