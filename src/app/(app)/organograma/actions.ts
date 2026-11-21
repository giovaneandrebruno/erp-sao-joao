"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";
import { CORES_QUADRO, abaixoDe, lerFuncaoNova, type PessoaOrg } from "@/lib/organograma";

type Resposta<T = null> = { ok: true; dado: T } | { ok: false; erro: string };

const COLUNAS = "id, nome, cargo, setor, chefe_id, horas_semana, observacoes, ordem, pos_x, pos_y, largura, altura, cor, texto";
const limitar = (n: unknown, min: number, max: number) => Math.min(Math.max(Number(n) || 0, min), max);
// As ações da tela quadriculada não recarregam a tela: ela já mostra a mudança na hora.
const atualizarTelas = () => revalidatePath("/organograma", "layout");

/** Confere se a pessoa pode responder ao novo chefe (não pode ser ela mesma nem alguém abaixo dela). */
async function chefeValido(supabase: Awaited<ReturnType<typeof createClient>>, id: string, chefe: string | null) {
  if (!chefe) return null;
  if (chefe === id) return "Um quadro não pode responder a ele mesmo.";
  const { data } = await supabase.from("organograma_pessoas").select("id, chefe_id");
  if (!data?.some((p) => p.id === chefe)) return "Esse quadro não existe mais.";
  if (abaixoDe(id, data).has(chefe)) return "Não dá: esse quadro está abaixo dele no organograma.";
  return null;
}

/* ───────────────────────── quadros (pessoas e vagas) ───────────────────────── */

/** Cria um quadro novo na posição indicada (pode já nascer abaixo de outro). */
export async function criarQuadro(pos: { x: number; y: number }, chefe: string | null = null, cor = "branco"): Promise<Resposta<PessoaOrg>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organograma_pessoas")
    .insert({
      cargo: "Novo cargo",
      chefe_id: chefe,
      pos_x: Math.round(limitar(pos.x, -100000, 100000)),
      pos_y: Math.round(limitar(pos.y, -100000, 100000)),
      cor: CORES_QUADRO.some((c) => c.id === cor) ? cor : "branco",
    })
    .select(COLUNAS)
    .single();
  if (error) return { ok: false, erro: error.message };
  return { ok: true, dado: data as PessoaOrg };
}

export type MudancaQuadro = Partial<Pick<PessoaOrg, "nome" | "cargo" | "setor" | "texto" | "cor" | "pos_x" | "pos_y" | "largura" | "altura" | "horas_semana" | "chefe_id" | "observacoes">>;

/** Salva o que mudou no quadro (texto, cor, posição, tamanho, chefe...). */
export async function alterarQuadro(id: string, m: MudancaQuadro): Promise<Resposta> {
  const supabase = await createClient();
  const r: Record<string, unknown> = {};
  if ("nome" in m) r.nome = m.nome?.trim() || null;
  if ("cargo" in m) r.cargo = m.cargo?.trim() || "Sem título";
  if ("setor" in m) r.setor = m.setor?.trim() || null;
  if ("texto" in m) r.texto = m.texto?.trim() ? m.texto : null;
  if ("observacoes" in m) r.observacoes = m.observacoes?.trim() || null;
  if ("cor" in m) r.cor = CORES_QUADRO.some((c) => c.id === m.cor) ? m.cor : "branco";
  if ("pos_x" in m) r.pos_x = Math.round(limitar(m.pos_x, -100000, 100000));
  if ("pos_y" in m) r.pos_y = Math.round(limitar(m.pos_y, -100000, 100000));
  if ("largura" in m) r.largura = Math.round(limitar(m.largura, 120, 1200));
  if ("altura" in m) r.altura = Math.round(limitar(m.altura, 80, 1200));
  if ("horas_semana" in m) r.horas_semana = limitar(m.horas_semana, 0, 168);
  if ("chefe_id" in m) {
    const erro = await chefeValido(supabase, id, m.chefe_id ?? null);
    if (erro) return { ok: false, erro };
    r.chefe_id = m.chefe_id ?? null;
  }
  if (!Object.keys(r).length) return { ok: true, dado: null };
  const { error } = await supabase.from("organograma_pessoas").update(r).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  return { ok: true, dado: null };
}

