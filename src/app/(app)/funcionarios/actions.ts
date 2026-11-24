"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { digitos, erroDocumento, erroEmail, formatarCEP, formatarDocumento, formatarTelefone } from "@/lib/cliente";
import { ehUuid } from "@/lib/curriculos";
import {
  BUCKET_FUNCIONARIOS, SITUACOES_FUNCIONARIO, ehTipoArquivoFuncionario, ehTipoAtestado, pastaDoFuncionario, type SituacaoFuncionario,
} from "@/lib/funcionarios";
import { marcacoesDoTexto, minutosDoDia } from "@/lib/ponto";

export type ArquivoEnviado = { caminho: string; nome_arquivo: string; tamanho: number; tipo_arquivo: string | null };

const atualizar = (id?: string | null) => {
  revalidatePath("/funcionarios");
  revalidatePath("/funcionarios/atestados");
  revalidatePath("/funcionarios/ponto");
  if (id) revalidatePath(`/funcionarios/${id}`);
};

const valorOuNulo = (form: FormData, campo: string) => {
  const t = texto(form, campo);
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function dados(form: FormData) {
  const situacao = texto(form, "situacao");
  const uf = texto(form, "uf");
  const tel = (c: string) => (texto(form, c) ? formatarTelefone(texto(form, c)) : null);
  const campos = [
    "nome", "apelido", "rg", "rg_orgao", "data_nascimento", "estado_civil", "escolaridade", "nome_mae", "nome_pai", "pis", "ctps",
    "titulo_eleitor", "cnh", "cnh_categoria", "cnh_validade", "endereco", "numero", "complemento", "bairro", "cidade",
    "contato_emergencia_nome", "contato_emergencia_parentesco", "matricula", "cargo", "setor", "tipo_contrato", "data_admissao",
    "data_demissao", "motivo_demissao", "horario", "banco", "agencia", "conta", "pix", "tipo_sanguineo", "alergias",
    "ultimo_exame", "proximo_exame", "tamanho_camisa", "tamanho_calca", "tamanho_calcado", "observacoes",
  ] as const;
  const r: Record<string, unknown> = Object.fromEntries(campos.map((c) => [c, texto(form, c)]));
  return {
    ...r,
    nome: texto(form, "nome") ?? "",
    situacao: (situacao && Object.hasOwn(SITUACOES_FUNCIONARIO, situacao) ? situacao : "ativo") as SituacaoFuncionario,
    cpf: texto(form, "cpf") ? formatarDocumento(texto(form, "cpf")) : null,
    telefone: tel("telefone"),
    telefone2: tel("telefone2"),
    contato_emergencia_telefone: tel("contato_emergencia_telefone"),
    email: texto(form, "email")?.toLowerCase() ?? null,
    cep: texto(form, "cep") ? formatarCEP(texto(form, "cep")) : null,
    uf: uf ? uf.toUpperCase().slice(0, 2) : null,
    salario: valorOuNulo(form, "salario"),
    horas_semana: valorOuNulo(form, "horas_semana"),
  };
}

/** Nome de outro funcionário que já usa este CPF, ou null. */
export async function cpfEmUso(cpf: string, ignorarId: string | null): Promise<string | null> {
  const d = digitos(cpf);
  if (d.length !== 11) return null;
  const supabase = await createClient();
  let consulta = supabase.from("funcionarios").select("id, nome").or(`cpf.eq."${d}",cpf.eq."${formatarDocumento(d)}"`).limit(1);
  if (ignorarId) consulta = consulta.neq("id", ignorarId);
  const { data } = await consulta;
  return data?.[0]?.nome ?? null;
}

export async function salvarFuncionario(id: string | null, form: FormData) {
  const registro = dados(form);
  if (!registro.nome) throw new Error("Escreva o nome do funcionário.");
  if (registro.cpf && digitos(registro.cpf).length !== 11) throw new Error("O CPF tem 11 números.");
  const erro = erroDocumento(registro.cpf) ?? erroEmail(registro.email);
  if (erro) throw new Error(erro);
  if (registro.cpf) {
    const outro = await cpfEmUso(registro.cpf, id);
    if (outro) throw new Error(`Este CPF já está no cadastro de ${outro}.`);
  }
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("funcionarios").update(registro).eq("id", id).select("id").single()
    : await supabase.from("funcionarios").insert(registro).select("id").single();
  if (error) throw new Error(error.message);
  atualizar(data.id);
  if (id) return;
  redirect(`/funcionarios/${data.id}`);
}

/** Muda só a situação (trabalhando, férias, afastado, desligado), pelo botão na ficha. */
export async function mudarSituacaoFuncionario(id: string, situacao: SituacaoFuncionario) {
  if (!Object.hasOwn(SITUACOES_FUNCIONARIO, situacao)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("funcionarios").update({ situacao }).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(id);
}

/** Exclui o funcionário com tudo o que é dele (arquivos, atestados, ponto e anotações). */
export async function excluirFuncionario(id: string): Promise<string | null> {
  if (!ehUuid(id)) return "Funcionário inválido.";
  const supabase = await createClient();
  const [{ data: docs }, { data: atestados }] = await Promise.all([
    supabase.from("funcionario_documentos").select("caminho").eq("funcionario_id", id),
    supabase.from("funcionario_atestados").select("caminho").eq("funcionario_id", id).not("caminho", "is", null),
  ]);
  const { error } = await supabase.from("funcionarios").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  const caminhos = [...(docs ?? []), ...(atestados ?? [])].map((d) => d.caminho as string).filter(Boolean);
  if (caminhos.length) await supabase.storage.from(BUCKET_FUNCIONARIOS).remove(caminhos);
  atualizar();
  return null;
}

/* ─────────────────────────────── arquivos ─────────────────────────────── */

const daPasta = (funcionarioId: string, a: ArquivoEnviado) => a.caminho.startsWith(pastaDoFuncionario(funcionarioId));

export async function registrarArquivos(funcionarioId: string, tipo: string, descricao: string | null, arquivos: ArquivoEnviado[]): Promise<string | null> {
  if (!ehUuid(funcionarioId)) return "Funcionário inválido.";
  if (!ehTipoArquivoFuncionario(tipo)) return "Escolha o tipo do arquivo.";
  if (!arquivos.length) return "Escolha um arquivo.";
  if (arquivos.some((a) => !daPasta(funcionarioId, a))) return "Arquivo fora da pasta deste funcionário.";
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_documentos").insert(
    arquivos.map((a) => ({ funcionario_id: funcionarioId, tipo, descricao: descricao?.trim() || null, ...a })),
  );
  if (error) {
    await supabase.storage.from(BUCKET_FUNCIONARIOS).remove(arquivos.map((a) => a.caminho));
    return `Não foi possível salvar: ${error.message}`;
  }
  atualizar(funcionarioId);
  return null;
}

export async function alterarArquivo(id: string, tipo: string, descricao: string | null, novo: ArquivoEnviado | null): Promise<string | null> {
  if (!ehTipoArquivoFuncionario(tipo)) return "Escolha o tipo do arquivo.";
  const supabase = await createClient();
  const { data: doc } = await supabase.from("funcionario_documentos").select("funcionario_id, caminho").eq("id", id).maybeSingle();
  if (!doc) return "Arquivo não encontrado.";
  if (novo && !daPasta(doc.funcionario_id, novo)) return "Arquivo fora da pasta deste funcionário.";
  const { error } = await supabase.from("funcionario_documentos").update({ tipo, descricao: descricao?.trim() || null, ...(novo ?? {}) }).eq("id", id);
  if (error) {
    if (novo) await supabase.storage.from(BUCKET_FUNCIONARIOS).remove([novo.caminho]);
    return `Não foi possível salvar: ${error.message}`;
  }
  if (novo && novo.caminho !== doc.caminho) await supabase.storage.from(BUCKET_FUNCIONARIOS).remove([doc.caminho]);
  atualizar(doc.funcionario_id);
  return null;
}

export async function excluirArquivo(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("funcionario_documentos").select("funcionario_id, caminho").eq("id", id).maybeSingle();
  if (!doc) return "Arquivo não encontrado.";
  const { error } = await supabase.from("funcionario_documentos").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  await supabase.storage.from(BUCKET_FUNCIONARIOS).remove([doc.caminho]);
  atualizar(doc.funcionario_id);
  return null;
}

/* ─────────────────────────────── atestados ─────────────────────────────── */

export type DadosDoAtestado = {
  funcionario_id: string; tipo: string; data_inicio: string; data_fim: string;
  horas: string | null; cid: string | null; profissional: string | null; observacao: string | null;
};

const ehData = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function limparAtestado(d: DadosDoAtestado) {
  const horas = d.horas ? Number(String(d.horas).replace(",", ".")) : null;
  return {
    tipo: d.tipo,
    data_inicio: d.data_inicio,
    data_fim: d.data_fim || d.data_inicio,
    horas: horas != null && Number.isFinite(horas) && horas > 0 ? horas : null,
    cid: d.cid?.trim().toUpperCase() || null,
    profissional: d.profissional?.trim() || null,
    observacao: d.observacao?.trim() || null,
  };
}

/** Lança ou altera um atestado. O arquivo (foto ou PDF) é opcional; se vier um novo, o antigo é apagado. */
export async function salvarAtestado(id: string | null, d: DadosDoAtestado, arquivo: ArquivoEnviado | null): Promise<string | null> {
  if (!ehUuid(d.funcionario_id)) return "Escolha o funcionário.";
  if (!ehTipoAtestado(d.tipo)) return "Escolha o tipo do atestado.";
  if (!ehData(d.data_inicio)) return "Informe o primeiro dia.";
  if (d.data_fim && (!ehData(d.data_fim) || d.data_fim < d.data_inicio)) return "O último dia não pode ser antes do primeiro.";
  if (arquivo && !daPasta(d.funcionario_id, arquivo)) return "Arquivo fora da pasta deste funcionário.";
  const supabase = await createClient();
  const registro = { funcionario_id: d.funcionario_id, ...limparAtestado(d), ...(arquivo ?? {}) };
  let antigo: string | null = null;
  if (id) {
    const { data: atual } = await supabase.from("funcionario_atestados").select("caminho").eq("id", id).maybeSingle();
    if (!atual) return "Atestado não encontrado.";
    antigo = atual.caminho;
  }
  const { error } = id
    ? await supabase.from("funcionario_atestados").update(registro).eq("id", id)
    : await supabase.from("funcionario_atestados").insert(registro);
  if (error) {
    if (arquivo) await supabase.storage.from(BUCKET_FUNCIONARIOS).remove([arquivo.caminho]);
    return `Não foi possível salvar: ${error.message}`;
  }
  if (arquivo && antigo && antigo !== arquivo.caminho) await supabase.storage.from(BUCKET_FUNCIONARIOS).remove([antigo]);
  atualizar(d.funcionario_id);
  return null;
}

export async function excluirAtestado(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("funcionario_atestados").select("funcionario_id, caminho").eq("id", id).maybeSingle();
  if (!a) return "Atestado não encontrado.";
  const { error } = await supabase.from("funcionario_atestados").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  if (a.caminho) await supabase.storage.from(BUCKET_FUNCIONARIOS).remove([a.caminho]);
  atualizar(a.funcionario_id);
  return null;
}

/* ─────────────────────────────── anotações ─────────────────────────────── */

export async function adicionarAnotacaoFuncionario(funcionarioId: string, form: FormData) {
  const t = texto(form, "texto");
  if (!t) throw new Error("Escreva a anotação.");
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_anotacoes").insert({ funcionario_id: funcionarioId, texto: t });
  if (error) throw new Error(error.message);
  atualizar(funcionarioId);
}

export async function editarAnotacaoFuncionario(id: string, funcionarioId: string, form: FormData) {
  const t = texto(form, "texto");
  if (!t) throw new Error("Escreva a anotação.");
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_anotacoes").update({ texto: t }).eq("id", id);
  if (error) throw new Error(error.message);
  atualizar(funcionarioId);
}

export async function excluirAnotacaoFuncionario(id: string, funcionarioId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_anotacoes").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar(funcionarioId);
  return null;
}

/* ─────────────────────────────── relógio ponto ─────────────────────────────── */

export type DiaDePonto = { funcionario_id: string; dia: string; marcacoes: string[] };

/**
 * Grava as marcações lidas da planilha. Se o dia já existe, as marcações são trocadas pelas da planilha
 * (importar o mesmo arquivo duas vezes não duplica nada).
 */
export async function importarPonto(dias: DiaDePonto[], arquivo: string): Promise<{ erro: string | null; gravados: number }> {
  const limpos = dias
    .filter((d) => ehUuid(d.funcionario_id) && ehData(d.dia))
    .map((d) => {
      const marcacoes = [...new Set(d.marcacoes.filter((m) => /^([01]\d|2[0-3]):[0-5]\d$/.test(m)))].sort().slice(0, 20);
      return { funcionario_id: d.funcionario_id, dia: d.dia, marcacoes, minutos_trabalhados: minutosDoDia(marcacoes), origem: "importado", arquivo_origem: arquivo.slice(0, 200) };
    })
    .filter((d) => d.marcacoes.length);
  if (!limpos.length) return { erro: "Nenhuma marcação para gravar.", gravados: 0 };
  if (limpos.length > 20000) return { erro: "Planilha grande demais (mais de 20 mil dias). Separe por mês.", gravados: 0 };
  const supabase = await createClient();
  let gravados = 0;
  for (let i = 0; i < limpos.length; i += 500) {
    const { error } = await supabase.from("funcionario_ponto").upsert(limpos.slice(i, i + 500), { onConflict: "funcionario_id,dia" });
    if (error) return { erro: `Parou no meio (${gravados} dias gravados): ${error.message}`, gravados };
    gravados += Math.min(500, limpos.length - i);
  }
  atualizar();
  for (const id of new Set(limpos.map((d) => d.funcionario_id))) revalidatePath(`/funcionarios/${id}`);
  return { erro: null, gravados };
}

/** Lança ou corrige um dia à mão (ex.: esqueceu de bater o ponto). */
export async function salvarDiaDePonto(funcionarioId: string, form: FormData) {
  const dia = texto(form, "dia");
  if (!ehUuid(funcionarioId) || !ehData(dia)) throw new Error("Informe o dia.");
  const marcacoes = marcacoesDoTexto(texto(form, "marcacoes") ?? "");
  const observacao = texto(form, "observacao");
  if (!marcacoes.length && !observacao) throw new Error("Escreva as horas (ex.: 07:30 11:30 13:00 17:18) ou uma observação.");
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_ponto").upsert(
    { funcionario_id: funcionarioId, dia, marcacoes, minutos_trabalhados: minutosDoDia(marcacoes), observacao, origem: "manual" },
    { onConflict: "funcionario_id,dia" },
  );
  if (error) throw new Error(error.message);
  atualizar(funcionarioId);
}

export async function excluirDiaDePonto(id: string, funcionarioId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_ponto").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  atualizar(funcionarioId);
  return null;
}
