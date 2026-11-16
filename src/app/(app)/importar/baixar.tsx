"use client";

import { useTransition } from "react";
import { linkArquivo } from "./actions";

export function BaixarArquivo({ caminho, nome }: { caminho: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => { const url = await linkArquivo(caminho); if (url) window.open(url, "_blank", "noopener"); })}
      className="max-w-64 truncate text-left text-madeira-800 hover:underline disabled:opacity-50"
      title="Baixar o arquivo original"
    >
      {nome}
    </button>
  );
}
