"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, numero, texto } from "@/lib/format";

export async function salvarSobra(id: string | null, form: FormData) {
  const supabase = await createClient();
  const produtoId = texto(form, "produto_id");
  let material = texto(form, "material");
  if (!material && produtoId) {
    const { data: p } = await supabase.from("produtos").select("nome").eq("id", produtoId).maybeSingle();
    material = p?.nome ?? null;
  }
  const registro = {
    produto_id: produtoId,
    material: material ?? "Chapa",
    largura_mm: Math.round(numero(form, "largura_mm") ?? 0),
    altura_mm: Math.round(numero(form, "altura_mm") ?? 0),
    quantidade: Math.max(1, Math.round(numero(form, "quantidade") ?? 1)),
    local: texto(form, "local"),
    observacoes: texto(form, "observacoes"),
  };
  if (registro.largura_mm <= 0 || registro.altura_mm <= 0) throw new Error("Informe a largura e a altura da sobra, em milímetros.");
  const { error } = id
    ? await supabase.from("retalhos").update(registro).eq("id", id)
    : await supabase.from("retalhos").insert(registro);
  if (error) throw new Error(error.message);
  revalidatePath("/estoque/sobras");
}

/** Marca uma unidade da sobra como usada (se tinha várias iguais, diminui uma). */
export async function usarSobra(id: string, form: FormData) {
  const supabase = await createClient();
  const { data: r, error: e1 } = await supabase.from("retalhos").select("*").eq("id", id).single();
  if (e1) throw new Error(e1.message);
  const pedido = texto(form, "usado_pedido_id");
  if (r.quantidade > 1) {
    const { error } = await supabase.from("retalhos").update({ quantidade: r.quantidade - 1 }).eq("id", id);
    if (error) throw new Error(error.message);
    const { error: e2 } = await supabase.from("retalhos").insert({
      produto_id: r.produto_id, material: r.material, largura_mm: r.largura_mm, altura_mm: r.altura_mm, quantidade: 1,
      local: r.local, observacoes: r.observacoes, usado_em: hojeISO(), usado_pedido_id: pedido,
    });
    if (e2) throw new Error(e2.message);
  } else {
    const { error } = await supabase.from("retalhos").update({ usado_em: hojeISO(), usado_pedido_id: pedido }).eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/estoque/sobras");
}

export async function excluirSobra(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("retalhos").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/estoque/sobras");
  return null;
}
