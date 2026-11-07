"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function entrar(_: string | null, form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("senha") ?? ""),
  });
  if (error) return "E-mail ou senha incorretos.";
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("user_id", data.user.id).maybeSingle();
  redirect(perfil?.papel === "montador" ? "/campo" : "/");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
