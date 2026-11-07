"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";

function dados(form: FormData) {
  return {
    nome: texto(form, "nome") ?? "",
    cpf_cnpj: texto(form, "cpf_cnpj"),
    telefone: texto(form, "telefone"),
    email: texto(form, "email"),
    endereco: texto(form, "endereco"),
    cidade: texto(form, "cidade"),
    uf: texto(form, "uf"),
    cep: texto(form, "cep"),
    observacoes: texto(form, "observacoes"),
  };
}

export async function salvarCliente(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro = dados(form);
  const { data, error } = id
    ? await supabase.from("clientes").update(registro).eq("id", id).select("id").single()
    : await supabase.from("clientes").insert(registro).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}
