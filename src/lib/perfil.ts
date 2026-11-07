import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/acesso";

export type Perfil = { user_id: string; email: string | null; nome: string | null; papel: Papel; parceiro_id: string | null };

/** Perfil do usuário logado (uma consulta por requisição). */
export const perfilAtual = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data } = await supabase.from("perfis").select("user_id, email, nome, papel, parceiro_id").eq("user_id", uid).maybeSingle();
  return (data as Perfil | null) ?? null;
});
