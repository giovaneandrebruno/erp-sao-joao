"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { exigirAdmin } from "@/lib/perfil";

export async function salvarPolitica(id: string | null, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const dados = { titulo: texto(form, "titulo") ?? "", texto: texto(form, "texto") };
  if (id) {
    const { error } = await supabase.from("politicas_empresa").update(dados).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: ult } = await supabase.from("politicas_empresa").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("politicas_empresa").insert({ ...dados, ordem: Number(ult?.ordem ?? 0) + 1 });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/funcionarios/politicas");
}

export async function excluirPolitica(id: string): Promise<string | null> {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("politicas_empresa").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/funcionarios/politicas");
  return null;
}
