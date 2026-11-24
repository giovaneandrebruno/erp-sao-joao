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
    ...(/^\d{4}-\d{2}-\d{2}$/.test(texto(form, "solicitado_em") ?? "") ? { solicitado_em: texto(form, "solicitado_em") } : {}),
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
    preco = Math.round(custo * (await markupDoOrcamento(orcamentoId)) * 100) / 100;
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

export async function atualizarItem(orcamentoId: string, itemId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orcamento_itens")
    .update({
      ambiente: texto(form, "ambiente"),
      descricao: texto(form, "descricao") ?? "Item",
      quantidade: numero(form, "quantidade") ?? 1,
      custo_unitario: numero(form, "custo_unitario") ?? 0,
      preco_unitario: numero(form, "preco_unitario") ?? 0,
    })
    .eq("id", itemId)
    .eq("orcamento_id", orcamentoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

export async function removerItem(orcamentoId: string, itemId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("orcamento_itens").delete().eq("id", itemId);
  if (error) return `Não foi possível remover: ${error.message}`;
  revalidatePath(`/orcamentos/${orcamentoId}`);
  return null;
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

export async function importarItens(orcamentoId: string, linhas: import("@/lib/importar").LinhaImportada[]) {
  const supabase = await createClient();
  const markup = await markupDoOrcamento(orcamentoId);
  const { data: ult } = await supabase.from("orcamento_itens").select("ordem").eq("orcamento_id", orcamentoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const base = Number(ult?.ordem ?? 0);
  const { error } = await supabase.from("orcamento_itens").insert(
    linhas.slice(0, 2000).map((l, i) => ({
      orcamento_id: orcamentoId,
      ambiente: l.ambiente,
      descricao: l.descricao || "Item",
      quantidade: l.quantidade,
      custo_unitario: l.custo_unitario ?? 0,
      preco_unitario: l.preco_unitario ?? Math.round((l.custo_unitario ?? 0) * markup * 100) / 100,
      ordem: base + i + 1,
    })),
  );
  if (error) return error.message;
  revalidatePath(`/orcamentos/${orcamentoId}`);
  return null;
}

export type PerfilMargem = "baixo" | "medio" | "alto";
const PERFIS: PerfilMargem[] = ["baixo", "medio", "alto"];

/** Markup usado para sugerir o preço: o do perfil do cliente escolhido no orçamento, ou o padrão. */
async function markupDoOrcamento(orcamentoId: string) {
  const supabase = await createClient();
  const [{ data: cfg }, { data: orc }] = await Promise.all([
    supabase.from("configuracoes").select("markup_padrao, markup_perfil_baixo, markup_perfil_medio, markup_perfil_alto").single(),
    supabase.from("orcamentos").select("perfil_margem").eq("id", orcamentoId).maybeSingle(),
  ]);
  const perfil = orc?.perfil_margem as PerfilMargem | null | undefined;
  const doPerfil = perfil ? Number(cfg?.[`markup_perfil_${perfil}` as const]) : 0;
  return doPerfil > 0 ? doPerfil : Number(cfg?.markup_padrao ?? 1);
}

/**
 * Calculadora de margem: escolhe o perfil do cliente e refaz o preço de venda de cada item a partir do custo
 * (venda = custo × markup do perfil). Itens sem custo ficam como estão.
 */
export async function aplicarPerfilMargem(orcamentoId: string, perfil: PerfilMargem) {
  if (!PERFIS.includes(perfil)) throw new Error("Perfil inválido");
  const supabase = await createClient();
  const { data: orc } = await supabase.from("orcamentos").select("status").eq("id", orcamentoId).single();
  if (orc?.status === "aprovado") throw new Error("Orçamento aprovado não pode mudar de preço.");
  const { error: e1 } = await supabase.from("orcamentos").update({ perfil_margem: perfil }).eq("id", orcamentoId);
  if (e1) throw new Error(e1.message);
  const markup = await markupDoOrcamento(orcamentoId);
  const { data: itens } = await supabase.from("orcamento_itens").select("id, custo_unitario").eq("orcamento_id", orcamentoId);
  for (const i of itens ?? []) {
    if (Number(i.custo_unitario) <= 0) continue;
    const { error } = await supabase
      .from("orcamento_itens")
      .update({ preco_unitario: Math.round(Number(i.custo_unitario) * markup * 100) / 100 })
      .eq("id", i.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/orcamentos/${orcamentoId}`);
}
