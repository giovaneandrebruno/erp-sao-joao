"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";
import { exigirAdmin } from "@/lib/perfil";

function dadosLancamento(form: FormData) {
  return {
    tipo: (texto(form, "tipo") ?? "pagar") as "pagar" | "receber",
    unidade: (texto(form, "unidade") ?? "marcenaria") as "marcenaria" | "loja",
    descricao: texto(form, "descricao") ?? "",
    categoria: texto(form, "categoria"),
    valor: numero(form, "valor") ?? 0,
    vencimento: texto(form, "vencimento") ?? new Date().toISOString().slice(0, 10),
    forma_pagamento: texto(form, "forma_pagamento"),
    fornecedor_id: texto(form, "fornecedor_id"),
    cliente_id: texto(form, "cliente_id"),
  };
}

/** Mesmo dia em outro mês; se o mês for mais curto, cai no último dia (31/01 → 28/02). */
function somarMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

export async function criarLancamento(form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const base = dadosLancamento(form);
  // conta que se repete: aluguel, energia, salários... lança os próximos meses de uma vez
  const vezes = Math.min(60, Math.max(1, Math.round(numero(form, "repetir") ?? 1)));
  const linhas = Array.from({ length: vezes }, (_, i) => ({
    ...base,
    descricao: vezes > 1 ? `${base.descricao} (${i + 1}/${vezes})` : base.descricao,
    vencimento: somarMeses(base.vencimento, i),
  }));
  const { error } = await supabase.from("lancamentos").insert(linhas);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

export async function atualizarLancamento(id: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").update(dadosLancamento(form)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function marcarPago(id: string, pago: boolean) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update({ pago_em: pago ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function excluirLancamento(id: string): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/financeiro");
  revalidatePath("/");
  return null;
}
