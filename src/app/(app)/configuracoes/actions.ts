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
      // textos da proposta: em branco = não mostrar
      proposta_abertura: texto(form, "proposta_abertura") ?? "",
      proposta_incluso: texto(form, "proposta_incluso") ?? "",
      proposta_garantias: texto(form, "proposta_garantias") ?? "",
      proposta_depoimento: texto(form, "proposta_depoimento"),
      ...Object.fromEntries(
        (["msg_orcamento", "msg_agendamento", "msg_cobranca", "msg_cobranca_vencida", "msg_pos_venda"] as const)
          .map((k) => [k, texto(form, k)])
          .filter(([, val]) => val),
      ),
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** Faz uma cópia automática agora (fica junto das cópias de cada madrugada). */
export async function fazerCopiaAgora(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("copia_agora");
  if (error) return `Não foi possível fazer a cópia: ${error.message}`;
  revalidatePath("/configuracoes");
  return null;
}
