"use client";

import { useState } from "react";

export function Copiar({ texto, rotulo = "Copiar link" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(texto).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
      className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-violeta/40 hover:text-violeta"
    >
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}
