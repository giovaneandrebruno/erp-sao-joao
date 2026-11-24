import { createClient } from "@/lib/supabase/server";

/** Nomes para sugerir como responsável: usuários do sistema e funcionários ativos. */
export async function nomesDaEquipe() {
  const supabase = await createClient();
  const [{ data: perfis }, { data: funcs }] = await Promise.all([
    supabase.from("perfis").select("nome").not("nome", "is", null),
    supabase.from("funcionarios").select("nome, apelido").neq("situacao", "desligado"),
  ]);
  const primeiro = (n: string) => n.trim().split(/\s+/)[0];
  return [
    ...(perfis ?? []).map((p) => primeiro(p.nome as string)),
    ...(funcs ?? []).map((f) => f.apelido || primeiro(f.nome)),
  ].filter(Boolean);
}
