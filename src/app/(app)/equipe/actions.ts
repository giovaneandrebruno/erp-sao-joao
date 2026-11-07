"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

export async function criarParceiro(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("parceiros").insert({
    nome: texto(form, "nome") ?? "",
    tipo: (texto(form, "tipo") ?? "vendedor") as "vendedor" | "arquiteto" | "montador",
    telefone: texto(form, "telefone"),
    email: texto(form, "email"),
    chave_pix: texto(form, "chave_pix"),
    comissao_padrao: numero(form, "comissao_padrao"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/equipe");
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("parceiros").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipe");
}
