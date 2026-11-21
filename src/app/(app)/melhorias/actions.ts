"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { exigirAdmin, perfilAtual } from "@/lib/perfil";

/** Qualquer pessoa do escritório anota uma melhoria (nome e data entram sozinhos). */
export async function sugerirMelhoria(form: FormData) {
  const perfil = await perfilAtual();
  const supabase = await createClient();
  const { error } = await supabase.from("melhorias").insert({
    titulo: texto(form, "titulo") ?? "",
    descricao: texto(form, "descricao"),
    sugerido_por: perfil?.nome ?? perfil?.email ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/melhorias");
}

/** Só o administrador altera a anotação e muda a situação. */
export async function alterarMelhoria(id: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const situacao = String(form.get("situacao"));
  const { error } = await supabase
    .from("melhorias")
    .update({
      titulo: texto(form, "titulo") ?? "",
      descricao: texto(form, "descricao"),
      situacao: ["ideia", "fazendo", "feito", "descartado"].includes(situacao) ? situacao : "ideia",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/melhorias");
}
