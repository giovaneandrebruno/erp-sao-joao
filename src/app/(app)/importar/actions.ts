"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { AREAS, converter, normalizar, type Area, type Opcoes } from "@/lib/importacao";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type Resumo = { lidas: number; inseridos: number; atualizados: number; removidos: number; mantidos: number; avisos: string[] };

const LOTE = 400;

async function podeImportar(area: Area) {
  const perfil = await perfilAtual();
  if (!perfil || perfil.papel === "montador") return "Sem permissão para importar.";
  if (area === "financeiro" && perfil.papel !== "admin") return "Só o administrador importa no financeiro.";
  if (!AREAS[area]) return "Área inválida.";
  return null;
}

/** Busca todas as linhas (o Supabase devolve no máximo 1000 por vez). */
async function buscarTodos<T>(supabase: Supa, tabela: string, colunas: string, soImportados = false) {
  const tudo: T[] = [];
  for (let de = 0; ; de += 1000) {
    const base = supabase.from(tabela).select(colunas);
    const q = soImportados ? base.not("importacao_id", "is", null) : base;
    const { data, error } = await q.order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    tudo.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 1000) break;
  }
  return tudo;
}

function emLotes<T>(lista: T[], tamanho = LOTE) {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}

type Existente = { id: string; chave_importacao: string | null; importacao_id: string | null; nome?: string | null; cpf_cnpj?: string | null; codigo?: string | null };

