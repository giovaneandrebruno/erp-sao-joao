"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

export async function salvarProduto(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro = {
    codigo: texto(form, "codigo"),
    nome: texto(form, "nome") ?? "",
    tipo: (texto(form, "tipo") ?? "materia_prima") as "materia_prima" | "produto" | "servico",
    unidade_medida: texto(form, "unidade_medida") ?? "un",
    custo: numero(form, "custo") ?? 0,
    preco_venda: numero(form, "preco_venda") ?? 0,
    estoque_minimo: numero(form, "estoque_minimo") ?? 0,
    fornecedor_id: texto(form, "fornecedor_id"),
    ativo: form.get("ativo") !== null || !id,
  };
  const { data, error } = id
    ? await supabase.from("produtos").update(registro).eq("id", id).select("id").single()
    : await supabase.from("produtos").insert(registro).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
  redirect(`/estoque/${data.id}`);
}

export async function registrarMovimento(produtoId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("movimentos_estoque").insert({
    produto_id: produtoId,
    tipo: (texto(form, "tipo") ?? "entrada") as "entrada" | "saida" | "ajuste",
    quantidade: numero(form, "quantidade") ?? 0,
    custo_unitario: numero(form, "custo_unitario"),
    referencia: texto(form, "referencia"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/estoque/${produtoId}`);
  revalidatePath("/estoque");
}
