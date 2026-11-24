"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, texto } from "@/lib/format";
import { perfilAtual } from "@/lib/perfil";
import {
  CHECKLISTS, SITUACOES, ehChecklist, ehEtapa, ehSituacao, ehTipoOcorrencia, pendenciasParaAvancar,
  type Etapa, type MarcasChecklists,
} from "@/lib/processo";

export type RespostaEtapa = { erro?: string; pendencias?: string[]; ok?: boolean } | null;

const atualizar = (pedidoId: string) => {
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  revalidatePath("/prazos");
  revalidatePath("/");
};

/** Muda a etapa e/ou a situação do pedido. Para avançar, confere a pasta, a forma de pagamento e os checklists. */
export async function mudarEtapa(pedidoId: string, _antes: RespostaEtapa, form: FormData): Promise<RespostaEtapa> {
  const destino = texto(form, "etapa");
  if (!ehEtapa(destino)) return { erro: "Escolha a etapa." };
  const situacao = texto(form, "situacao");
  if (situacao && (!ehSituacao(situacao) || SITUACOES[situacao].etapa !== destino)) return { erro: "A situação escolhida não é desta etapa." };
  const motivo = texto(form, "cancelamento_motivo");
  if (destino === "cancelamento" && !situacao) return { erro: "Para cancelar, escolha o motivo (comprou em outra loja ou outro motivo)." };

  const supabase = await createClient();
  const { data: p, error: e1 } = await supabase
    .from("pedidos")
    .select("cliente_id, etapa, situacao, status, checklists, pagamento_combinado, situacao_prazo, situacao_responsavel_id")
    .eq("id", pedidoId)
    .single();
  if (e1 || !p) return { erro: "Pedido não encontrado." };

  const etapaAtual = (ehEtapa(p.etapa) ? p.etapa : "venda") as Etapa;
  const [{ data: docs }, { count: devolvidas }] = await Promise.all([
    supabase.from("cliente_documentos").select("tipo").eq("cliente_id", p.cliente_id),
    supabase.from("cliente_pasta_devolucoes").select("id", { count: "exact", head: true }).eq("cliente_id", p.cliente_id).is("corrigida_em", null),
  ]);
  const pendencias = pendenciasParaAvancar({
    etapaAtual, destino,
    documentos: new Set((docs ?? []).map((d) => d.tipo)),
    checklists: p.checklists as MarcasChecklists,
    pagamentoCombinado: p.pagamento_combinado,
    pastaDevolvida: (devolvidas ?? 0) > 0,
  });
  const passarMesmoAssim = form.get("passar_mesmo_assim") !== null && (await perfilAtual())?.papel === "admin";
  if (pendencias.length && !passarMesmoAssim) return { erro: "Ainda não dá para passar para esta etapa:", pendencias };

  const mudouEtapa = destino !== etapaAtual;
  const mudouSituacao = (situacao ?? null) !== (p.situacao ?? null);
  // prazo: o que a pessoa digitou ou, se a situação mudou, a sugestão da situação
  const sugestao = situacao && ehSituacao(situacao) ? (SITUACOES[situacao] as { prazoDias: number | null }).prazoDias : null;
  const prazo = texto(form, "situacao_prazo") ?? (mudouSituacao || mudouEtapa ? (sugestao !== null ? hojeISO(sugestao) : null) : p.situacao_prazo);

  const dados: Record<string, unknown> = {
    etapa: destino,
    situacao: situacao ?? null,
    situacao_prazo: prazo,
    situacao_responsavel_id: texto(form, "situacao_responsavel_id"),
  };
  if (mudouEtapa || mudouSituacao) dados.situacao_desde = new Date().toISOString();
  if (destino === "cancelamento") {
    dados.cancelamento_motivo = motivo;
    dados.status = "cancelado";
  } else if (destino === "concluido" && p.status !== "entregue" && p.status !== "cancelado") {
    dados.status = "entregue";
  } else if (destino === "fabricacao" && p.status === "aberto") {
    dados.status = "em_producao";
  } else if (p.status === "cancelado" && etapaAtual === "cancelamento") {
    dados.status = "aberto"; // pedido reaberto
  }

  const { error } = await supabase.from("pedidos").update(dados).eq("id", pedidoId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  if (mudouEtapa || mudouSituacao) {
    const obs = [pendencias.length ? `Passou com pendências: ${pendencias.join("; ")}` : null, destino === "cancelamento" ? motivo : null].filter(Boolean).join(" · ");
    await supabase.from("pedido_etapas_historico").insert({ pedido_id: pedidoId, etapa: destino, situacao: situacao ?? null, observacao: obs || null });
  }
  atualizar(pedidoId);
  return { ok: true };
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

