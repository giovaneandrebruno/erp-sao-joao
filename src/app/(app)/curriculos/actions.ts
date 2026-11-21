"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { BUCKET_CURRICULOS, ehUuid, pastaDoCurriculo } from "@/lib/curriculos";

export type ArquivoDoCurriculo = { caminho: string; nome_arquivo: string; tamanho: number; tipo_arquivo: string | null };
export type DadosDoCurriculo = { nome: string; vaga: string | null; telefone: string | null; email: string | null };

const limpar = (d: DadosDoCurriculo) => ({
  nome: d.nome.trim(),
  vaga: d.vaga?.trim() || null,
  telefone: d.telefone?.trim() || null,
  email: d.email?.trim() || null,
});

const atualizar = (id?: string) => {
  revalidatePath("/curriculos");
  if (id) revalidatePath(`/curriculos/${id}`);
};

/** Grava o currículo depois que o navegador enviou o arquivo para a pasta privada. */
export async function registrarCurriculo(id: string, dados: DadosDoCurriculo, arquivo: ArquivoDoCurriculo): Promise<string | null> {
  if (!ehUuid(id)) return "Currículo inválido.";
  if (!dados.nome?.trim()) return "Escreva o nome da pessoa.";
  if (!arquivo.caminho.startsWith(pastaDoCurriculo(id))) return "Arquivo fora da pasta do currículo.";
  const supabase = await createClient();
  const { error } = await supabase.from("curriculos").insert({ id, ...limpar(dados), ...arquivo });
  if (error) {
    await supabase.storage.from(BUCKET_CURRICULOS).remove([arquivo.caminho]);
    return `Não foi possível salvar: ${error.message}`;
  }
  atualizar();
  return null;
}

/** Altera os dados e, se veio um arquivo novo, troca o arquivo (o antigo é apagado). */
export async function alterarCurriculo(id: string, dados: DadosDoCurriculo, novo: ArquivoDoCurriculo | null): Promise<string | null> {
  if (!dados.nome?.trim()) return "Escreva o nome da pessoa.";
  if (novo && !novo.caminho.startsWith(pastaDoCurriculo(id))) return "Arquivo fora da pasta do currículo.";
  const supabase = await createClient();
  const { data: atual } = await supabase.from("curriculos").select("caminho").eq("id", id).maybeSingle();
  if (!atual) return "Currículo não encontrado.";
  const { error } = await supabase.from("curriculos").update({ ...limpar(dados), ...(novo ?? {}) }).eq("id", id);
  if (error) {
    if (novo) await supabase.storage.from(BUCKET_CURRICULOS).remove([novo.caminho]);
    return `Não foi possível salvar: ${error.message}`;
  }
  if (novo && novo.caminho !== atual.caminho) await supabase.storage.from(BUCKET_CURRICULOS).remove([atual.caminho]);
  atualizar(id);
  return null;
}

export async function excluirCurriculo(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: atual } = await supabase.from("curriculos").select("caminho").eq("id", id).maybeSingle();
  if (!atual) return "Currículo não encontrado.";
  const { error } = await supabase.from("curriculos").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  await supabase.storage.from(BUCKET_CURRICULOS).remove([atual.caminho]);
  atualizar();
  return null;
}

/* ─────────────────────────────── anotações ─────────────────────────────── */

export async function adicionarAnotacaoCurriculo(curriculoId: string, form: FormData) {
  const t = texto(form, "texto");
  if (!t) throw new Error("Escreva a anotação.");
  const supabase = await createClient();
  const { error } = await supabase.from("curriculo_anotacoes").insert({ curriculo_id: curriculoId, texto: t });
  if (error) throw new Error(error.message);
  atualizar(curriculoId);
}

export async function editarAnotacaoCurriculo(id: string, curriculoId: string, form: FormData) {
  const t = texto(form, "texto");
  if (!t) throw new Error("Escreva a anotação.");
  const supabase = await createClient();
  const { error } = await supabase.from("curriculo_anotacoes").update({ texto: t }).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(curriculoId);
}

export async function excluirAnotacaoCurriculo(id: string, curriculoId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("curriculo_anotacoes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar(curriculoId);
  return null;
}
