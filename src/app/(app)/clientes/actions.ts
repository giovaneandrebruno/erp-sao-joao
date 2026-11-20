"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import {
  SITUACOES, digitos, erroDocumento, erroEmail, formatarCEP, formatarDocumento, formatarTelefone, type Situacao,
} from "@/lib/cliente";

function dados(form: FormData) {
  const situacao = texto(form, "situacao");
  const tipo = texto(form, "tipo_pessoa");
  const uf = texto(form, "uf");
  return {
    nome: texto(form, "nome") ?? "",
    situacao: (situacao && Object.hasOwn(SITUACOES, situacao) ? situacao : "lead") as Situacao,
    tipo_pessoa: tipo === "juridica" ? "juridica" : "fisica",
    nome_fantasia: texto(form, "nome_fantasia"),
    cpf_cnpj: texto(form, "cpf_cnpj") ? formatarDocumento(texto(form, "cpf_cnpj")) : null,
    rg: texto(form, "rg"),
    inscricao_estadual: texto(form, "inscricao_estadual"),
    data_nascimento: texto(form, "data_nascimento"),
    estado_civil: texto(form, "estado_civil"),
    profissao: texto(form, "profissao"),
    contato_nome: texto(form, "contato_nome"),
    telefone: texto(form, "telefone") ? formatarTelefone(texto(form, "telefone")) : null,
    telefone2: texto(form, "telefone2") ? formatarTelefone(texto(form, "telefone2")) : null,
    email: texto(form, "email")?.toLowerCase() ?? null,
    cep: texto(form, "cep") ? formatarCEP(texto(form, "cep")) : null,
    endereco: texto(form, "endereco"),
    numero: texto(form, "numero"),
    complemento: texto(form, "complemento"),
    bairro: texto(form, "bairro"),
    cidade: texto(form, "cidade"),
    uf: uf ? uf.toUpperCase().slice(0, 2) : null,
    endereco_obra: texto(form, "endereco_obra"),
    origem: texto(form, "origem"),
    indicado_por: texto(form, "indicado_por"),
    vendedor_id: texto(form, "vendedor_id"),
    arquiteto_id: texto(form, "arquiteto_id"),
    observacoes: texto(form, "observacoes"),
  };
}

/** Nome de outro cliente que já usa este CPF/CNPJ, ou null. */
export async function documentoEmUso(documento: string, ignorarId: string | null): Promise<string | null> {
  const d = digitos(documento);
  if (d.length !== 11 && d.length !== 14) return null;
  const supabase = await createClient();
  // procura escrito com ou sem pontos
  let consulta = supabase.from("clientes").select("id, nome").or(`cpf_cnpj.eq."${d}",cpf_cnpj.eq."${formatarDocumento(d)}"`).limit(1);
  if (ignorarId) consulta = consulta.neq("id", ignorarId);
  const { data } = await consulta;
  return data?.[0]?.nome ?? null;
}

export async function salvarCliente(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro = dados(form);
  if (!registro.nome) throw new Error("Informe o nome do cliente.");
  const erro = erroDocumento(registro.cpf_cnpj) ?? erroEmail(registro.email);
  if (erro) throw new Error(erro);
  if (registro.cpf_cnpj) {
    const outro = await documentoEmUso(registro.cpf_cnpj, id);
    if (outro) throw new Error(`Este CPF/CNPJ já está no cadastro de ${outro}.`);
  }
  const { data, error } = id
    ? await supabase.from("clientes").update(registro).eq("id", id).select("id").single()
    : await supabase.from("clientes").insert(registro).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${data.id}`);
  // alterado na janela da lista: continua na lista
  if (texto(form, "ficar_na_lista")) return;
  redirect(`/clientes/${data.id}`);
}

/** Muda só a situação (lead, cliente, inativo), pelo botão na ficha do cliente. */
export async function mudarSituacao(id: string, situacao: Situacao) {
  if (!Object.hasOwn(SITUACOES, situacao)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ situacao }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

/**
 * Exclui o cliente só se ele ainda não tem nada no sistema
 * (orçamentos, pedidos, ordens de produção, negociações, chamados ou lançamentos).
 */
export async function excluirCliente(id: string): Promise<string | null> {
  const supabase = await createClient();
  // conferido no banco, que enxerga tudo (até o que o vendedor não vê no financeiro)
  const { data: temHistorico, error: erroConferir } = await supabase.rpc("cliente_tem_historico", { p_cliente: id });
  if (erroConferir) return `Não foi possível conferir o cliente: ${erroConferir.message}`;
  if (temHistorico !== false) {
    return "Este cliente já tem orçamentos, pedidos, produção, negociações ou lançamentos. Para não perder o histórico, ele não pode ser excluído.";
  }
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/clientes");
  return null;
}
