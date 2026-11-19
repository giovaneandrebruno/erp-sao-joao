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

/**
 * Exclui o cliente só se ele ainda não tem nada no sistema
 * (orçamentos, pedidos, ordens de produção, negociações, chamados ou lançamentos).
 */
export async function excluirCliente(id: string): Promise<string | null> {
  const supabase = await createClient();
  const tabelas = ["orcamentos", "pedidos", "ordens_producao", "negociacoes", "chamados", "lancamentos"] as const;
  const usos = await Promise.all(
    tabelas.map(async (t) => (await supabase.from(t).select("id", { count: "exact", head: true }).eq("cliente_id", id)).count ?? 0),
  );
  if (usos.some((n) => n > 0)) {
    return "Este cliente já tem orçamentos, pedidos, produção, negociações ou lançamentos. Para não perder o histórico, ele não pode ser excluído.";
  }
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/clientes");
  return null;
}
