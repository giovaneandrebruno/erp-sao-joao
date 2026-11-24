"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Campo, Erro, estiloBotao, inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";
import {
  BUCKET_FUNCIONARIOS, LIMITE_ARQUIVO, TIPOS_ARQUIVO_FUNCIONARIO, TIPOS_ATESTADO, caminhoDoArquivo, hojeSP, tamanhoLegivel, type TipoArquivoFuncionario,
} from "@/lib/funcionarios";
import { alterarArquivo, registrarArquivos, salvarAtestado, type ArquivoEnviado } from "./actions";

const arquivoCls = `${inputCls} file:mr-3 file:rounded-md file:border-0 file:bg-madeira-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-madeira-800`;

const fecharJanela = (form: HTMLFormElement | null) => {
  (form?.closest("dialog") as HTMLDialogElement | null)?.close();
  form?.reset();
};

/** Envia um arquivo do navegador direto para a pasta privada do funcionário. */
async function enviarArquivo(funcionarioId: string, f: File, subpasta: string): Promise<ArquivoEnviado | string> {
  const caminho = caminhoDoArquivo(funcionarioId, f.name, subpasta);
  const { error } = await createClient().storage.from(BUCKET_FUNCIONARIOS).upload(caminho, f, { contentType: f.type || undefined });
  if (error) return `Não foi possível enviar "${f.name}": ${error.message}`;
  return { caminho, nome_arquivo: f.name, tamanho: f.size, tipo_arquivo: f.type || null };
}

