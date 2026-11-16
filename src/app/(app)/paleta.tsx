"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { podeAbrir, type Papel } from "@/lib/acesso";
import { ACOES_RAPIDAS, telas } from "@/lib/navegacao";
import { Icone, type NomeDoIcone } from "@/components/icones";
import { buscarRegistros, type Registro } from "./busca";

const EVENTO = "emob:abrir-busca";

/** Abre a busca rápida de qualquer lugar (botões do menu e do topo). */
export function abrirBusca() {
  window.dispatchEvent(new Event(EVENTO));
}

type Item = { chave: string; grupo: string; icone: NomeDoIcone; titulo: string; sub?: string; direita?: string; href: string };

const ICONE_TIPO: Record<string, NomeDoIcone> = {
  Cliente: "pessoa",
  Pedido: "pedidos",
  Orçamento: "documento",
  Negociação: "vendas",
  Produto: "caixa",
  Fornecedor: "estoque",
};

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca rápida (Ctrl+K): abre por cima da tela, com o fundo escurecido.
 * Procura telas do sistema, cadastros (clientes, pedidos, orçamentos...) e ações rápidas.
 */
export function Paleta({ papel }: { papel: Papel }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [sel, setSel] = useState(0);
  const [buscando, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => !a);
      }
    };
    const abrir = () => setAberta(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener(EVENTO, abrir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener(EVENTO, abrir);
    };
  }, []);

  useEffect(() => {
    if (aberta) setTimeout(() => entrada.current?.focus(), 0);
  }, [aberta]);

  // procura nos cadastros um pouco depois que a pessoa para de digitar
  useEffect(() => {
    if (!aberta) return;
    const t = termo.trim();
    const id = setTimeout(() => {
      if (t.length < 2) {
        iniciar(() => setRegistros([]));
        return;
      }
      iniciar(async () => {
        const r = await buscarRegistros(t);
        setRegistros(r);
      });
    }, 220);
    return () => clearTimeout(id);
  }, [termo, aberta]);

  const itens = useMemo<Item[]>(() => {
    const q = normal(termo.trim());
    const bate = (...s: (string | undefined)[]) => !q || s.some((x) => x && normal(x).includes(q));
    const modulos = telas()
      .filter((t) => podeAbrir(papel, t.href.split("?")[0]))
      .filter((t) => bate(t.rotulo, t.caminho, t.dica))
      .slice(0, q ? 6 : 5)
      .map((t) => ({ chave: `t:${t.href}`, grupo: "Telas", icone: "painel" as NomeDoIcone, titulo: t.rotulo, sub: t.caminho, direita: t.dica, href: t.href }));
    const recs = registros.map((r, i) => ({ chave: `r:${i}:${r.href}`, grupo: "Cadastros", icone: ICONE_TIPO[r.tipo] ?? "documento", titulo: r.titulo, sub: [r.tipo, r.sub].filter(Boolean).join(" · "), direita: r.extra, href: r.href }));
    const acoes = ACOES_RAPIDAS.filter((a) => podeAbrir(papel, a.href.split("?")[0]))
      .filter((a) => bate(a.rotulo))
      .map((a) => ({ chave: `a:${a.href}`, grupo: "Ações rápidas", icone: "raio" as NomeDoIcone, titulo: a.rotulo, sub: "Ação", href: a.href }));
    return [...modulos, ...recs, ...acoes];
  }, [termo, registros, papel]);

  const indice = Math.min(sel, Math.max(itens.length - 1, 0));

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const fechar = () => {
    setAberta(false);
    setTermo("");
    setRegistros([]);
    setSel(0);
  };
  const ir = (it?: Item) => {
    if (!it) return;
    fechar();
    router.push(it.href);
  };

  if (!aberta) return null;

  let grupoAnterior = "";
  return (
    <div className="janela-fundo fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh] print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Pesquisar" className="janela-caixa flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgb(8_16_30/0.6)] ring-1 ring-stone-900/5">
        <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
          <Icone nome="busca" className="h-5 w-5 text-stone-400" />
          <input
            ref={entrada}
            value={termo}
            onChange={(e) => { setTermo(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, itens.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); ir(itens[indice]); }
              else if (e.key === "Escape") { e.preventDefault(); fechar(); }
            }}
            placeholder="Pesquisar clientes, pedidos, orçamentos, produtos ou telas…"
            className="flex-1 bg-transparent text-[15px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          {buscando ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-azul" /> : <kbd className="rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-400">esc</kbd>}
        </div>

        <div ref={lista} className="flex-1 overflow-y-auto px-2 py-2">
          {!itens.length && (
            <p className="px-4 py-10 text-center text-sm text-stone-400">{buscando ? "Procurando…" : `Nada encontrado para “${termo}”.`}</p>
          )}
          {itens.map((it, i) => {
            const cabecalho = it.grupo !== grupoAnterior ? it.grupo : null;
            grupoAnterior = it.grupo;
            const ativo = i === indice;
            return (
              <div key={it.chave}>
                {cabecalho && <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">{cabecalho}</div>}
                <button
                  type="button"
                  data-indice={i}
                  onMouseMove={() => setSel(i)}
                  onClick={() => ir(it)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${ativo ? "bg-stone-100" : ""}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ativo ? "bg-white text-azul shadow-sm ring-1 ring-stone-200" : "text-stone-400"}`}>
                    <Icone nome={it.icone} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-900">{it.titulo}</span>
                    {it.sub && <span className="block truncate text-xs text-madeira-600">{it.sub}</span>}
                  </span>
                  {it.direita && <span className="hidden shrink-0 text-xs text-stone-400 sm:block">{it.direita}</span>}
                  {ativo && <Icone nome="enter" className="h-4 w-4 shrink-0 text-stone-400" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-stone-200 bg-stone-50/70 px-5 py-2.5 text-[11px] text-stone-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><kbd className="font-mono">↑ ↓</kbd> navegar</span>
            <span className="flex items-center gap-1.5"><kbd className="font-mono">↵</kbd> abrir</span>
            <span className="flex items-center gap-1.5"><kbd className="font-mono">esc</kbd> fechar</span>
          </div>
          <span>Procurando em <strong className="font-medium text-stone-700">todo o sistema</strong></span>
        </div>
      </div>
    </div>
  );
}
