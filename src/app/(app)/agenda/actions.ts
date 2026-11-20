"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { baixarAgenda, linkGoogleValido } from "@/lib/ics";
import { CORES_AGENDA, corValida } from "@/lib/cores-agenda";

export async function ligarGoogle(_: string | null, form: FormData): Promise<string | null> {
  const url = linkGoogleValido(String(form.get("url") ?? ""));
  if (!url) return "Esse não parece ser o endereço secreto do Google Agenda. Ele começa com https://calendar.google.com/calendar/ical/ e termina com .ics.";
  if (!(await baixarAgenda(url))) return "O Google não devolveu a agenda com esse endereço. Confira se copiou o “Endereço secreto no formato iCal” inteiro.";
  const nome = String(form.get("nome") ?? "").trim() || "Google Agenda";
  const cor = corValida(form.get("cor")) ?? CORES_AGENDA[0].cor;
  const supabase = await createClient();
  const { error } = await supabase.from("agendas_google").insert({ nome, url, cor });
  if (error) return error.message;
  revalidatePath("/agenda");
  return "ok";
}

export async function editarGoogle(form: FormData) {
  const nome = String(form.get("nome") ?? "").trim();
  const cor = corValida(form.get("cor"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("agendas_google")
    .update({ ...(nome ? { nome } : {}), ...(cor ? { cor } : {}) })
    .eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}

export async function desligarGoogle(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("agendas_google").delete().eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}
