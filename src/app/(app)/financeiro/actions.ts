"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

export async function criarLancamento(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert({
    tipo: (texto(form, "tipo") ?? "pagar") as "pagar" | "receber",
    unidade: (texto(form, "unidade") ?? "marcenaria") as "marcenaria" | "loja",
    descricao: texto(form, "descricao") ?? "",
    categoria: texto(form, "categoria"),
    valor: numero(form, "valor") ?? 0,
    vencimento: texto(form, "vencimento") ?? new Date().toISOString().slice(0, 10),
    forma_pagamento: texto(form, "forma_pagamento"),
    fornecedor_id: texto(form, "fornecedor_id"),
    cliente_id: texto(form, "cliente_id"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

export async function marcarPago(id: string, pago: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update({ pago_em: pago ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function excluirLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}
