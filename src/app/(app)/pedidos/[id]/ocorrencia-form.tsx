"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Botao, Campo, inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { TIPOS_OCORRENCIA } from "@/lib/processo";
import { registrarOcorrencia } from "../processo-actions";
import { comprimir } from "./fotos-entrega";

/** Registro de ocorrência da montagem (embalagem avariada, peça com defeito, cortes...), com fotos. */
export function FormOcorrencia({ pedidoId }: { pedidoId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const arquivos = (f.getAll("fotos") as File[]).filter((a) => a.size > 0);
    const supabase = createClient();
    const caminhos: string[] = [];
    for (const [i, arq] of arquivos.entries()) {
      setEstado(`Enviando foto ${i + 1} de ${arquivos.length}…`);
      const blob = await comprimir(arq);
      const caminho = `ocorrencias/${pedidoId}/${Date.now()}-${i}.jpg`;
      const { error } = await supabase.storage.from("fotos").upload(caminho, blob, { contentType: "image/jpeg" });
      if (error) { setEstado(`Erro ao enviar a foto: ${error.message}`); return; }
      caminhos.push(caminho);
    }
    iniciar(async () => {
      const erro = await registrarOcorrencia(pedidoId, {
        tipo: String(f.get("tipo") ?? ""),
        ambiente: String(f.get("ambiente") ?? "") || null,
        descricao: String(f.get("descricao") ?? ""),
        fotos: caminhos,
      });
      if (erro) { setEstado(erro); return; }
      setEstado(null);
      form.current?.reset();
      form.current?.closest("dialog")?.close();
      avisar("Ocorrência registrada");
    });
  }

  return (
    <form ref={form} onSubmit={enviar} data-manter-aberta className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Tipo *" className="md:col-span-3">
        <select name="tipo" required defaultValue="embalagem_avariada" className={inputCls}>
          {Object.entries(TIPOS_OCORRENCIA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Ambiente" className="md:col-span-3">
        <input name="ambiente" placeholder="Cozinha, suíte..." className={inputCls} />
      </Campo>
      <Campo rotulo="O que aconteceu *" className="md:col-span-6">
        <textarea name="descricao" required rows={3} placeholder="Código e tamanho da peça (da etiqueta), o defeito, o corte feito..." className={inputCls} />
      </Campo>
      <Campo rotulo="Fotos (da peça de longe, de perto e da etiqueta legível)" className="md:col-span-6">
        <input type="file" name="fotos" accept="image/*" multiple className={inputCls} />
      </Campo>
      <p className="text-xs text-stone-500 md:col-span-4">{estado ?? "O site guarda fotos. Se houver vídeo, descreva aqui o que ele mostra."}</p>
      <div className="flex justify-end md:col-span-2"><Botao type="submit" disabled={pendente}>Registrar</Botao></div>
    </form>
  );
}
