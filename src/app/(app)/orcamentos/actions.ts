"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

type Forma = "pix" | "dinheiro" | "boleto" | "cartao_credito" | "cartao_debito" | "financiamento";

async function taxaDaForma(forma: Forma) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("configuracoes").select("taxa_credito, taxa_debito, taxa_boleto").single();
  if (!c) return 0;
  return forma === "cartao_credito" ? Number(c.taxa_credito) : forma === "cartao_debito" ? Number(c.taxa_debito) : forma === "boleto" ? Number(c.taxa_boleto) : 0;
}

async function cabecalho(form: FormData) {
  const forma = (texto(form, "forma_pagamento") ?? "pix") as Forma;
  const taxa = numero(form, "taxa_pagamento_pct");
  return {
    ...cabecalhoBase(form),
    vendedor_id: texto(form, "vendedor_id"),
    arquiteto_id: texto(form, "arquiteto_id"),
    comissao_vendedor_pct: texto(form, "vendedor_id") ? (numero(form, "comissao_vendedor_pct") ?? 0) : 0,
    comissao_arquiteto_pct: texto(form, "arquiteto_id") ? (numero(form, "comissao_arquiteto_pct") ?? 0) : 0,
    forma_pagamento: forma,
    parcelas: Math.max(1, Math.round(numero(form, "parcelas") ?? 1)),
    taxa_pagamento_pct: taxa ?? (await taxaDaForma(forma)),
    ...(numero(form, "imposto_pct") !== null ? { imposto_pct: numero(form, "imposto_pct")! } : {}),
  };
}

function cabecalhoBase(form: FormData) {
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
    .insert({ cliente_id: texto(form, "cliente_id"), ...(await cabecalho(form)) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data.id}`);
}

export async function atualizarOrcamento(id: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("orcamentos").update(await cabecalho(form)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamentos/${id}`);
}

export async function adicionarItem(orcamentoId: string, form: FormData) {
  const supabase = await createClient();
  const produtoId = texto(form, "produto_id");
  let descricao = texto(form, "descricao");
  let preco = numero(form, "preco_unitario");
  let custo = numero(form, "custo_unitario");

  if (produtoId) {
    const { data: produto } = await supabase.from("produtos").select("nome, preco_venda, custo").eq("id", produtoId).single();
    descricao ??= produto?.nome ?? null;
    preco ??= Number(produto?.preco_venda ?? 0);
    custo ??= Number(produto?.custo ?? 0);
  }
  if (preco === null && custo !== null) {
    const { data: cfg } = await supabase.from("configuracoes").select("markup_padrao").single();
    preco = Math.round(custo * Number(cfg?.markup_padrao ?? 1) * 100) / 100;
  }

  const { error } = await supabase.from("orcamento_itens").insert({
    orcamento_id: orcamentoId,
    produto_id: produtoId,
    ambiente: texto(form, "ambiente"),
    descricao: descricao ?? "Item",
    quantidade: numero(form, "quantidade") ?? 1,
    preco_unitario: preco ?? 0,
    custo_unitario: custo ?? 0,
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
