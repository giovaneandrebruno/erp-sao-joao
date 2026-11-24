"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

/** Tipo (garantia ou mau uso), de quem depende, taxa de visita e diárias (mínimo 1 no mau uso). */
function camposDoTipo(form: FormData) {
  const tipo = texto(form, "tipo") === "mau_uso" ? "mau_uso" : "garantia";
  const depende = texto(form, "depende_de");
  const pos = (c: string) => { const v = numero(form, c); return v === null ? null : Math.max(0, v); };
  const diarias = pos("diarias");
  return {
    tipo,
    em_garantia: tipo === "garantia",
    depende_de: depende === "loja" || depende === "fabrica" ? depende : null,
    taxa_visita: pos("taxa_visita"),
    diarias: tipo === "mau_uso" ? Math.max(1, diarias ?? 1) : diarias === null ? null : Math.max(1, diarias),
    valor_diaria: pos("valor_diaria"),
  };
}

type Status = "aberto" | "agendado" | "em_atendimento" | "resolvido";

export async function abrirChamado(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("chamados").insert({
    cliente_id: texto(form, "cliente_id"),
    pedido_id: texto(form, "pedido_id"),
    descricao: texto(form, "descricao") ?? "",
    prioridade: texto(form, "prioridade") ?? "normal",
    ...camposDoTipo(form),
    data_agendada: texto(form, "data_agendada"),
    responsavel_id: texto(form, "responsavel_id"),
    status: texto(form, "data_agendada") ? "agendado" : "aberto",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/assistencia");
}

export async function atualizarChamado(id: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("chamados")
    .update({
      status: (texto(form, "status") ?? "aberto") as Status,
      data_agendada: texto(form, "data_agendada"),
      responsavel_id: texto(form, "responsavel_id"),
      solucao: texto(form, "solucao"),
      ...camposDoTipo(form),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/assistencia");
}
