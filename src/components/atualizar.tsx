"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarrega os dados da tela de tempos em tempos (só quando a aba está visível). */
export function AtualizarSozinho({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
