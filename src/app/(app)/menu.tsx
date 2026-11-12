"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { podeAbrir, type Papel } from "@/lib/acesso";
import { NAVEGACAO, localizar, type Aba, type Secao } from "@/lib/navegacao";
import { Icone } from "@/components/icones";
import { abrirBusca } from "./paleta";

/** Menu com as abas que o perfil pode abrir (as abas sem nenhuma sub-aba liberada somem). */
export function menuDoPapel(papel: Papel): Secao[] {
  return NAVEGACAO.map((s) => ({
    ...s,
    abas: s.abas
      .map((a) => ({ ...a, filhos: a.filhos?.filter((f) => podeAbrir(papel, f.href.split("?")[0])) }))
      .filter((a) => (a.href ? podeAbrir(papel, a.href) : (a.filhos?.length ?? 0) > 0)),
  })).filter((s) => s.abas.length);
}

export function Menu({ papel, marca, rodape }: { papel: Papel; marca: ReactNode; rodape: ReactNode }) {
  const caminho = usePathname();
  const busca = useSearchParams().toString();
  const [aberto, setAberto] = useState(false);
  const atual = localizar(caminho, busca);
  const secoes = menuDoPapel(papel);

  // a aba da tela atual fica aberta; o usuário pode abrir ou fechar qualquer uma
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());
  const expandida = (rotulo: string) => abertas.has(rotulo) || (atual?.aba.rotulo === rotulo && !fechadas.has(rotulo));
  const alternar = (rotulo: string) => {
    const tira = (c: Set<string>) => { const n = new Set(c); n.delete(rotulo); return n; };
    const poe = (c: Set<string>) => new Set(c).add(rotulo);
    if (expandida(rotulo)) { setAbertas(tira); setFechadas(poe); }
    else { setAbertas(poe); setFechadas(tira); }
  };

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
                  folhaAtiva={atual?.folha?.href}
                  expandida={expandida(a.rotulo)}
                  alternar={() => alternar(a.rotulo)}
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

function ItemAba({ aba, ativa, folhaAtiva, expandida, alternar }: { aba: Aba; ativa: boolean; folhaAtiva?: string; expandida: boolean; alternar: () => void }) {
  const base = `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors`;
  const marcador = ativa && <span className="absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-ciano" />;
  const cor = ativa ? "bg-white/[0.08] font-medium text-stone-900" : "text-stone-500 hover:bg-white/[0.04] hover:text-stone-800";

  if (!aba.filhos) {
    return (
      <Link href={aba.href!} className={`${base} ${cor}`} aria-current={ativa ? "page" : undefined}>
        {marcador}
        <Icone nome={aba.icone} />
        <span className="flex-1 truncate">{aba.rotulo}</span>
      </Link>
    );
  }

  return (
    <div>
      <button type="button" onClick={alternar} aria-expanded={expandida} className={`${base} ${ativa && !expandida ? cor : ativa ? "font-medium text-stone-900 hover:bg-white/[0.04]" : cor}`}>
        {ativa && !expandida && marcador}
        <Icone nome={aba.icone} />
        <span className="flex-1 truncate text-left">{aba.rotulo}</span>
        <Icone nome="seta" className={`h-3.5 w-3.5 text-stone-400 transition-transform ${expandida ? "rotate-90" : ""}`} />
      </button>
      {expandida && (
        <div className="mb-1 ml-[21px] mt-0.5 flex flex-col border-l border-white/10">
          {aba.filhos.map((f) => {
            const sel = folhaAtiva === f.href;
            return (
              <Link
                key={f.href}
                href={f.href}
                aria-current={sel ? "page" : undefined}
                className={`relative -ml-px flex items-center rounded-r-md border-l py-1.5 pl-4 pr-3 text-[13px] transition-colors ${sel ? "border-ciano bg-white/[0.08] font-medium text-stone-900" : "border-transparent text-stone-500 hover:border-white/25 hover:text-stone-800"}`}
              >
                <span className="truncate">{f.rotulo}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
