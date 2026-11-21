import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AtribuicaoOrg, FuncaoOrg, PessoaOrg } from "@/lib/organograma";

const num = (v: unknown) => Number(v) || 0;

/** Lê tudo do organograma (quadros, funções e quem faz cada uma). */
export async function lerOrganograma() {
  const supabase = await createClient();
  const [p, f, a] = await Promise.all([
    supabase.from("organograma_pessoas").select("id, nome, cargo, setor, chefe_id, horas_semana, observacoes, ordem, pos_x, pos_y, largura, altura, cor, texto"),
    supabase.from("organograma_funcoes").select("id, nome, setor, horas_semana, descricao").order("nome"),
    supabase.from("organograma_atribuicoes").select("funcao_id, pessoa_id"),
  ]);
  const pessoas: PessoaOrg[] = (p.data ?? []).map((x) => ({
    ...x, horas_semana: num(x.horas_semana), pos_x: num(x.pos_x), pos_y: num(x.pos_y), largura: num(x.largura) || 240, altura: num(x.altura) || 150,
  }));
  const funcoes: FuncaoOrg[] = (f.data ?? []).map((x) => ({ ...x, horas_semana: num(x.horas_semana) }));
  const atribuicoes: AtribuicaoOrg[] = a.data ?? [];
  return { pessoas, funcoes, atribuicoes, erro: p.error?.message ?? f.error?.message ?? a.error?.message ?? null };
}
