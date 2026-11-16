"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { localizar } from "@/lib/navegacao";
import { Icone } from "@/components/icones";
import { abrirBusca } from "./paleta";

/** Barra do topo: onde a pessoa está (seção / aba / sub-aba) e o campo de pesquisa. */
export function Barra() {
  const caminho = usePathname();
  const busca = useSearchParams().toString();
  const atual = localizar(caminho, busca);
  const partes: { rotulo: string; href?: string }[] = [];
  if (atual?.secao) partes.push({ rotulo: atual.secao });
  if (atual?.aba && atual.folha) partes.push({ rotulo: atual.aba.rotulo, href: atual.aba.filhos?.[0]?.href });
  const ultimo = atual?.folha?.rotulo ?? atual?.aba.rotulo ?? "Painel";
  const detalhe = atual && caminho !== (atual.folha?.href ?? atual.aba.href ?? "").split("?")[0];

  return (
    <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
      <nav aria-label="Você está em" className="flex min-w-0 items-center gap-2 text-[13px]">
        {partes.map((p) => (
          <span key={p.rotulo} className="flex items-center gap-2 text-stone-400">
            {p.href ? <Link href={p.href} className="transition hover:text-stone-700">{p.rotulo}</Link> : <span>{p.rotulo}</span>}
            <span className="text-stone-300">/</span>
          </span>
        ))}
        {detalhe ? (
          <>
            <Link href={(atual.folha?.href ?? atual.aba.href)!} className="text-stone-400 transition hover:text-stone-700">{ultimo}</Link>
            <span className="text-stone-300">/</span>
            <span className="truncate font-medium text-stone-900">{/\/(novo|nova)$/.test(caminho) ? "Novo cadastro" : "Detalhes"}</span>
          </>
        ) : (
          <span className="truncate font-medium text-stone-900">{ultimo}</span>
        )}
      </nav>
      <button
        type="button"
        onClick={abrirBusca}
        className="flex w-10 items-center justify-center gap-2.5 rounded-lg border border-stone-200 bg-white py-2 text-sm text-stone-400 shadow-[0_1px_2px_rgb(15_29_51/0.04)] transition hover:border-stone-300 hover:text-stone-600 sm:w-72 sm:justify-start sm:px-3"
      >
        <Icone nome="busca" className="h-4 w-4" />
        <span className="hidden flex-1 text-left sm:block">Pesquisar no sistema</span>
        <kbd className="hidden rounded border border-stone-200 bg-stone-50 px-1.5 py-px font-mono text-[10px] text-stone-400 sm:block">Ctrl K</kbd>
      </button>
    </div>
  );
}
