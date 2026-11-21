"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/perfil";

/** Desliga o Instagram e o Facebook do sistema (apaga a chave guardada). */
export async function desligarRedes() {
  await exigirAdmin();
  const supabase = await createClient();
  await supabase.from("redes_conexao").delete().eq("id", 1);
  revalidatePath("/redes");
}

/** Guarda que a pessoa abriu uma tela do sistema (para a aba Uso do site). */
export async function registrarAcesso(caminho: string) {
  if (typeof caminho !== "string" || !caminho.startsWith("/") || caminho.length > 300) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return;
  await supabase.from("acessos_sistema").insert({ caminho });
}
