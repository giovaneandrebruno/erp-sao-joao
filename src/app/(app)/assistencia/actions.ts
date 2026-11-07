"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";

type Status = "aberto" | "agendado" | "em_atendimento" | "resolvido";

export async function abrirChamado(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("chamados").insert({
    cliente_id: texto(form, "cliente_id"),
    pedido_id: texto(form, "pedido_id"),
    descricao: texto(form, "descricao") ?? "",
    prioridade: texto(form, "prioridade") ?? "normal",
    em_garantia: form.get("em_garantia") !== null,
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
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/assistencia");
}
