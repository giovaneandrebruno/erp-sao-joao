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
  const { clienteAdmin } = await import("@/lib/supabase/admin");
  const admin = clienteAdmin();
  if (!admin) return "Falta configurar a chave secreta (SUPABASE_SECRET_KEY) no Vercel.";
  const email = texto(form, "email");
  const senha = texto(form, "senha");
  if (!email || !senha || senha.length < 8) return "Informe e-mail e uma senha com pelo menos 8 caracteres.";
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) return error.message.includes("already") ? "Já existe um usuário com esse e-mail." : error.message;
  const { error: e2 } = await admin
    .from("perfis")
    .upsert({ user_id: data.user.id, email, nome: texto(form, "nome"), papel: (texto(form, "papel") ?? "vendedor") as "vendedor", parceiro_id: texto(form, "parceiro_id") });
  if (e2) return e2.message;
  revalidatePath("/equipe");
  return "ok";
}
