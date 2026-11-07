"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

export async function salvarConfiguracoes(form: FormData) {
  const supabase = await createClient();
  const n = (c: string, padrao: number) => numero(form, c) ?? padrao;
  const { error } = await supabase
    .from("configuracoes")
    .update({
      nome_fantasia: texto(form, "nome_fantasia") ?? "São João Móveis",
      razao_social: texto(form, "razao_social"),
      cnpj: texto(form, "cnpj"),
      endereco: texto(form, "endereco"),
      cidade: texto(form, "cidade"),
      uf: texto(form, "uf"),
      telefone: texto(form, "telefone"),
      email: texto(form, "email"),
      aliquota_imposto: n("aliquota_imposto", 0),
      taxa_credito: n("taxa_credito", 0),
      taxa_debito: n("taxa_debito", 0),
      taxa_boleto: n("taxa_boleto", 0),
      comissao_vendedor_padrao: n("comissao_vendedor_padrao", 0),
      comissao_arquiteto_padrao: n("comissao_arquiteto_padrao", 0),
      markup_padrao: n("markup_padrao", 1),
      margem_minima: n("margem_minima", 0),
      validade_orcamento_dias: Math.round(n("validade_orcamento_dias", 15)),
      clausulas_contrato: texto(form, "clausulas_contrato") ?? "",
      ...Object.fromEntries(
        (["msg_orcamento", "msg_agendamento", "msg_cobranca", "msg_pos_venda"] as const)
          .map((k) => [k, texto(form, k)])
          .filter(([, val]) => val),
      ),
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
