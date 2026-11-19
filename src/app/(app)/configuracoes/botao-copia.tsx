"use client";

import { useTransition } from "react";
import { estiloBotao } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { fazerCopiaAgora } from "./actions";

export function BotaoCopiaAgora() {
  const [fazendo, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={fazendo}
      className={`${estiloBotao.secundario} shrink-0 disabled:opacity-60`}
      onClick={() =>
        iniciar(async () => {
          const erro = await fazerCopiaAgora();
          avisar(erro ?? "Cópia feita e guardada", Boolean(erro));
        })
      }
    >
      {fazendo ? "Fazendo a cópia…" : "Fazer cópia agora"}
    </button>
  );
}
