"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, numero, texto } from "@/lib/format";

function atualizar(pedidoId: string) {
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/estoque");
  revalidatePath("/compras");
  revalidatePath("/producao");
  revalidatePath("/estoque/reservas");
}

// ───────────────────────── materiais do pedido ─────────────────────────

export async function adicionarMaterial(pedidoId: string, form: FormData) {
  const produtoId = texto(form, "produto_id");
  const quantidade = numero(form, "quantidade") ?? 0;
  if (!produtoId || quantidade <= 0) throw new Error("Escolha o material e a quantidade.");
  const supabase = await createClient();
  const { error } = await supabase.from("pedido_materiais").insert({
    pedido_id: pedidoId,
    produto_id: produtoId,
    quantidade,
    observacoes: texto(form, "observacoes"),
  });
  if (error) throw new Error(error.message);
  atualizar(pedidoId);
}

/** Tira da lista só o material que ainda não saiu do estoque. */
export async function removerMaterial(pedidoId: string, id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pedido_materiais").delete().eq("id", id).eq("pedido_id", pedidoId).eq("baixado", false).select("id");
  if (error) return `Não foi possível tirar: ${error.message}`;
  if (!data?.length) return "Este material já saiu do estoque. Para corrigir, faça um ajuste na tela do produto, em Estoque.";
  atualizar(pedidoId);
  return null;
}

export type MaterialImportado = { produto_id: string; quantidade: number; observacoes?: string | null };

/** Grava de uma vez os materiais lidos da planilha .xlsx. */
export async function importarMateriais(pedidoId: string, linhas: MaterialImportado[]): Promise<string | null> {
  const validas = linhas
    .filter((l) => l.produto_id && Number(l.quantidade) > 0)
    .slice(0, 500)
    .map((l) => ({ pedido_id: pedidoId, produto_id: l.produto_id, quantidade: Number(l.quantidade), observacoes: l.observacoes ?? "Da planilha" }));
  if (!validas.length) return "Nenhum material da planilha foi reconhecido.";
  const supabase = await createClient();
  const { error } = await supabase.from("pedido_materiais").insert(validas);
  if (error) return `Não foi possível gravar: ${error.message}`;
  atualizar(pedidoId);
  return null;
}

// ───────────────────────── entrega e montagem ─────────────────────────

export async function salvarEntrega(pedidoId: string, form: FormData) {
  const marcados: Record<string, boolean> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("item:") && v) marcados[k.slice(5)] = true;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({
      checklist_entrega: marcados,
      entrega_recebido_por: texto(form, "entrega_recebido_por"),
      entrega_observacoes: texto(form, "entrega_observacoes"),
    })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedidoId}`);
}

/** Guarda no pedido os caminhos das fotos já enviadas para o Storage. */
export async function anexarFotosEntrega(pedidoId: string, caminhos: string[]): Promise<string | null> {
  const proprios = caminhos.filter((c) => c.startsWith(`entrega/${pedidoId}/`));
  if (!proprios.length) return null;
  const supabase = await createClient();
  const { data: p } = await supabase.from("pedidos").select("entrega_fotos").eq("id", pedidoId).single();
  const { error } = await supabase
    .from("pedidos")
    .update({ entrega_fotos: [...(p?.entrega_fotos ?? []), ...proprios] })
    .eq("id", pedidoId);
  if (error) return `Não foi possível guardar as fotos: ${error.message}`;
  revalidatePath(`/pedidos/${pedidoId}`);
  return null;
}

// ───────────────────────── pesquisa de satisfação ─────────────────────────

export async function salvarSatisfacao(pedidoId: string, form: FormData) {
  const nota = numero(form, "satisfacao_nota");
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({
      satisfacao_nota: nota === null ? null : Math.min(10, Math.max(0, Math.round(nota))),
      satisfacao_comentario: texto(form, "satisfacao_comentario"),
      satisfacao_em: nota === null ? null : hojeISO(),
    })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/relatorios");
}