/** Colocar arquivos novos na pasta do funcionário (vários de uma vez) ou alterar um que já está lá. */
export function FormArquivo({ funcionarioId, arquivo, tipoInicial = "documento_pessoal" }: {
  funcionarioId: string;
  arquivo?: { id: string; tipo: string; descricao: string | null; nome_arquivo: string };
  tipoInicial?: TipoArquivoFuncionario;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const editando = !!arquivo;

  function escolher(lista: FileList | null) {
    const todos = Array.from(lista ?? []);
    const grandes = todos.filter((f) => f.size > LIMITE_ARQUIVO);
    setErro(grandes.length ? `Arquivo maior que 50 MB: ${grandes.map((f) => f.name).join(", ")}` : null);
    setArquivos(todos.filter((f) => f.size <= LIMITE_ARQUIVO));
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // a janela só fecha quando terminar de enviar
    const dados = new FormData(e.currentTarget);
    const tipo = String(dados.get("tipo") ?? "");
    const descricao = String(dados.get("descricao") ?? "").trim() || null;
    if (!editando && !arquivos.length) { setErro("Escolha pelo menos um arquivo."); return; }
    setErro(null);
    setEnviando(true);
    try {
      const enviados: ArquivoEnviado[] = [];
      for (const [i, f] of arquivos.entries()) {
        setEstado(arquivos.length > 1 ? `Enviando ${i + 1} de ${arquivos.length}…` : "Enviando…");
        const r = await enviarArquivo(funcionarioId, f, "arquivos");
        if (typeof r === "string") {
          if (enviados.length) await createClient().storage.from(BUCKET_FUNCIONARIOS).remove(enviados.map((a) => a.caminho));
          setErro(r);
          return;
        }
        enviados.push(r);
      }
      setEstado("Salvando…");
      const msg = editando
        ? await alterarArquivo(arquivo.id, tipo, descricao, enviados[0] ?? null)
        : await registrarArquivos(funcionarioId, tipo, descricao, enviados);
      if (msg) { setErro(msg); return; }
      avisar(editando ? "Arquivo alterado" : enviados.length > 1 ? `${enviados.length} arquivos enviados` : "Arquivo enviado");
      fecharJanela(form.current);
      setArquivos([]);
      router.refresh();
    } catch {
      setErro("Não foi possível enviar. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
      setEstado(null);
    }
  }

  return (
    <form ref={form} onSubmit={enviar} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tipo do arquivo">
          <select name="tipo" defaultValue={arquivo?.tipo ?? tipoInicial} className={inputCls}>
            {Object.entries(TIPOS_ARQUIVO_FUNCIONARIO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Descrição (opcional)">
          <input name="descricao" defaultValue={arquivo?.descricao ?? ""} placeholder="Ex.: holerite de outubro, NR-12" className={inputCls} />
        </Campo>
      </div>
      <Campo rotulo={editando ? "Trocar o arquivo (opcional)" : "Arquivos"}>
        <input type="file" multiple={!editando} onChange={(e) => escolher(e.target.files)} className={arquivoCls} />
      </Campo>
      <p className="-mt-2 text-xs text-stone-500">
        {editando ? <>Arquivo atual: <strong>{arquivo.nome_arquivo}</strong>. Se escolher outro, o atual é substituído.</> : "PDF, foto, planilha ou qualquer outro arquivo, até 50 MB cada. Dá para escolher vários de uma vez."}
      </p>
      {!!arquivos.length && (
        <ul className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600 ring-1 ring-stone-200">
          {arquivos.map((f) => <li key={f.name}>{f.name} <span className="text-stone-400">· {tamanhoLegivel(f.size)}</span></li>)}
        </ul>
      )}
      <Erro mensagem={erro} />
      <div className="flex items-center justify-end gap-3">
        {estado && <span className="text-xs text-stone-500">{estado}</span>}
        <button type="submit" disabled={enviando} className={estiloBotao.primario}>{enviando ? "Enviando…" : editando ? "Salvar" : "Enviar"}</button>
      </div>
    </form>
  );
}

export type Atestado = {
  id: string; funcionario_id: string; tipo: string; data_inicio: string; data_fim: string; horas: number | null;
  cid: string | null; profissional: string | null; observacao: string | null; nome_arquivo: string | null;
};

/** Lançar ou alterar um atestado. A foto ou o PDF do atestado é opcional. */
export function FormAtestado({ funcionarioId, funcionarios, atestado }: {
  funcionarioId?: string;
  /** Na tela de todos os atestados: lista para escolher de quem é. */
  funcionarios?: { id: string; nome: string }[];
  atestado?: Atestado;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [inicio, setInicio] = useState(atestado?.data_inicio ?? hojeSP());
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const editando = !!atestado;

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const s = (k: string) => String(d.get(k) ?? "").trim() || null;
    const quem = atestado?.funcionario_id ?? funcionarioId ?? s("funcionario_id") ?? "";
    if (!quem) { setErro("Escolha o funcionário."); return; }
    if (arquivo && arquivo.size > LIMITE_ARQUIVO) { setErro("Arquivo maior que 50 MB."); return; }
    setErro(null);
    setEnviando(true);
    try {
      let enviado: ArquivoEnviado | null = null;
      if (arquivo) {
        setEstado("Enviando o arquivo…");
        const r = await enviarArquivo(quem, arquivo, "atestados");
        if (typeof r === "string") { setErro(r); return; }
        enviado = r;
      }
      setEstado("Salvando…");
      const msg = await salvarAtestado(atestado?.id ?? null, {
        funcionario_id: quem, tipo: s("tipo") ?? "", data_inicio: s("data_inicio") ?? "", data_fim: s("data_fim") ?? "",
        horas: s("horas"), cid: s("cid"), profissional: s("profissional"), observacao: s("observacao"),
      }, enviado);
      if (msg) { setErro(msg); return; }
      avisar(editando ? "Atestado alterado" : "Atestado lançado");
      fecharJanela(form.current);
      setArquivo(null);
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
      setEstado(null);
    }
  }

  return (
    <form ref={form} onSubmit={enviar} className="grid gap-4">
      {funcionarios && !atestado && (
        <Campo rotulo="Funcionário *">
          <select name="funcionario_id" required defaultValue="" className={inputCls}>
            <option value="" disabled>Escolha…</option>
            {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Campo>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tipo">
          <select name="tipo" defaultValue={atestado?.tipo ?? "atestado_medico"} className={inputCls}>
            {Object.entries(TIPOS_ATESTADO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Horas (se não foi o dia todo)">
          <input name="horas" inputMode="decimal" defaultValue={atestado?.horas ?? ""} placeholder="Ex.: 3" className={inputCls} />
        </Campo>
        <Campo rotulo="Primeiro dia *">
          <input name="data_inicio" type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} />
        </Campo>
        <Campo rotulo="Último dia">
          <input name="data_fim" type="date" min={inicio} defaultValue={atestado?.data_fim ?? ""} className={inputCls} />
        </Campo>
        <Campo rotulo="CID (se estiver no atestado)">
          <input name="cid" defaultValue={atestado?.cid ?? ""} placeholder="Ex.: J11" className={`${inputCls} uppercase`} />
        </Campo>
        <Campo rotulo="Médico / clínica">
          <input name="profissional" defaultValue={atestado?.profissional ?? ""} className={inputCls} />
        </Campo>
      </div>
      <Campo rotulo="Observação">
        <textarea name="observacao" rows={2} defaultValue={atestado?.observacao ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo={atestado?.nome_arquivo ? "Trocar a foto / PDF do atestado (opcional)" : "Foto ou PDF do atestado (opcional)"}>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className={arquivoCls} />
      </Campo>
      <p className="-mt-2 text-xs text-stone-500">
        {atestado?.nome_arquivo ? <>Arquivo atual: <strong>{atestado.nome_arquivo}</strong>. </> : null}
        Deixe o último dia em branco se for um dia só.
      </p>
      <Erro mensagem={erro} />
      <div className="flex items-center justify-end gap-3">
        {estado && <span className="text-xs text-stone-500">{estado}</span>}
        <button type="submit" disabled={enviando} className={estiloBotao.primario}>{enviando ? "Salvando…" : editando ? "Salvar" : "Lançar atestado"}</button>
      </div>
    </form>
  );
}
