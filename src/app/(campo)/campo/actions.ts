"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { hojeISO, texto } from "@/lib/format";

type Tipo = "marco" | "chamado";

async function responsavelDo(tipo: Tipo, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from(tipo === "marco" ? "pedido_marcos" : "chamados").select("responsavel_id").eq("id", id).single();
  const perfil = await perfilAtual();
  return { supabase, parceiro: perfil?.papel === "montador" ? perfil.parceiro_id : data?.responsavel_id ?? null };
}

export async function fazerCheckin(tipo: Tipo, id: string, latitude: number | null, longitude: number | null) {
  const { supabase, parceiro } = await responsavelDo(tipo, id);
  const { data, error } = await supabase
    .from("visitas")
    .insert({ [tipo === "marco" ? "marco_id" : "chamado_id"]: id, parceiro_id: parceiro, latitude, longitude })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (tipo === "chamado") await supabase.from("chamados").update({ status: "em_atendimento" }).eq("id", id);
  revalidatePath(`/campo/${tipo}/${id}`);
  return data.id as string;
}

export async function anexarFotos(tipo: Tipo, id: string, visitaId: string, caminhos: string[]) {
  const supabase = await createClient();
  const { data: v } = await supabase.from("visitas").select("fotos").eq("id", visitaId).single();
  const { error } = await supabase.from("visitas").update({ fotos: [...(v?.fotos ?? []), ...caminhos] }).eq("id", visitaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/campo/${tipo}/${id}`);
}

export async function concluirServico(tipo: Tipo, id: string, visitaId: string | null, form: FormData) {
  const supabase = await createClient();
  const obs = texto(form, "observacoes");
  if (visitaId) {
    const { error } = await supabase.from("visitas").update({ checkout_em: new Date().toISOString(), observacoes: obs }).eq("id", visitaId);
    if (error) throw new Error(error.message);
  }
  const { error } =
    tipo === "marco"
      ? await supabase.from("pedido_marcos").update({ realizado: hojeISO() }).eq("id", id)
      : await supabase.from("chamados").update({ status: "resolvido", solucao: obs }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/campo");
  redirect("/campo?ok=1");
}
