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

/** Exclui o fornecedor. Compras e contas ligadas a ele ficam, só sem o fornecedor. */
export async function excluirFornecedor(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/fornecedores");
  return null;
}
