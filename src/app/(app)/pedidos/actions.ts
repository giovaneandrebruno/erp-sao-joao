"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto, hojeISO } from "@/lib/format";

type StatusPedido = "aberto" | "em_producao" | "pronto" | "entregue" | "cancelado";

export async function mudarStatusPedido(id: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ status: texto(form, "status") as StatusPedido, data_entrega_prevista: texto(form, "data_entrega_prevista") })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
}

export async function criarOrdem(pedidoId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("ordens_producao").insert({
    pedido_id: pedidoId,
    descricao: texto(form, "descricao") ?? "Produção do pedido",
    responsavel: texto(form, "responsavel"),
    prazo: texto(form, "prazo"),
  });
  if (error) throw new Error(error.message);
  await supabase.from("pedidos").update({ status: "em_producao" }).eq("id", pedidoId).eq("status", "aberto");
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/producao");
}

/** Gera as parcelas a receber do pedido: entrada + N parcelas mensais. */
export async function gerarParcelas(pedidoId: string, form: FormData) {
  const supabase = await createClient();
  const { data: p, error: e1 } = await supabase.from("pedidos_resumo").select("numero, cliente_id, unidade, total").eq("id", pedidoId).single();
  if (e1) throw new Error(e1.message);

  const { data: existentes } = await supabase.from("lancamentos").select("valor").eq("pedido_id", pedidoId).eq("tipo", "receber");
  const jaLancado = existentes?.reduce((soma, l) => soma + Number(l.valor), 0) ?? 0;
  const total = Math.round((Number(p.total) - jaLancado) * 100) / 100;
  if (total <= 0) return;
  const entrada = Math.min(numero(form, "entrada") ?? 0, total);
  const qtd = Math.max(0, Math.floor(numero(form, "parcelas") ?? 0));
  const primeiro = texto(form, "primeiro_vencimento") ?? hojeISO();
  const forma = texto(form, "forma_pagamento");

  const base = { tipo: "receber" as const, unidade: p.unidade, cliente_id: p.cliente_id, pedido_id: pedidoId, categoria: "Venda", forma_pagamento: forma };
  const linhas = [];
  if (entrada > 0) {
    linhas.push({ ...base, descricao: `Pedido #${p.numero} — entrada`, valor: entrada, vencimento: hojeISO() });
  }
  const restante = Math.round((total - entrada) * 100);
  if (qtd > 0 && restante > 0) {
    const parcela = Math.floor(restante / qtd);
    for (let i = 0; i < qtd; i++) {
      const centavos = i === qtd - 1 ? restante - parcela * (qtd - 1) : parcela;
      const venc = new Date(`${primeiro}T12:00:00`);
      venc.setMonth(venc.getMonth() + i);
      linhas.push({ ...base, descricao: `Pedido #${p.numero} — parcela ${i + 1}/${qtd}`, valor: centavos / 100, vencimento: venc.toISOString().slice(0, 10) });
    }
  }
  if (!linhas.length) return;
  const { error } = await supabase.from("lancamentos").insert(linhas);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/financeiro");
}

export async function atualizarMarco(pedidoId: string, marcoId: string, form: FormData) {
  const supabase = await createClient();
  const concluir = form.get("concluir") !== null;
  const { error } = await supabase
    .from("pedido_marcos")
    .update({
      previsto: texto(form, "previsto"),
      realizado: concluir ? hojeISO() : texto(form, "realizado"),
      responsavel_id: texto(form, "responsavel_id"),
    })
    .eq("id", marcoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/prazos");
}

/** Lança no financeiro, a pagar, a comissão do vendedor e a RT do arquiteto do pedido. */
export async function lancarComissoes(pedidoId: string) {
  const supabase = await createClient();
  const { data: p, error: e1 } = await supabase
    .from("pedidos_resumo")
    .select("numero, unidade, comissoes_lancadas, vendedor_id, arquiteto_id, valor_comissao_vendedor, valor_comissao_arquiteto")
    .eq("id", pedidoId)
    .single();
  if (e1) throw new Error(e1.message);
  if (p.comissoes_lancadas) return;

  const ids = [p.vendedor_id, p.arquiteto_id].filter(Boolean) as string[];
  const { data: pessoas } = ids.length ? await supabase.from("parceiros").select("id, nome").in("id", ids) : { data: [] };
  const nome = (id: string | null) => pessoas?.find((x) => x.id === id)?.nome ?? "";
  const venc = new Date();
  venc.setDate(venc.getDate() + 30);
  const vencimento = venc.toISOString().slice(0, 10);

  const linhas = [];
  if (p.vendedor_id && Number(p.valor_comissao_vendedor) > 0) {
    linhas.push({ tipo: "pagar" as const, unidade: p.unidade, categoria: "Comissão", pedido_id: pedidoId, vencimento, valor: Number(p.valor_comissao_vendedor), descricao: `Comissão ${nome(p.vendedor_id)} — pedido #${p.numero}` });
  }
  if (p.arquiteto_id && Number(p.valor_comissao_arquiteto) > 0) {
    linhas.push({ tipo: "pagar" as const, unidade: p.unidade, categoria: "Comissão", pedido_id: pedidoId, vencimento, valor: Number(p.valor_comissao_arquiteto), descricao: `RT ${nome(p.arquiteto_id)} — pedido #${p.numero}` });
  }
  if (linhas.length) {
    const { error } = await supabase.from("lancamentos").insert(linhas);
    if (error) throw new Error(error.message);
  }
  await supabase.from("pedidos").update({ comissoes_lancadas: true }).eq("id", pedidoId);
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/comissoes");
  revalidatePath("/financeiro");
}