/** Move vários quadros de uma vez (ex.: "Organizar"). */
export async function posicionarQuadros(lista: { id: string; pos_x: number; pos_y: number }[]): Promise<Resposta> {
  const supabase = await createClient();
  for (const q of lista.slice(0, 500)) {
    const { error } = await supabase
      .from("organograma_pessoas")
      .update({ pos_x: Math.round(limitar(q.pos_x, -100000, 100000)), pos_y: Math.round(limitar(q.pos_y, -100000, 100000)) })
      .eq("id", q.id);
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true, dado: null };
}

/** Exclui o quadro. Quem respondia a ele passa a responder ao chefe dele. */
export async function excluirQuadro(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: atual } = await supabase.from("organograma_pessoas").select("chefe_id").eq("id", id).maybeSingle();
  if (!atual) return "Quadro não encontrado.";
  const { error: e1 } = await supabase.from("organograma_pessoas").update({ chefe_id: atual.chefe_id }).eq("chefe_id", id);
  if (e1) return `Não foi possível excluir: ${e1.message}`;
  const { error } = await supabase.from("organograma_pessoas").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizarTelas();
  return null;
}

/* ───────────────────────── funções de cada quadro ───────────────────────── */

/** Liga ou desliga uma função do quadro. */
export async function marcarFuncao(pessoaId: string, funcaoId: string, faz: boolean): Promise<Resposta> {
  const supabase = await createClient();
  const { error } = faz
    ? await supabase.from("organograma_atribuicoes").upsert({ pessoa_id: pessoaId, funcao_id: funcaoId }, { onConflict: "funcao_id,pessoa_id", ignoreDuplicates: true })
    : await supabase.from("organograma_atribuicoes").delete().eq("pessoa_id", pessoaId).eq("funcao_id", funcaoId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true, dado: null };
}

/** Cria funções novas (uma por linha, "Nome - 10h") e já liga ao quadro, se veio um. */
export async function criarFuncoesRapido(linhas: string, pessoaId: string | null, setor: string | null = null): Promise<Resposta<{ id: string; nome: string; horas_semana: number }[]>> {
  const novas = linhas.split(/\r?\n/).map(lerFuncaoNova).filter((f): f is NonNullable<typeof f> => Boolean(f)).slice(0, 50);
  if (!novas.length) return { ok: false, erro: "Escreva o nome da função." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organograma_funcoes")
    .insert(novas.map((f) => ({ nome: f.nome, horas_semana: f.horas, setor })))
    .select("id, nome, horas_semana");
  if (error) return { ok: false, erro: error.message };
  if (pessoaId && data?.length) {
    const { error: e2 } = await supabase.from("organograma_atribuicoes").insert(data.map((f) => ({ funcao_id: f.id, pessoa_id: pessoaId })));
    if (e2) return { ok: false, erro: e2.message };
  }
  return { ok: true, dado: data ?? [] };
}

/** Formulário da tela Funções (criar ou alterar uma função e quem faz). */
export async function salvarFuncao(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro = {
    nome: texto(form, "nome") ?? "",
    setor: texto(form, "setor"),
    horas_semana: limitar(numero(form, "horas_semana") ?? 0, 0, 168),
    descricao: texto(form, "descricao"),
  };
  if (!registro.nome) throw new Error("Escreva o nome da função.");
  let funcaoId = id;
  if (id) {
    const { error } = await supabase.from("organograma_funcoes").update(registro).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("organograma_funcoes").insert(registro).select("id").single();
    if (error) throw new Error(error.message);
    funcaoId = data.id;
  }
  const quem = form.getAll("pessoas").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const { error: e1 } = await supabase.from("organograma_atribuicoes").delete().eq("funcao_id", funcaoId!).not("pessoa_id", "in", `(${quem.length ? quem.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (e1) throw new Error(e1.message);
  if (quem.length) {
    const { error: e2 } = await supabase
      .from("organograma_atribuicoes")
      .upsert(quem.map((p) => ({ funcao_id: funcaoId!, pessoa_id: p })), { onConflict: "funcao_id,pessoa_id", ignoreDuplicates: true });
    if (e2) throw new Error(e2.message);
  }
  atualizarTelas();
}

export async function excluirFuncao(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("organograma_funcoes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizarTelas();
  return null;
}
