"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

function dadosParceiro(form: FormData) {
  return {
    nome: texto(form, "nome") ?? "",
    tipo: (texto(form, "tipo") ?? "vendedor") as "vendedor" | "arquiteto" | "montador",
    telefone: texto(form, "telefone"),
    email: texto(form, "email"),
    chave_pix: texto(form, "chave_pix"),
    comissao_padrao: numero(form, "comissao_padrao"),
  };
}

export async function criarParceiro(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("parceiros").insert(dadosParceiro(form));
  if (error) throw new Error(error.message);
  revalidatePath("/equipe");
}

export async function atualizarParceiro(id: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("parceiros").update(dadosParceiro(form)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipe");
}

/**
 * Exclui a pessoa só se ela nunca foi usada no sistema.
 * Quem já tem orçamentos, pedidos, comissões ou serviços fica, para não perder o histórico: aí o caminho é desativar.
 */
export async function excluirParceiro(id: string): Promise<string | null> {
  const supabase = await createClient();
  const conta = async (tabela: "orcamentos" | "pedidos" | "negociacoes", coluna: "vendedor_id" | "arquiteto_id") =>
    (await supabase.from(tabela).select("id", { count: "exact", head: true }).eq(coluna, id)).count ?? 0;
  const usos = await Promise.all([
    conta("orcamentos", "vendedor_id"), conta("orcamentos", "arquiteto_id"),
    conta("pedidos", "vendedor_id"), conta("pedidos", "arquiteto_id"),
    conta("negociacoes", "vendedor_id"), conta("negociacoes", "arquiteto_id"),
    supabase.from("pedido_marcos").select("id", { count: "exact", head: true }).eq("responsavel_id", id).then((r) => r.count ?? 0),
    supabase.from("chamados").select("id", { count: "exact", head: true }).eq("responsavel_id", id).then((r) => r.count ?? 0),
    supabase.from("perfis").select("user_id", { count: "exact", head: true }).eq("parceiro_id", id).then((r) => r.count ?? 0),
  ]);
  if (usos.some((n) => n > 0)) return "Esta pessoa já aparece em orçamentos, pedidos, serviços ou num usuário do sistema. Para não perder o histórico, use \"desativar\".";
  const { error } = await supabase.from("parceiros").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/equipe");
  return null;
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("parceiros").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipe");
}

async function exigirAdmin() {
  const { perfilAtual } = await import("@/lib/perfil");
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") throw new Error("Só o administrador pode alterar acessos.");
  return perfil;
}

export async function atualizarPerfil(userId: string, form: FormData) {
  const eu = await exigirAdmin();
  const papel = (texto(form, "papel") ?? "vendedor") as "admin" | "vendedor" | "montador";
  if (userId === eu.user_id && papel !== "admin") throw new Error("Você não pode tirar o seu próprio acesso de administrador.");
  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ papel, nome: texto(form, "nome"), parceiro_id: texto(form, "parceiro_id") }).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/equipe");
}

export async function criarUsuario(_: string | null, form: FormData): Promise<string | null> {
  await exigirAdmin();
  const email = texto(form, "email");
  const senha = texto(form, "senha");
  if (!email || !senha || senha.length < 8) return "Informe e-mail e uma senha com pelo menos 8 caracteres.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_criar_usuario", {
    p_email: email,
    p_senha: senha,
    p_nome: texto(form, "nome") ?? "",
    p_papel: (texto(form, "papel") ?? "vendedor") as "vendedor",
    p_parceiro: texto(form, "parceiro_id") ?? undefined,
  });
  if (error) return error.message;
  revalidatePath("/equipe");
  return "ok";
}
