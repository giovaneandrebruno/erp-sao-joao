"use server";

import { createClient } from "@/lib/supabase/server";

export async function trocarSenha(_: string | null, form: FormData): Promise<string | null> {
  const senha = String(form.get("senha") ?? "");
  const repetir = String(form.get("repetir") ?? "");
  if (senha.length < 8) return "A nova senha precisa ter pelo menos 8 caracteres.";
  if (senha !== repetir) return "As duas senhas não são iguais.";
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return error.message.includes("different") ? "A nova senha precisa ser diferente da atual." : "Não foi possível trocar a senha. Tente de novo.";
  return "ok";
}
