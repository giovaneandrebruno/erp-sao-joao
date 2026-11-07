"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

function cabecalho(form: FormData) {
  return {
    unidade: (texto(form, "unidade") ?? "marcenaria") as "marcenaria" | "loja",
    validade: texto(form, "validade"),
    prazo_entrega_dias: numero(form, "prazo_entrega_dias"),
    desconto: numero(form, "desconto") ?? 0,
    condicoes_pagamento: texto(form, "condicoes_pagamento"),
    observacoes: texto(form, "observacoes"),
  };
}

export async function criarOrcamento(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ cliente_id: texto(form, "cliente_id"), ...cabecalho(form) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data.id}`);
}

export async function atualizarOrcamento(id: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("orcamentos").update(cabecalho(form)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamentos/${id}`);
}

export async function adicionarItem(orcamentoId: string, form: FormData) {
  const supabase = await createClient();
  const produtoId = texto(form, "produto_id");
  let descricao = texto(form, "descricao");
  let preco = numero(form, "preco_unitario");

  if (produtoId && (!descricao || preco === null)) {
    const { data: produto } = await supabase.from("produtos").select("nome, preco_venda").eq("id", produtoId).single();
    descricao ??= produto?.nome ?? null;
    preco ??= Number(produto?.preco_venda ?? 0);
  }

  const { error } = await supabase.from("orcamento_itens").insert({
    orcamento_id: orcamentoId,
    produto_id: produtoId,
    ambiente: texto(form, "ambiente"),
    descricao: descricao ?? "Item",
    quantidade: numero(form, "quantidade") ?? 1,
    preco_unitario: preco ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

export async function removerItem(orcamentoId: string, itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("orcamento_itens").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

export async function mudarStatus(id: string, status: "rascunho" | "enviado" | "recusado") {
  const supabase = await createClient();
  const { error } = await supabase.from("orcamentos").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/orcamentos");
}

export async function aprovar(id: string) {
  const supabase = await createClient();
  const { data: pedidoId, error } = await supabase.rpc("aprovar_orcamento", { p_orcamento_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/orcamentos");
  revalidatePath("/pedidos");
  redirect(`/pedidos/${pedidoId}`);
}
