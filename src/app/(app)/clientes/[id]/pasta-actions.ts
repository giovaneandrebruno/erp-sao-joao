"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, texto } from "@/lib/format";
import { SITUACOES, ehSituacaoAtendimento, type SituacaoAtendimento } from "@/lib/processo";
import { BUCKET_DOCUMENTOS, ehTipoDocumento, pastaDoCliente } from "@/lib/documentos";
import { CAMPOS_BRIEFING } from "@/lib/briefing";

export type ArquivoEnviado = { caminho: string; nome_arquivo: string; tamanho: number; tipo_arquivo: string | null };

const atualizar = (clienteId: string) => revalidatePath(`/clientes/${clienteId}`);

/** Grava na pasta do cliente os arquivos que o navegador acabou de enviar ao Storage. */
export async function registrarDocumentos(clienteId: string, tipo: string, descricao: string | null, arquivos: ArquivoEnviado[]): Promise<string | null> {
  if (!ehTipoDocumento(tipo)) return "Escolha o tipo do documento.";
  if (!arquivos.length) return "Escolha um arquivo.";
  if (arquivos.some((a) => !a.caminho.startsWith(pastaDoCliente(clienteId)))) return "Arquivo fora da pasta deste cliente.";
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_documentos").insert(
    arquivos.map((a) => ({ cliente_id: clienteId, tipo, descricao: descricao?.trim() || null, ...a })),
  );
  if (error) {
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove(arquivos.map((a) => a.caminho));
    return `Não foi possível salvar: ${error.message}`;
  }
  atualizar(clienteId);
  return null;
}

/** Altera o tipo e a descrição e, se veio um arquivo novo, troca o arquivo (o antigo é apagado). */
export async function alterarDocumento(id: string, tipo: string, descricao: string | null, novo: ArquivoEnviado | null): Promise<string | null> {
  if (!ehTipoDocumento(tipo)) return "Escolha o tipo do documento.";
  const supabase = await createClient();
  const { data: doc, error: erroLer } = await supabase.from("cliente_documentos").select("cliente_id, caminho").eq("id", id).maybeSingle();
  if (erroLer || !doc) return "Documento não encontrado.";
  if (novo && !novo.caminho.startsWith(pastaDoCliente(doc.cliente_id))) return "Arquivo fora da pasta deste cliente.";
  const { error } = await supabase.from("cliente_documentos").update({ tipo, descricao: descricao?.trim() || null, ...(novo ?? {}) }).eq("id", id);
  if (error) {
    if (novo) await supabase.storage.from(BUCKET_DOCUMENTOS).remove([novo.caminho]);
    return `Não foi possível salvar: ${error.message}`;
  }
  if (novo && novo.caminho !== doc.caminho) await supabase.storage.from(BUCKET_DOCUMENTOS).remove([doc.caminho]);
  atualizar(doc.cliente_id);
  return null;
}

export async function excluirDocumento(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("cliente_documentos").select("cliente_id, caminho").eq("id", id).maybeSingle();
  if (!doc) return "Documento não encontrado.";
  const { error } = await supabase.from("cliente_documentos").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  await supabase.storage.from(BUCKET_DOCUMENTOS).remove([doc.caminho]);
  atualizar(doc.cliente_id);
  return null;
}

/* ─────────────────────────────── anotações ─────────────────────────────── */

export async function adicionarAnotacao(clienteId: string, form: FormData) {
  const t = texto(form, "texto");
  if (!t) throw new Error("Escreva a anotação.");
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_anotacoes").insert({ cliente_id: clienteId, texto: t });
  if (error) throw new Error(error.message);
  atualizar(clienteId);
}

export async function editarAnotacao(id: string, clienteId: string, form: FormData) {
  const t = texto(form, "texto");
  if (!t) throw new Error("Escreva a anotação.");
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_anotacoes").update({ texto: t }).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(clienteId);
}

export async function excluirAnotacao(id: string, clienteId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_anotacoes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar(clienteId);
  return null;
}

/* ─────────────────────────────── briefing ─────────────────────────────── */

export async function salvarBriefing(clienteId: string, form: FormData) {
  const respostas: Record<string, string> = {};
  for (const campo of CAMPOS_BRIEFING) {
    const v = texto(form, campo);
    if (v) respostas[campo] = v;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_briefing").upsert({ cliente_id: clienteId, respostas }, { onConflict: "cliente_id" });
  if (error) throw new Error(error.message);
  atualizar(clienteId);
}

/* ─────────────────────── pasta devolvida para correção ─────────────────────── */

/** Devolve a pasta para quem precisa corrigir, com o motivo. Enquanto não for corrigida, o pedido não avança de etapa. */
export async function devolverPasta(clienteId: string, form: FormData) {
  const motivo = texto(form, "motivo");
  if (!motivo) throw new Error("Escreva o motivo.");
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_pasta_devolucoes").insert({ cliente_id: clienteId, motivo, responsavel_id: texto(form, "responsavel_id") });
  if (error) throw new Error(error.message);
  atualizar(clienteId);
  revalidatePath("/");
  revalidatePath("/prazos");
}

export async function marcarPastaCorrigida(id: string, clienteId: string) {
  const supabase = await createClient();
  const { data: quem } = await supabase.rpc("nome_do_usuario_atual");
  const { error } = await supabase
    .from("cliente_pasta_devolucoes")
    .update({ corrigida_em: new Date().toISOString(), corrigida_por_nome: (quem as string | null) ?? null })
    .eq("id", id)
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  atualizar(clienteId);
  revalidatePath("/");
  revalidatePath("/prazos");
}

/* ─────────────────────── cliente novo: situação do atendimento ─────────────────────── */

/** Situação do atendimento do cliente novo, com responsável e prazo (vazio = prazo sugerido da situação). */
export async function salvarAtendimento(clienteId: string, form: FormData) {
  const situacao = texto(form, "atendimento_situacao");
  if (situacao && !ehSituacaoAtendimento(situacao)) throw new Error("Situação inválida.");
  const supabase = await createClient();
  const { data: c } = await supabase.from("clientes").select("atendimento_situacao").eq("id", clienteId).maybeSingle();
  const mudou = (c?.atendimento_situacao ?? null) !== (situacao ?? null);
  const sugestao = situacao ? SITUACOES[situacao as SituacaoAtendimento].prazoDias : null;
  const { error } = await supabase
    .from("clientes")
    .update({
      atendimento_situacao: situacao,
      atendimento_responsavel_id: texto(form, "atendimento_responsavel_id"),
      atendimento_prazo: texto(form, "atendimento_prazo") ?? (situacao && sugestao !== null ? hojeISO(sugestao) : null),
      ...(mudou ? { atendimento_desde: situacao ? new Date().toISOString() : null } : {}),
    })
    .eq("id", clienteId);
  if (error) throw new Error(error.message);
  atualizar(clienteId);
  revalidatePath("/prazos");
  revalidatePath("/");
}
