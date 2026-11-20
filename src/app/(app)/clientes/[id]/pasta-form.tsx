"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Campo, Erro, estiloBotao, inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { BUCKET_DOCUMENTOS, LIMITE_DOCUMENTO, TIPOS_DOCUMENTO, caminhoNovo, tamanhoLegivel, type TipoDocumento } from "@/lib/documentos";
import { alterarDocumento, registrarDocumentos, type ArquivoEnviado } from "./pasta-actions";

/**
 * Enviar documentos novos (vários de uma vez) ou alterar um que já está na pasta.
 * O arquivo vai direto do navegador para a pasta privada do Storage; depois o servidor grava o registro.
 */
export function FormDocumento({
  clienteId,
  documento,
  tipoInicial = "pedido_fechado",
}: {
  clienteId: string;
  documento?: { id: string; tipo: string; descricao: string | null; nome_arquivo: string };
  tipoInicial?: TipoDocumento;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const editando = !!documento;

  function escolher(lista: FileList | null) {
    const todos = Array.from(lista ?? []);
    const grandes = todos.filter((f) => f.size > LIMITE_DOCUMENTO);
    setErro(grandes.length ? `Arquivo maior que 50 MB: ${grandes.map((f) => f.name).join(", ")}` : null);
    setArquivos(todos.filter((f) => f.size <= LIMITE_DOCUMENTO));
  }

  function fechar() {
    (form.current?.closest("dialog") as HTMLDialogElement | null)?.close();
    form.current?.reset();
    setArquivos([]);
    setEstado(null);
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
      const supabase = createClient();
      const enviados: ArquivoEnviado[] = [];
      for (const [i, f] of arquivos.entries()) {
        setEstado(arquivos.length > 1 ? `Enviando ${i + 1} de ${arquivos.length}…` : "Enviando…");
        const caminho = caminhoNovo(clienteId, f.name);
        const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(caminho, f, { contentType: f.type || undefined });
        if (error) {
          if (enviados.length) await supabase.storage.from(BUCKET_DOCUMENTOS).remove(enviados.map((a) => a.caminho));
          setErro(`Não foi possível enviar "${f.name}": ${error.message}`);
          return;
        }
        enviados.push({ caminho, nome_arquivo: f.name, tamanho: f.size, tipo_arquivo: f.type || null });
      }
      setEstado("Salvando…");
      const msg = editando
        ? await alterarDocumento(documento.id, tipo, descricao, enviados[0] ?? null)
        : await registrarDocumentos(clienteId, tipo, descricao, enviados);
      if (msg) { setErro(msg); return; }
      avisar(editando ? "Documento alterado" : enviados.length > 1 ? `${enviados.length} documentos enviados` : "Documento enviado");
      fechar();
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
        <Campo rotulo="Tipo do documento">
          <select name="tipo" defaultValue={documento?.tipo ?? tipoInicial} className={inputCls}>
            {Object.entries(TIPOS_DOCUMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Descrição (opcional)">
          <input name="descricao" defaultValue={documento?.descricao ?? ""} placeholder="Ex.: cozinha e área de serviço" className={inputCls} />
        </Campo>
      </div>
      <Campo rotulo={editando ? "Trocar o arquivo (opcional)" : "Arquivos"}>
        <input
          type="file"
          multiple={!editando}
          onChange={(e) => escolher(e.target.files)}
          className={`${inputCls} file:mr-3 file:rounded-md file:border-0 file:bg-madeira-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-madeira-800`}
        />
      </Campo>
      <p className="-mt-2 text-xs text-stone-500">
        {editando ? <>Arquivo atual: <strong>{documento.nome_arquivo}</strong>. Se escolher outro, o atual é substituído.</> : "PDF, foto, planilha ou qualquer outro arquivo, até 50 MB cada. Dá para escolher vários de uma vez."}
      </p>
      {!!arquivos.length && (
        <ul className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600 ring-1 ring-stone-200">
          {arquivos.map((f) => <li key={f.name}>{f.name} <span className="text-stone-400">· {tamanhoLegivel(f.size)}</span></li>)}
        </ul>
      )}
      <Erro mensagem={erro} />
      <div className="flex items-center justify-end gap-3">
        {estado && <span className="text-xs text-stone-500">{estado}</span>}
        <button type="submit" disabled={enviando} className={estiloBotao.primario}>
          {enviando ? "Enviando…" : editando ? "Salvar" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
