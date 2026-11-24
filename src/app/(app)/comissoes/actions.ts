"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";
import { exigirAdmin } from "@/lib/perfil";

const atualizar = () => revalidatePath("/comissoes", "layout");
const pctValido = (v: number | null) => Math.min(100, Math.max(0, v ?? 0));

export async function salvarRegra(id: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("comissao_regras")
    .update({
      nome: texto(form, "nome") ?? "Comissão",
      percentual: pctValido(numero(form, "percentual")),
      minimo_mes: Math.max(0, numero(form, "minimo_mes") ?? 0),
      pessoa: texto(form, "pessoa"),
      observacao: texto(form, "observacao"),
      ativo: form.get("ativo") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  atualizar();
}

/** Nova comissão de equipe (% sobre as vendas gerais do mês). */
export async function novaRegraEquipe(form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { data: ult } = await supabase.from("comissao_regras").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("comissao_regras").insert({
    tipo: "equipe",
    nome: texto(form, "nome") ?? "Comissão",
    percentual: pctValido(numero(form, "percentual")),
    minimo_mes: Math.max(0, numero(form, "minimo_mes") ?? 0),
    pessoa: texto(form, "pessoa"),
    observacao: texto(form, "observacao"),
    ordem: Number(ult?.ordem ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
  atualizar();
}

export async function excluirRegra(id: string): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("comissao_regras").delete().eq("id", id).eq("tipo", "equipe");
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar();
  return null;
}

export async function salvarFaixa(id: string | null, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const dados = { a_partir_de: Math.max(0, numero(form, "a_partir_de") ?? 0), percentual: pctValido(numero(form, "percentual")) };
  const { error } = id
    ? await supabase.from("comissao_faixas").update(dados).eq("id", id)
    : await supabase.from("comissao_faixas").insert(dados);
  if (error) throw new Error(error.code === "23505" ? "Já existe uma faixa com esse valor." : error.message);
  atualizar();
}

export async function excluirFaixa(id: string): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("comissao_faixas").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar();
  return null;
}
