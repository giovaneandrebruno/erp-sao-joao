"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { CAMPOS, SIGLAS, somarDias, vizinho, type SiglaStatus } from "@/lib/pcp";

async function depoisDeMudar(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  // Quando todas as OS do pedido ficam prontas, o pedido passa para "pronto".
  const { data: op } = await supabase.from("ordens_producao").select("pedido_id").eq("id", id).maybeSingle();
  if (op?.pedido_id) {
    const { data: ops } = await supabase.from("ordens_producao").select("status_pcp").eq("pedido_id", op.pedido_id);
    if (ops?.length && ops.every((o) => ["EM", "CL", "FIN"].includes(o.status_pcp))) {
      await supabase.from("pedidos").update({ status: "pronto" }).eq("id", op.pedido_id).eq("status", "em_producao");
    }
    revalidatePath(`/pedidos/${op.pedido_id}`);
  }
  revalidatePath("/producao");
  revalidatePath(`/producao/${id}`);
}

/** Setas do quadro: avança ou volta uma etapa na sequência da legenda. */
export async function moverStatus(id: string, direcao: 1 | -1) {
  const supabase = await createClient();
  const { data: op, error: e1 } = await supabase.from("ordens_producao").select("status_pcp").eq("id", id).single();
  if (e1) throw new Error(e1.message);
  const novo = vizinho(op.status_pcp, direcao);
  if (!novo) return;
  const posicao = novo === "FIN" ? "FINALIZADO" : undefined;
  const { error } = await supabase.from("ordens_producao").update({ status_pcp: novo, ...(posicao ? { posicao } : {}) }).eq("id", id);
  if (error) throw new Error(error.message);
  await depoisDeMudar(supabase, id);
}

/** Troca rápida de STATUS e POSIÇÃO, com uma anotação opcional no histórico. */
export async function mudarStatus(id: string, form: FormData) {
  const supabase = await createClient();
  const status = texto(form, "status_pcp") as SiglaStatus | null;
  if (!status || !SIGLAS.includes(status)) throw new Error("Status inválido");
  const posicao = texto(form, "posicao");
  const { error } = await supabase.from("ordens_producao").update({ status_pcp: status, posicao }).eq("id", id);
  if (error) throw new Error(error.message);
  const nota = texto(form, "nota");
  if (nota) await supabase.from("producao_historico").insert({ ordem_id: id, status_para: status, posicao, nota });
  await depoisDeMudar(supabase, id);
}

export async function anotar(id: string, form: FormData) {
  const nota = texto(form, "nota");
  if (!nota) return;
  const supabase = await createClient();
  const { error } = await supabase.from("producao_historico").insert({ ordem_id: id, nota });
  if (error) throw new Error(error.message);
  revalidatePath(`/producao/${id}`);
}

/** Cria ou edita a OS com todas as colunas da planilha. */
export async function salvarOrdem(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro: Record<string, string | number | null> = {};
  for (const c of CAMPOS) {
    if (c.chave === "data_venda") continue;
    registro[c.chave] = texto(form, c.chave);
  }
  registro.status_pcp = SIGLAS.includes(registro.status_pcp as SiglaStatus) ? registro.status_pcp : "VR";
  registro.data_venda = texto(form, "data_venda");
  registro.data_venda_obs = texto(form, "data_venda_obs");
  const dias = Number(texto(form, "prazo_dias") ?? "");
  registro.prazo_dias = Number.isFinite(dias) && dias > 0 ? Math.round(dias) : null;
  registro.prazo_limite = texto(form, "prazo_limite");
  if (!registro.prazo_texto && registro.prazo_dias) registro.prazo_texto = `${registro.prazo_dias} DIAS`;
  // "prazo" alimenta as análises e a tela de prazos: é a mesma entrega limite da planilha.
  registro.prazo = (registro.prazo_limite as string | null) ?? (registro.data_venda && registro.prazo_dias ? somarDias(String(registro.data_venda), Number(registro.prazo_dias)) : null);
  registro.ambiente = texto(form, "ambiente");
  registro.cliente_id = texto(form, "cliente_id");
  registro.responsavel = (registro.resp_fabricacao && registro.resp_fabricacao !== "-" ? registro.resp_fabricacao : registro.resp_detalhamento) ?? null;

  if (registro.cliente_id && !registro.cliente_nome) {
    const { data: c } = await supabase.from("clientes").select("nome").eq("id", registro.cliente_id).maybeSingle();
    registro.cliente_nome = c?.nome ?? null;
  }
  registro.descricao = [registro.cliente_nome, registro.ambiente && !String(registro.cliente_nome ?? "").includes(String(registro.ambiente)) ? registro.ambiente : null]
    .filter(Boolean)
    .join(" · ") || "Ordem de serviço";

  const { data: salvo, error } = id
    ? await supabase.from("ordens_producao").update(registro).eq("id", id).select("id").single()
    : await supabase.from("ordens_producao").insert(registro).select("id").single();
  if (error) throw new Error(error.message);
  await depoisDeMudar(supabase, salvo.id);
  if (registro.cliente_id) revalidatePath(`/clientes/${registro.cliente_id}`);
  redirect(`/producao/${salvo.id}`);
}
