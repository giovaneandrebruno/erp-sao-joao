"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";

export async function salvarFornecedor(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro = {
    nome: texto(form, "nome") ?? "",
    cpf_cnpj: texto(form, "cpf_cnpj"),
    telefone: texto(form, "telefone"),
    email: texto(form, "email"),
    contato: texto(form, "contato"),
    observacoes: texto(form, "observacoes"),
  };
  const { error } = id
    ? await supabase.from("fornecedores").update(registro).eq("id", id)
    : await supabase.from("fornecedores").insert(registro);
  if (error) throw new Error(error.message);
  revalidatePath("/fornecedores");
}
