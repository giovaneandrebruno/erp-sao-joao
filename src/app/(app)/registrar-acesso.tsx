"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { registrarAcesso } from "./redes/actions";

/** Avisa o servidor de cada tela aberta (para a aba Uso do site). Não mostra nada. */
export function RegistrarAcesso() {
  const caminho = usePathname();
  const busca = useSearchParams();
  // só as chaves que mudam de sub-aba; o resto (buscas digitadas, filtros) não é guardado
  const sub = ["aba", "ver"].map((k) => (busca.get(k) ? `${k}=${busca.get(k)}` : "")).filter(Boolean).join("&");
  const tela = sub ? `${caminho}?${sub}` : caminho;
  useEffect(() => {
    registrarAcesso(tela).catch(() => {});
  }, [tela]);
  return null;
}
