"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { exigirAdmin, perfilAtual } from "@/lib/perfil";

const nota = (form: FormData, campo: string) => {
  const n = Math.round(Number(form.get(campo)));
  return n >= 1 && n <= 5 ? n : 3;
};

/** Qualquer pessoa do escritório sugere uma melhoria. */
export async function sugerirMelhoria(form: FormData) {
  const perfil = await perfilAtual();
  const supabase = await createClient();
  const { error } = await supabase.from("melhorias").insert({
    titulo: texto(form, "titulo") ?? "",
    descricao: texto(form, "descricao"),
    area: texto(form, "area"),
    resultado: nota(form, "resultado"),
    esforco: nota(form, "esforco"),
    sugerido_por: perfil?.nome ?? perfil?.email ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/melhorias");
}

/** Só o administrador muda a situação e as notas. */
export async function alterarMelhoria(id: string, form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const situacao = String(form.get("situacao"));
  const { error } = await supabase
    .from("melhorias")
    .update({
      titulo: texto(form, "titulo") ?? "",
      descricao: texto(form, "descricao"),
      area: texto(form, "area"),
      resultado: nota(form, "resultado"),
      esforco: nota(form, "esforco"),
      situacao: ["ideia", "fazendo", "feito", "descartado"].includes(situacao) ? situacao : "ideia",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/melhorias");
}
