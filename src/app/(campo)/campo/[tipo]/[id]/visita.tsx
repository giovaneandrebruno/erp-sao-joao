"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { anexarFotos, fazerCheckin } from "../../actions";

/** Reduz a foto do celular para no máximo 1600 px antes de enviar. */
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

export function Checkin({ tipo, id }: { tipo: "marco" | "chamado"; id: string }) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function registrar() {
    const enviar = (lat: number | null, lng: number | null) =>
      iniciar(async () => {
        await fazerCheckin(tipo, id, lat, lng);
      });
    if (!navigator.geolocation) return enviar(null, null);
    setAviso("Pegando a localização…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setAviso(null); enviar(p.coords.latitude, p.coords.longitude); },
      () => { setAviso("Sem localização: registrando assim mesmo."); enviar(null, null); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div>
      <button onClick={registrar} disabled={pendente} className="w-full rounded-2xl bg-marinho py-4 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgb(19_41_75/0.8)] disabled:opacity-60">
        {pendente ? "Registrando…" : "📍 Cheguei no cliente"}
      </button>
      {aviso && <p className="mt-2 text-center text-xs text-stone-500">{aviso}</p>}
    </div>
  );
}

export function EnviarFotos({ tipo, id, visitaId }: { tipo: "marco" | "chamado"; id: string; visitaId: string }) {
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
      const caminho = `${tipo}/${id}/${Date.now()}-${i}.jpg`;
      const { error } = await supabase.storage.from("fotos").upload(caminho, blob, { contentType: "image/jpeg" });
      if (error) { setEstado(`Erro ao enviar: ${error.message}`); return; }
      caminhos.push(caminho);
    }
    iniciar(async () => {
      await anexarFotos(tipo, id, visitaId, caminhos);
      setEstado(`${caminhos.length} foto(s) enviada(s).`);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
      <button type="button" disabled={pendente} onClick={() => input.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-violeta/40 bg-violeta/5 py-4 text-base font-semibold text-violeta">
        📷 Tirar / enviar fotos
      </button>
      {estado && <p className="mt-2 text-center text-xs text-stone-500">{estado}</p>}
    </div>
  );
}
