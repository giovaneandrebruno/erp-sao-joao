"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Campo, Erro, estiloBotao, inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { BUCKET_CURRICULOS, LIMITE_CURRICULO, caminhoDoCurriculo, tamanhoLegivel } from "@/lib/curriculos";
import { alterarCurriculo, registrarCurriculo, type ArquivoDoCurriculo } from "./actions";

type Curriculo = { id: string; nome: string; vaga: string | null; telefone: string | null; email: string | null; nome_arquivo: string };

/**
 * Receber um currículo novo ou alterar um que já está salvo.
 * O arquivo vai direto do navegador para a pasta privada do Storage; depois o servidor grava o registro.
 */
export function FormCurriculo({ curriculo }: { curriculo?: Curriculo }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const editando = !!curriculo;

  function escolher(lista: FileList | null) {
    const f = lista?.[0] ?? null;
    if (f && f.size > LIMITE_CURRICULO) { setErro(`Arquivo maior que 50 MB: ${f.name}`); setArquivo(null); return; }
    setErro(null);
    setArquivo(f);
    // sugere o nome da pessoa a partir do nome do arquivo
    const nome = form.current?.elements.namedItem("nome") as HTMLInputElement | null;
    if (f && nome && !nome.value) {
      nome.value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b(curr[ií]culo|cv)\b/gi, "").replace(/\s+/g, " ").trim();
    }
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // a janela só fecha quando terminar de enviar
    const d = new FormData(e.currentTarget);
    const dados = {
      nome: String(d.get("nome") ?? "").trim(),
      vaga: String(d.get("vaga") ?? "").trim() || null,
      telefone: String(d.get("telefone") ?? "").trim() || null,
      email: String(d.get("email") ?? "").trim() || null,
    };
    if (!dados.nome) { setErro("Escreva o nome da pessoa."); return; }
    if (!editando && !arquivo) { setErro("Escolha o arquivo do currículo."); return; }
    setErro(null);
    setEnviando(true);
    try {
      const id = curriculo?.id ?? crypto.randomUUID();
      let enviado: ArquivoDoCurriculo | null = null;
      if (arquivo) {
        setEstado("Enviando o arquivo…");
        const caminho = caminhoDoCurriculo(id, arquivo.name);
        const { error } = await createClient().storage.from(BUCKET_CURRICULOS).upload(caminho, arquivo, { contentType: arquivo.type || undefined });
        if (error) { setErro(`Não foi possível enviar "${arquivo.name}": ${error.message}`); return; }
        enviado = { caminho, nome_arquivo: arquivo.name, tamanho: arquivo.size, tipo_arquivo: arquivo.type || null };
      }
      setEstado("Salvando…");
      const msg = editando ? await alterarCurriculo(id, dados, enviado) : await registrarCurriculo(id, dados, enviado!);
      if (msg) { setErro(msg); return; }
      (form.current?.closest("dialog") as HTMLDialogElement | null)?.close();
      form.current?.reset();
      setArquivo(null);
      avisar(editando ? "Currículo alterado" : "Currículo salvo");
      if (editando) router.refresh();
      else router.push(`/curriculos/${id}`);
    } catch {
      setErro("Não foi possível enviar. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
      setEstado(null);
    }
  }

  return (
    <form ref={form} onSubmit={enviar} className="grid gap-4">
      <Campo rotulo={editando ? "Trocar o arquivo (opcional)" : "Arquivo do currículo *"}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
          onChange={(e) => escolher(e.target.files)}
          className={`${inputCls} file:mr-3 file:rounded-md file:border-0 file:bg-madeira-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-madeira-800`}
        />
      </Campo>
      <p className="-mt-2 text-xs text-stone-500">
        {editando
          ? <>Arquivo atual: <strong>{curriculo.nome_arquivo}</strong>. Se escolher outro, o atual é substituído.</>
          : <>PDF, foto ou Word, até 50 MB.{arquivo && <> Escolhido: <strong>{arquivo.name}</strong> · {tamanhoLegivel(arquivo.size)}</>}</>}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da pessoa *"><input name="nome" required defaultValue={curriculo?.nome ?? ""} className={inputCls} /></Campo>
        <Campo rotulo="Vaga / função"><input name="vaga" defaultValue={curriculo?.vaga ?? ""} placeholder="Ex.: montador, marceneiro, vendedora" className={inputCls} /></Campo>
        <Campo rotulo="Telefone"><input name="telefone" defaultValue={curriculo?.telefone ?? ""} className={inputCls} /></Campo>
        <Campo rotulo="E-mail"><input name="email" type="email" defaultValue={curriculo?.email ?? ""} className={inputCls} /></Campo>
      </div>
      <Erro mensagem={erro} />
      <div className="flex items-center justify-end gap-3">
        {estado && <span className="text-xs text-stone-500">{estado}</span>}
        <button type="submit" disabled={enviando} className={estiloBotao.primario}>
          {enviando ? "Enviando…" : editando ? "Salvar" : "Salvar currículo"}
        </button>
      </div>
    </form>
  );
}
