"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { CHECKLISTS, MOTIVOS_CANCELAMENTO, ehChecklist, ehTipoOcorrencia, type MarcasChecklists } from "@/lib/processo";
import { definirStatus } from "../producao/actions";

const atualizar = (pedidoId: string) => {
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  revalidatePath("/prazos");
  revalidatePath("/");
};

/** Muda a etapa SCRUM de uma OS do pedido (a mesma do quadro da Produção). */
export async function mudarEtapaScrum(pedidoId: string, ordemId: string, form: FormData) {
  const supabase = await createClient();
  const { data: op } = await supabase.from("ordens_producao").select("id").eq("id", ordemId).eq("pedido_id", pedidoId).maybeSingle();
  if (!op) throw new Error("Ordem de serviço não encontrada neste pedido.");
  const r = await definirStatus(ordemId, texto(form, "status_pcp") ?? "");
  if (!r.ok) throw new Error(r.erro);
  atualizar(pedidoId);
}

/** Motivo do cancelamento: comprou em outra loja ou outro motivo, com o detalhe. */
export async function salvarMotivoCancelamento(pedidoId: string, form: FormData) {
  const chave = texto(form, "motivo");
  const motivo = chave && Object.hasOwn(MOTIVOS_CANCELAMENTO, chave) ? MOTIVOS_CANCELAMENTO[chave as keyof typeof MOTIVOS_CANCELAMENTO] : null;
  if (!motivo) throw new Error("Escolha o motivo.");
  const detalhe = texto(form, "detalhe");
  const supabase = await createClient();
  const { error } = await supabase.from("pedidos").update({ cancelamento_motivo: detalhe ? `${motivo}: ${detalhe}` : motivo }).eq("id", pedidoId);
  if (error) throw new Error(error.message);
  atualizar(pedidoId);
}

/** Marca os itens de um dos 3 checklists. */
export async function salvarChecklist(pedidoId: string, chave: string, form: FormData) {
  if (!ehChecklist(chave)) throw new Error("Checklist desconhecido.");
  const supabase = await createClient();
  const { data: p } = await supabase.from("pedidos").select("checklists").eq("id", pedidoId).single();
  const marcados: Record<string, boolean> = {};
  for (const item of CHECKLISTS[chave].itens) if (form.get(`item:${item}`)) marcados[item] = true;
  const { error } = await supabase
    .from("pedidos")
    .update({ checklists: { ...((p?.checklists as MarcasChecklists) ?? {}), [chave]: marcados } })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedidoId}`);
}

/** Datas limite: DLP (cliente assinar o executivo) e DLE (data limite de entrega). */
export async function salvarDatasLimite(pedidoId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ data_limite_assinatura: texto(form, "data_limite_assinatura"), data_limite_entrega: texto(form, "data_limite_entrega") })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);
  atualizar(pedidoId);
}

/** Como o pagamento foi combinado com o cliente quando a venda fechou. */
export async function salvarPagamentoCombinado(pedidoId: string, form: FormData) {
  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("pedidos")
    .update({ pagamento_combinado: texto(form, "pagamento_combinado") })
    .eq("id", pedidoId)
    .select("cliente_id")
    .single();
  if (error) throw new Error(error.message);
  atualizar(pedidoId);
  if (p?.cliente_id) revalidatePath(`/clientes/${p.cliente_id}`);
}

/* ───────────────────────── ocorrências da montagem ───────────────────────── */

export async function registrarOcorrencia(
  pedidoId: string,
  dados: { tipo: string; ambiente: string | null; descricao: string; fotos: string[] },
): Promise<string | null> {
  if (!ehTipoOcorrencia(dados.tipo)) return "Escolha o tipo da ocorrência.";
  if (!dados.descricao.trim()) return "Descreva o que aconteceu.";
  const fotos = dados.fotos.filter((c) => c.startsWith(`ocorrencias/${pedidoId}/`));
  const supabase = await createClient();
  const { error } = await supabase.from("pedido_ocorrencias").insert({
    pedido_id: pedidoId, tipo: dados.tipo, ambiente: dados.ambiente?.trim() || null, descricao: dados.descricao.trim(), fotos,
  });
  if (error) return `Não foi possível salvar: ${error.message}`;
  revalidatePath(`/pedidos/${pedidoId}`);
  return null;
}

export async function resolverOcorrencia(pedidoId: string, id: string, resolvida: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("pedido_ocorrencias").update({ resolvida_em: resolvida ? new Date().toISOString() : null }).eq("id", id).eq("pedido_id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedidoId}`);
}

/** Abre um chamado de assistência a partir da ocorrência (peça com defeito vai para a fábrica). */
export async function abrirAssistenciaDaOcorrencia(pedidoId: string, id: string) {
  const supabase = await createClient();
  const [{ data: o }, { data: p }] = await Promise.all([
    supabase.from("pedido_ocorrencias").select("tipo, ambiente, descricao, chamado_id").eq("id", id).eq("pedido_id", pedidoId).single(),
    supabase.from("pedidos").select("cliente_id").eq("id", pedidoId).single(),
  ]);
  if (!o || !p || o.chamado_id) return;
  const daFabrica = ["embalagem_avariada", "peca_defeito", "peca_faltando"].includes(o.tipo);
  const { data: ch, error } = await supabase
    .from("chamados")
    .insert({
      cliente_id: p.cliente_id,
      pedido_id: pedidoId,
      descricao: `${o.ambiente ? `${o.ambiente}: ` : ""}${o.descricao} (ocorrência da montagem)`,
      prioridade: "normal",
      tipo: "garantia",
      em_garantia: true,
      depende_de: daFabrica ? "fabrica" : "loja",
      status: "aberto",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("pedido_ocorrencias").update({ chamado_id: ch.id }).eq("id", id);
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/assistencia");
}

export async function excluirOcorrencia(pedidoId: string, id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: o } = await supabase.from("pedido_ocorrencias").select("fotos").eq("id", id).eq("pedido_id", pedidoId).maybeSingle();
  if (!o) return "Ocorrência não encontrada.";
  const { error } = await supabase.from("pedido_ocorrencias").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath(`/pedidos/${pedidoId}`);
  return null;
}
