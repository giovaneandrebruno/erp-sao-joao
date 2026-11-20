"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";

function atualizar(id?: string) {
  revalidatePath("/estoque/inventario");
  if (id) revalidatePath(`/estoque/inventario/${id}`);
}

/** Abre uma contagem com o saldo atual de cada produto (todos ou de uma categoria). */
export async function abrirInventario(form: FormData) {
  const categoria = texto(form, "categoria");
  const supabase = await createClient();
  let consulta = supabase.from("produtos").select("id, estoque_atual").eq("ativo", true).neq("tipo", "servico");
  if (categoria) consulta = consulta.eq("categoria", categoria);
  const { data: produtos, error: e1 } = await consulta;
  if (e1) throw new Error(e1.message);
  if (!produtos?.length) throw new Error("Nenhum produto para contar nesta categoria.");
  const { data, error } = await supabase
    .from("inventarios")
    .insert({ descricao: texto(form, "descricao") ?? "Contagem do estoque", categoria, observacoes: texto(form, "observacoes") })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase
    .from("inventario_itens")
    .insert(produtos.map((p) => ({ inventario_id: data.id, produto_id: p.id, saldo_sistema: p.estoque_atual })));
  if (e2) throw new Error(e2.message);
  atualizar();
  redirect(`/estoque/inventario/${data.id}`);
}

/** Guarda o que foi contado (campo vazio = ainda não contado). */
export async function salvarContagem(inventarioId: string, form: FormData) {
  const supabase = await createClient();
  const mudancas: { id: string; contado: number | null }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("c:")) continue;
    const bruto = String(v).trim().replace(/\./g, "").replace(",", ".");
    const n = bruto === "" ? null : Number(bruto);
    if (n !== null && (!Number.isFinite(n) || n < 0)) continue;
    mudancas.push({ id: k.slice(2), contado: n });
  }
  for (const m of mudancas) {
    const { error } = await supabase.from("inventario_itens").update({ contado: m.contado }).eq("id", m.id).eq("inventario_id", inventarioId);
    if (error) throw new Error(error.message);
  }
  atualizar(inventarioId);
}

/** Ajusta o saldo de cada item contado e fecha o inventário. */
export async function concluirInventario(inventarioId: string, form: FormData) {
  await salvarContagem(inventarioId, form);
  const supabase = await createClient();
  const { error } = await supabase.rpc("concluir_inventario", { p_inventario: inventarioId });
  if (error) throw new Error(error.message);
  atualizar(inventarioId);
  revalidatePath("/estoque");
  revalidatePath("/estoque/movimentos");
}

export async function cancelarInventario(inventarioId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventarios").update({ status: "cancelado" }).eq("id", inventarioId).eq("status", "aberto");
  if (error) throw new Error(error.message);
  atualizar(inventarioId);
}
