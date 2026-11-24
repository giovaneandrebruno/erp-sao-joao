"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { exigirAdmin } from "@/lib/perfil";
import { ehSituacaoAcao, ehTipoReuniao, type SituacaoAcao } from "@/lib/reunioes";

// as pendências aparecem em várias atas: atualiza todas as telas de reuniões
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const atualizar = (_id?: string | null) => revalidatePath("/reunioes", "layout");

const hora = (form: FormData, campo: string) => {
  const t = texto(form, campo);
  return t && /^\d{1,2}:\d{2}$/.test(t) ? t : null;
};
const dataOuNula = (form: FormData, campo: string) => {
  const t = texto(form, campo);
  return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

function dadosReuniao(form: FormData) {
  const tipo = texto(form, "tipo");
  return {
    data: dataOuNula(form, "data") ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    tipo: ehTipoReuniao(tipo) ? tipo : "reuniao",
    assunto: texto(form, "assunto"),
    participantes: texto(form, "participantes"),
    local: texto(form, "local"),
    inicio: hora(form, "inicio"),
    termino: hora(form, "termino"),
    anotacoes: texto(form, "anotacoes"),
  };
}

/** Reunião nova. As ações "novas" das reuniões anteriores que não foram resolvidas passam a "pendentes" sozinhas (no banco). */
export async function criarReuniao(form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reunioes").insert(dadosReuniao(form)).select("id").single();
  if (error) throw new Error(error.message);
  atualizar();
  redirect(`/reunioes/${data.id}`);
}

export async function alterarReuniao(id: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reunioes").update(dadosReuniao(form)).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(id);
}

export async function excluirReuniao(id: string): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reunioes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar();
  return null;
}

function dadosAcao(form: FormData) {
  return {
    descricao: texto(form, "descricao") ?? "",
    responsavel: texto(form, "responsavel"),
    prazo: dataOuNula(form, "prazo"),
    observacao: texto(form, "observacao"),
  };
}

export async function criarAcao(reuniaoId: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reuniao_acoes").insert({ ...dadosAcao(form), reuniao_id: reuniaoId });
  if (error) throw new Error(error.message);
  atualizar(reuniaoId);
}

export async function alterarAcao(id: string, reuniaoId: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const situacao = texto(form, "situacao");
  const { error } = await supabase
    .from("reuniao_acoes")
    .update({ ...dadosAcao(form), ...(ehSituacaoAcao(situacao) ? { situacao } : {}) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(reuniaoId);
}

/** Botão rápido "OK" / "Reabrir". Reabrir volta para "pendente". */
export async function mudarSituacaoAcao(id: string, situacao: SituacaoAcao, reuniaoId?: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reuniao_acoes").update({ situacao }).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(reuniaoId);
}

export async function excluirAcao(id: string, reuniaoId: string): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reuniao_acoes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar(reuniaoId);
  return null;
}
