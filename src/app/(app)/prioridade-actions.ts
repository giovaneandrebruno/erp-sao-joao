"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Prioridade de produção do Painel: lista curta, em ordem, só texto. */

export async function adicionarPrioridade(texto: string) {
  const limpo = texto.trim();
  if (!limpo) return;
  const supabase = await createClient();
  const { data: ultima } = await supabase.from("prioridade_producao").select("posicao").order("posicao", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("prioridade_producao").insert({ texto: limpo, posicao: Number(ultima?.posicao ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function editarPrioridade(id: string, texto: string) {
  const limpo = texto.trim();
  if (!limpo) return;
  const supabase = await createClient();
  const { error } = await supabase.from("prioridade_producao").update({ texto: limpo, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function tirarPrioridade(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("prioridade_producao").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

/** Grava a nova ordem: recebe os ids de cima para baixo. */
export async function ordenarPrioridades(ids: string[]) {
  const supabase = await createClient();
  const resultados = await Promise.all(
    ids.map((id, i) => supabase.from("prioridade_producao").update({ posicao: i + 1 }).eq("id", id)),
  );
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) throw new Error(erro.message);
  revalidatePath("/");
}
