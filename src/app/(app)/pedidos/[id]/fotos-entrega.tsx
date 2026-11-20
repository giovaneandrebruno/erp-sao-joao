"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { estiloBotao } from "@/components/ui";
import { anexarFotosEntrega } from "../materiais-entrega";

/** Reduz a foto para no máximo 1600 px antes de enviar. */
async function comprimir(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith("image/")) return arquivo;
  const bmp = await createImageBitmap(arquivo).catch(() => null);
  if (!bmp) return arquivo;
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.8));
}

export function FotosEntrega({ pedidoId }: { pedidoId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const supabase = createClient();
    const caminhos: string[] = [];
    for (const [i, arq] of Array.from(arquivos).entries()) {
      setEstado(`Enviando foto ${i + 1} de ${arquivos.length}…`);
      const blob = await comprimir(arq);
      const caminho = `entrega/${pedidoId}/${Date.now()}-${i}.jpg`;
      const { error } = await supabase.storage.from("fotos").upload(caminho, blob, { contentType: "image/jpeg" });
      if (error) { setEstado(`Erro ao enviar: ${error.message}`); return; }
      caminhos.push(caminho);
    }
    iniciar(async () => {
      const msg = await anexarFotosEntrega(pedidoId, caminhos);
      setEstado(msg ?? `${caminhos.length} foto(s) enviada(s).`);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
      <button type="button" disabled={pendente} onClick={() => input.current?.click()} className={estiloBotao.secundario}>
        Enviar fotos
      </button>
      {estado && <span className="text-xs text-stone-500">{estado}</span>}
    </div>
  );
}
