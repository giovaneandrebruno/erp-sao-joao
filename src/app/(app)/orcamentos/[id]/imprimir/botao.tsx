"use client";

export function BotaoImprimir() {
  return (
    <button onClick={() => window.print()} className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white">
      Imprimir / salvar PDF
    </button>
  );
}