export async function importarDados(entrada: {
  area: Area;
  arquivoNome: string;
  arquivoCaminho: string | null;
  arquivoTipo: string | null;
  cabecalho: string[];
  linhas: string[][];
  mapa: (string | null)[];
  modo: "atualizar" | "somar";
  opcoes?: Opcoes;
}): Promise<{ erro: string } | { resumo: Resumo }> {
  const { area } = entrada;
  const semPermissao = await podeImportar(area);
  if (semPermissao) return { erro: semPermissao };
  const def = AREAS[area];
  const { registros, avisos } = converter(area, entrada.cabecalho, entrada.linhas, entrada.mapa, entrada.opcoes);
  if (!registros.length) return { erro: avisos[0] ?? "Nenhuma linha válida para importar. Confira as colunas escolhidas." };

  const supabase = await createClient();
  const mapeados = new Set(entrada.mapa.filter(Boolean) as string[]);

  try {
    const { data: imp, error: eImp } = await supabase
      .from("importacoes")
      .insert({ area, arquivo_nome: entrada.arquivoNome.slice(0, 200), arquivo_caminho: entrada.arquivoCaminho, arquivo_tipo: entrada.arquivoTipo, modo: entrada.modo, linhas_lidas: entrada.linhas.length })
      .select("id")
      .single();
    if (eImp) return { erro: eImp.message };

    // o que já existe no sistema
    const natural = area === "clientes" || area === "fornecedores" || area === "estoque";
    const colunas = ["id", "chave_importacao", "importacao_id", ...(area === "estoque" ? ["nome", "codigo"] : natural ? ["nome", "cpf_cnpj"] : [])].join(", ");
    const existentes = await buscarTodos<Existente>(supabase, def.tabela, colunas, !natural);
    const porChave = new Map<string, Existente>();
    const porNatural = new Map<string, Existente>();
    for (const e of existentes) {
      if (e.chave_importacao) porChave.set(e.chave_importacao, e);
      if (natural) {
        if (area === "estoque") {
          if (e.codigo) porNatural.set(`cod:${normalizar(e.codigo)}`, e);
          if (e.nome) porNatural.set(`nome:${normalizar(e.nome)}`, e);
        } else {
          const doc = (e.cpf_cnpj ?? "").replace(/\D/g, "");
          if (doc.length >= 11) porNatural.set(`doc:${doc}`, e);
          if (e.nome) porNatural.set(`nome:${normalizar(e.nome)}`, e);
        }
      }
    }

    // referências: nº do pedido (produção) e cliente/fornecedor (financeiro)
    const pedidos = new Map<number, string>();
    if (area === "producao" && mapeados.has("pedido")) {
      const numeros = [...new Set(registros.map((r) => r.ref.pedido).filter((n): n is number => typeof n === "number"))];
      for (const lote of emLotes(numeros, 300)) {
        const { data } = await supabase.from("pedidos").select("id, numero").in("numero", lote);
        for (const p of data ?? []) pedidos.set(p.numero, p.id);
      }
    }
    const clientesPorNome = new Map<string, string>();
    const fornecedoresPorNome = new Map<string, string>();
    if (area === "financeiro" && mapeados.has("pessoa")) {
      for (const c of await buscarTodos<{ id: string; nome: string }>(supabase, "clientes", "id, nome")) clientesPorNome.set(normalizar(c.nome), c.id);
      for (const f of await buscarTodos<{ id: string; nome: string }>(supabase, "fornecedores", "id, nome")) fornecedoresPorNome.set(normalizar(f.nome), f.id);
    }

    const usados = new Set<string>();
    const atualizar: Record<string, unknown>[] = [];
    const inserir: Record<string, unknown>[] = [];
    for (const r of registros) {
      let achado = porChave.get(r.chave);
      if (!achado && natural) {
        const base = r.chave.replace(/#\d+$/, "");
        achado = porNatural.get(base);
        if (!achado && area === "estoque" && r.valores.nome) achado = porNatural.get(`nome:${normalizar(String(r.valores.nome))}`);
        if (!achado && area !== "estoque" && r.valores.nome) achado = porNatural.get(`nome:${normalizar(String(r.valores.nome))}`);
      }
      if (achado && usados.has(achado.id)) achado = undefined;
      const linha: Record<string, unknown> = { ...r.valores, extras: r.extras, chave_importacao: r.chave };
      if (area === "producao" && mapeados.has("pedido")) linha.pedido_id = r.ref.pedido != null ? pedidos.get(r.ref.pedido) ?? null : null;
      if (area === "financeiro" && mapeados.has("pessoa")) {
        const nome = r.ref.pessoa ? normalizar(r.ref.pessoa) : "";
        const ehPagar = r.valores.tipo === "pagar";
        linha.cliente_id = !ehPagar && nome ? clientesPorNome.get(nome) ?? null : null;
        linha.fornecedor_id = ehPagar && nome ? fornecedoresPorNome.get(nome) ?? null : null;
      }
      if (achado) {
        usados.add(achado.id);
        // cadastro feito à mão continua sendo "do sistema": só os dados são atualizados
        atualizar.push({ id: achado.id, ...linha, importacao_id: achado.importacao_id ? imp.id : null });
      } else {
        inserir.push({ ...linha, importacao_id: imp.id });
      }
    }

    for (const lote of emLotes(atualizar)) {
      const { error } = await supabase.from(def.tabela).upsert(lote, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    for (const lote of emLotes(inserir)) {
      const { error } = await supabase.from(def.tabela).insert(lote);
      if (error) throw new Error(error.message);
    }

    // modo "atualizar": o que veio de planilhas anteriores e saiu da nova sai do sistema
    let removidos = 0;
    let mantidos = 0;
    if (entrada.modo === "atualizar") {
      let sobras = existentes.filter((e) => e.importacao_id && !usados.has(e.id)).map((e) => e.id);
      if (area === "clientes" && sobras.length) {
        const presos = new Set<string>();
        for (const lote of emLotes(sobras, 200)) {
          for (const t of ["orcamentos", "pedidos", "negociacoes", "chamados"]) {
            const { data } = await supabase.from(t).select("cliente_id").in("cliente_id", lote);
            for (const x of (data ?? []) as { cliente_id: string }[]) presos.add(x.cliente_id);
          }
        }
        mantidos = presos.size;
        sobras = sobras.filter((id) => !presos.has(id));
      }
      for (const lote of emLotes(sobras, 200)) {
        const { error, count } = await supabase.from(def.tabela).delete({ count: "exact" }).in("id", lote);
        if (error) throw new Error(error.message);
        removidos += count ?? 0;
      }
    }

    if (mantidos) avisos.push(`${mantidos} cliente(s) saíram da planilha mas ficaram no sistema porque já têm orçamento, pedido ou atendimento.`);
    await supabase
      .from("importacoes")
      .update({ inseridos: inserir.length, atualizados: atualizar.length, removidos, avisos: avisos.slice(0, 50) })
      .eq("id", imp.id);

    revalidatePath(def.caminho);
    revalidatePath("/importar");
    return { resumo: { lidas: registros.length, inseridos: inserir.length, atualizados: atualizar.length, removidos, mantidos, avisos } };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao importar." };
  }
}

/** Guarda só o arquivo (quando não há dados para ler, ou a leitura automática não está ligada). */
export async function guardarArquivo(area: Area, arquivoNome: string, arquivoCaminho: string, arquivoTipo: string | null) {
  const semPermissao = await podeImportar(area);
  if (semPermissao) return semPermissao;
  const supabase = await createClient();
  const { error } = await supabase.from("importacoes").insert({ area, arquivo_nome: arquivoNome.slice(0, 200), arquivo_caminho: arquivoCaminho, arquivo_tipo: arquivoTipo, modo: "arquivo" });
  if (error) return error.message;
  revalidatePath("/importar");
  return null;
}

/** Apaga tudo o que veio de arquivos nesta área. Pede a senha de quem está logado. */
export async function limparArea(area: Area, senha: string): Promise<{ erro: string } | { removidos: number; mantidos: number }> {
  const semPermissao = await podeImportar(area);
  if (semPermissao) return { erro: semPermissao };
  if (!senha) return { erro: "Digite a sua senha." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("limpar_importacoes", { p_area: area, p_senha: senha });
  if (error) return { erro: error.message.includes("Senha incorreta") ? "Senha incorreta." : error.message };
  const r = data as { removidos: number; mantidos: number; arquivos: string[] };
  if (r.arquivos?.length) {
    for (const lote of emLotes(r.arquivos, 100)) await supabase.storage.from("importacoes").remove(lote);
  }
  revalidatePath(AREAS[area].caminho);
  revalidatePath("/importar");
  return { removidos: r.removidos, mantidos: r.mantidos };
}

/** Link temporário para baixar o arquivo original. */
export async function linkArquivo(caminho: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("importacoes").createSignedUrl(caminho, 300);
  return data?.signedUrl ?? null;
}
