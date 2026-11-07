"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_NEGOCIACAO, numero, texto } from "@/lib/format";

type Etapa = (typeof ETAPAS_NEGOCIACAO)[number];

export async function criarNegociacao(form: FormData) {
  const supabase = await createClient();
  let clienteId = texto(form, "cliente_id");
  if (!clienteId) {
    const nome = texto(form, "novo_nome");
    if (!nome) throw new Error("Escolha um cliente ou informe o nome do novo contato.");
    const { data, error } = await supabase
      .from("clientes")
      .insert({ nome, telefone: texto(form, "novo_telefone") })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    clienteId = data.id;
  }
  const { data, error } = await supabase
    .from("negociacoes")
    .insert({
      cliente_id: clienteId,
      titulo: texto(form, "titulo") ?? "Novo projeto",
      origem: texto(form, "origem"),
      valor_estimado: numero(form, "valor_estimado"),
      vendedor_id: texto(form, "vendedor_id"),
      arquiteto_id: texto(form, "arquiteto_id"),
      proxima_acao: texto(form, "proxima_acao"),
      proxima_acao_data: texto(form, "proxima_acao_data"),
      unidade: (texto(form, "unidade") ?? "marcenaria") as "marcenaria" | "loja",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
  redirect(`/crm/${data.id}`);
}

export async function moverNegociacao(id: string, etapa: Etapa) {
  const supabase = await createClient();
  const { error } = await supabase.from("negociacoes").update({ etapa }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

export async function atualizarNegociacao(id: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("negociacoes")
    .update({
      titulo: texto(form, "titulo") ?? "Projeto",
      etapa: (texto(form, "etapa") ?? "novo") as Etapa,
      origem: texto(form, "origem"),
      valor_estimado: numero(form, "valor_estimado"),
      vendedor_id: texto(form, "vendedor_id"),
      arquiteto_id: texto(form, "arquiteto_id"),
      proxima_acao: texto(form, "proxima_acao"),
      proxima_acao_data: texto(form, "proxima_acao_data"),
      motivo_perda: texto(form, "motivo_perda"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

export async function adicionarNota(id: string, form: FormData) {
  const supabase = await createClient();
  const textoNota = texto(form, "texto");
  if (!textoNota) return;
  const { error } = await supabase.from("negociacao_notas").insert({ negociacao_id: id, texto: textoNota });
  if (error) throw new Error(error.message);
  revalidatePath(`/crm/${id}`);
}

/** Cria o orçamento já ligado à negociação, com vendedor, arquiteto e comissões padrão. */
export async function gerarOrcamento(id: string) {
  const supabase = await createClient();
  const [{ data: n, error: e1 }, { data: cfg }] = await Promise.all([
    supabase.from("negociacoes").select("*, vendedor:vendedor_id(comissao_padrao), arquiteto:arquiteto_id(comissao_padrao)").eq("id", id).single(),
    supabase.from("configuracoes").select("comissao_vendedor_padrao, comissao_arquiteto_padrao").single(),
  ]);
  if (e1) throw new Error(e1.message);
  if (n.orcamento_id) redirect(`/orcamentos/${n.orcamento_id}`);

  const vend = n.vendedor as unknown as { comissao_padrao: number | null } | null;
  const arq = n.arquiteto as unknown as { comissao_padrao: number | null } | null;
  const { data: orc, error } = await supabase
    .from("orcamentos")
    .insert({
      cliente_id: n.cliente_id,
      unidade: n.unidade,
      vendedor_id: n.vendedor_id,
      arquiteto_id: n.arquiteto_id,
      comissao_vendedor_pct: n.vendedor_id ? Number(vend?.comissao_padrao ?? cfg?.comissao_vendedor_padrao ?? 0) : 0,
      comissao_arquiteto_pct: n.arquiteto_id ? Number(arq?.comissao_padrao ?? cfg?.comissao_arquiteto_padrao ?? 0) : 0,
      observacoes: n.titulo,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("negociacoes").update({ orcamento_id: orc.id, etapa: "proposta" }).eq("id", id);
  revalidatePath("/crm");
  redirect(`/orcamentos/${orc.id}`);
}
