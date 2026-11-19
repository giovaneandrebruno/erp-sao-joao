"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icone } from "@/components/icones";
import { avisar } from "@/components/acoes";
import { estiloBotao, inputCls } from "@/components/ui";
import { brl } from "@/lib/format";
import { adicionarItem } from "./actions";

export type ProdutoCatalogo = { id: string; nome: string; preco_venda: number | string; tipo?: string | null; estoque_atual?: number | string | null; unidade_medida?: string | null };

const TIPO: Record<string, string> = { materia_prima: "Matéria-prima", produto: "Produto", servico: "Serviço" };
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "Procurar no catálogo": janela com busca. A pessoa digita parte do nome,
 * escolhe o produto (setas + Enter ou clique) e ele entra no orçamento com o preço do cadastro.
 */
export function ProcurarProduto({ orcamentoId, produtos, ambientes }: { orcamentoId: string; produtos: ProdutoCatalogo[]; ambientes: string[] }) {
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [sel, setSel] = useState(0);
  const [ambiente, setAmbiente] = useState(ambientes[0] ?? "");
  const [qtd, setQtd] = useState("1");
  const [salvando, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const achados = useMemo(() => {
    const partes = normal(termo.trim()).split(/\s+/).filter(Boolean);
    return produtos.filter((p) => partes.every((q) => normal(p.nome).includes(q))).slice(0, 50);
  }, [termo, produtos]);
  const indice = Math.min(sel, Math.max(achados.length - 1, 0));

  useEffect(() => {
    if (aberta) setTimeout(() => entrada.current?.focus(), 0);
  }, [aberta]);
  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const fechar = () => { setAberta(false); setTermo(""); setSel(0); };

  const adicionar = (p?: ProdutoCatalogo) => {
    if (!p || salvando) return;
    const fd = new FormData();
    fd.set("produto_id", p.id);
    fd.set("ambiente", ambiente);
    fd.set("quantidade", qtd || "1");
    iniciar(async () => {
      try {
        await adicionarItem(orcamentoId, fd);
        avisar(`${p.nome} adicionado`);
        fechar();
      } catch {
        avisar("Não foi possível adicionar o item.", true);
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setAberta(true)} className={estiloBotao.secundario}>
        <Icone nome="busca" className="h-4 w-4" /> Procurar no catálogo
      </button>
      {aberta && (
        <div className="janela-fundo fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
          <div role="dialog" aria-modal="true" aria-label="Procurar no catálogo" className="janela-caixa flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgb(26_26_26/0.6)] ring-1 ring-stone-900/5">
            <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
              <Icone nome="busca" className="h-5 w-5 text-stone-400" />
              <input
                ref={entrada}
                value={termo}
                onChange={(e) => { setTermo(e.target.value); setSel(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, achados.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); adicionar(achados[indice]); }
                  else if (e.key === "Escape") { e.preventDefault(); fechar(); }
                }}
                placeholder="Digite parte do nome do produto…"
                className="flex-1 bg-transparent text-[15px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              {salvando ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-azul" /> : <kbd className="rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-400">esc</kbd>}
            </div>

            <div ref={lista} className="flex-1 overflow-y-auto p-2">
              {!achados.length && (
                <p className="px-4 py-10 text-center text-sm text-stone-400">
                  {produtos.length ? `Nenhum produto com “${termo}”.` : "O catálogo ainda está vazio. Cadastre produtos em Estoque."}
                </p>
              )}
              {achados.map((p, i) => {
                const ativo = i === indice;
                const estoque = p.tipo === "servico" ? null : `estoque ${Number(p.estoque_atual ?? 0)} ${p.unidade_medida ?? "un"}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-indice={i}
                    onMouseMove={() => setSel(i)}
                    onClick={() => adicionar(p)}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-2.5 text-left transition ${ativo ? "bg-madeira-50 ring-1 ring-madeira-200" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-stone-900">{p.nome}</span>
                      <span className="block text-xs text-stone-500">{[p.tipo ? TIPO[p.tipo] : null, estoque].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-stone-900">{brl(p.preco_venda)}</span>
                      <span className={`w-28 text-right text-xs font-semibold text-madeira-700 ${ativo ? "" : "invisible"}`}>Enter ↵ adicionar</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-50 px-5 py-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-600">Ambiente</span>
                <input value={ambiente} onChange={(e) => setAmbiente(e.target.value)} list="ambientes-busca" placeholder="Cozinha" className={`${inputCls} w-40`} />
                <datalist id="ambientes-busca">
                  {Array.from(new Set([...ambientes, "Cozinha", "Dormitório casal", "Dormitório solteiro", "Banheiro", "Sala", "Home office", "Área de serviço", "Closet"])).map((a) => <option key={a} value={a} />)}
                </datalist>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-600">Qtd</span>
                <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" className={`${inputCls} w-20`} />
              </label>
              <button type="button" disabled={!achados.length || salvando} onClick={() => adicionar(achados[indice])} className={`${estiloBotao.primario} ml-auto disabled:opacity-50`}>
                Adicionar ao orçamento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
