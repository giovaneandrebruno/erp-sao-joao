"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function aceitar(token: string, _: string | null, form: FormData): Promise<string | null> {
  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 3) return "Digite o seu nome completo.";
  if (form.get("concordo") !== "on") return "Marque a caixa de concordância.";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aceitar_proposta", { p_token: token, p_nome: nome });
  if (error || !data) return "Não foi possível registrar o aceite. Fale com a gente pelo WhatsApp.";
  revalidatePath(`/p/${token}`);
  return null;
}
