"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { podeAbrir, type Papel } from "@/lib/acesso";
import { NAVEGACAO, localizar, type Aba, type Secao } from "@/lib/navegacao";
import { Icone } from "@/components/icones";
import { abrirBusca } from "./paleta";

/** Menu com as abas que o perfil pode abrir (as abas sem nenhuma sub-aba liberada somem), em ordem alfabética dentro de cada seção. */
export function menuDoPapel(papel: Papel): Secao[] {
  return NAVEGACAO.map((s) => ({
    ...s,
    abas: s.abas
      .map((a) => ({ ...a, filhos: a.filhos?.filter((f) => podeAbrir(papel, f.href.split("?")[0])) }))
      .filter((a) => (a.href ? podeAbrir(papel, a.href) : (a.filhos?.length ?? 0) > 0))
      // dentro de cada seção, as abas ficam em ordem alfabética
      .sort((x, y) => x.rotulo.localeCompare(y.rotulo, "pt-BR")),
  })).filter((s) => s.abas.length);
}

export function Menu({ papel, marca, rodape }: { papel: Papel; marca: ReactNode; rodape: ReactNode }) {
  const caminho = usePathname();
  const busca = useSearchParams().toString();
  const [aberto, setAberto] = useState(false);
  const atual = localizar(caminho, busca);
  const secoes = menuDoPapel(papel);

  return (
    <>
      <div className="flex items-center justify-between px-1">
        {marca}
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-expanded={aberto}
          aria-label="Abrir menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-stone-900 md:hidden"
        >
          <Icone nome={aberto ? "fechar" : "menu"} className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`${aberto ? "flex" : "hidden"} min-h-0 flex-1 flex-col gap-5 md:flex`}
        onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setAberto(false); }}
      >
        <button
          type="button"
          onClick={() => { setAberto(false); abrirBusca(); }}
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-stone-500 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-stone-800"
        >
          <Icone nome="busca" className="h-4 w-4" />
          <span className="flex-1">Pesquisar</span>
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-px font-mono text-[10px] text-stone-500">Ctrl K</kbd>
        </button>

        <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-2">
          {secoes.map((s, i) => (
            <div key={s.titulo ?? i} className="flex flex-col gap-0.5">
              {s.titulo && <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">{s.titulo}</div>}
              {s.abas.map((a) => (
                <ItemAba
                  key={a.rotulo}
                  aba={a}
                  ativa={atual?.aba.rotulo === a.rotulo}
                />
              ))}
            </div>
          ))}
        </nav>
        {rodape}
      </div>
    </>
  );
}

/** Aba do menu: sempre uma linha só. Se tiver sub-abas, abre a primeira; as outras ficam no topo da tela. */
function ItemAba({ aba, ativa }: { aba: Aba; ativa: boolean }) {
  const cor = ativa ? "bg-white/[0.08] font-medium text-stone-900" : "text-stone-500 hover:bg-white/[0.04] hover:text-stone-800";
  return (
    <Link href={aba.href ?? aba.filhos![0].href} className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${cor}`} aria-current={ativa ? "page" : undefined}>
      {ativa && <span className="absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-ciano" />}
      <Icone nome={aba.icone} />
      <span className="flex-1 truncate">{aba.rotulo}</span>
    </Link>
  );
}

/** Sub-abas da aba aberta, mostradas no topo da tela (some quando a aba não tem sub-abas). */
export function AbasDoGrupo({ papel }: { papel: Papel }) {
  const caminho = usePathname();
  const busca = useSearchParams().toString();
  const atual = localizar(caminho, busca);
  if (!atual?.folha) return null;
  const aba = menuDoPapel(papel).flatMap((s) => s.abas).find((a) => a.rotulo === atual.aba.rotulo);
  const filhos = aba?.filhos ?? [];
  if (filhos.length < 2 || caminho !== atual.folha.href.split("?")[0]) return null;
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-stone-200 text-sm print:hidden" aria-label={aba!.rotulo}>
      {filhos.map((f) => {
        const sel = atual.folha?.href === f.href;
        return (
          <Link key={f.href} href={f.href} title={f.dica} aria-current={sel ? "page" : undefined} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 font-medium transition ${sel ? "border-violeta text-stone-900" : "border-transparent text-stone-500 hover:text-stone-900"}`}>
            {f.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
