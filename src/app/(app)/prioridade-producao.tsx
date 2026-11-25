"use client";

import { useState, useTransition } from "react";
import { Cartao, estiloBotao, inputCls } from "@/components/ui";
import { Icone } from "@/components/icones";
import { avisar } from "@/components/acoes";
import { adicionarPrioridade, editarPrioridade, ordenarPrioridades, tirarPrioridade } from "./prioridade-actions";

type Item = { id: string; texto: string };

/**
 * Prioridade de produção (Painel): os próximos clientes a produzir, em ordem.
 * Arraste a linha ou use as setas para mudar a ordem; clique no texto para editar.
 */
export function PrioridadeProducao({ itens: iniciais }: { itens: Item[] }) {
  const [itens, setItens] = useState(iniciais);
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // quando a lista chega de novo do servidor (salvou, ou outra pessoa mudou), mostra a versão nova
  const [anteriores, setAnteriores] = useState(iniciais);
  if (anteriores !== iniciais) {
    setAnteriores(iniciais);
    setItens(iniciais);
  }

  const rodar = (acao: () => Promise<void>, ok?: string) =>
    iniciar(async () => {
      try {
        await acao();
        if (ok) avisar(ok);
      } catch {
        avisar("Não deu para salvar. Tente de novo.", true);
        setItens(iniciais);
      }
    });

  const reordenar = (lista: Item[]) => {
    setItens(lista);
    rodar(() => ordenarPrioridades(lista.map((i) => i.id)));
  };
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= itens.length || de === para) return;
    const lista = [...itens];
    const [tirado] = lista.splice(de, 1);
    lista.splice(para, 0, tirado);
    reordenar(lista);
  };

  const adicionar = () => {
    const texto = novo.trim();
    if (!texto) return;
    setNovo("");
    setItens((l) => [...l, { id: `novo-${Date.now()}`, texto }]);
    rodar(() => adicionarPrioridade(texto), "Adicionado à lista");
  };
  const salvarEdicao = (id: string) => {
    const texto = rascunho.trim();
    setEditando(null);
    if (!texto || texto === itens.find((i) => i.id === id)?.texto) return;
    setItens((l) => l.map((i) => (i.id === id ? { ...i, texto } : i)));
    rodar(() => editarPrioridade(id, texto), "Salvo");
  };
  const tirar = (item: Item) => {
    if (!window.confirm(`Tirar "${item.texto}" da lista de prioridade?`)) return;
    setItens((l) => l.filter((i) => i.id !== item.id));
    rodar(() => tirarPrioridade(item.id), "Tirado da lista");
  };

  const metade = Math.max(1, Math.ceil(itens.length / 2));
  const botaoIcone = "flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-bege/60 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-violeta">Prioridade de produção</h2>
      <Cartao className="filete">
        {itens.length ? (
          <ol
            className="grid gap-x-8 text-sm lg:grid-flow-col"
            style={{ gridTemplateRows: `repeat(${metade}, minmax(0, auto))` }}
          >
            {itens.map((item, i) => (
              <li
                key={item.id}
                draggable={editando !== item.id}
                onDragStart={() => setArrastando(item.id)}
                onDragEnd={() => setArrastando(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const de = itens.findIndex((x) => x.id === arrastando);
                  if (de >= 0) mover(de, i);
                  setArrastando(null);
                }}
                className={`group flex items-center gap-3 border-b border-stone-100 py-2 ${arrastando === item.id ? "opacity-40" : ""} ${editando !== item.id ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${i < 3 ? "bg-laranja text-white" : "bg-bege text-stone-800"}`}>
                  {i + 1}
                </span>
                {editando === item.id ? (
                  <input
                    autoFocus
                    value={rascunho}
                    onChange={(e) => setRascunho(e.target.value)}
                    onBlur={() => salvarEdicao(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") salvarEdicao(item.id);
                      if (e.key === "Escape") setEditando(null);
                    }}
                    className={`${inputCls} min-w-0 flex-1 py-1!`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditando(item.id); setRascunho(item.texto); }}
                    title="Clique para editar"
                    className="min-w-0 flex-1 truncate text-left font-medium text-stone-800 transition hover:text-laranja"
                  >
                    {item.texto}
                  </button>
                )}
                <span className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <button type="button" className={botaoIcone} onClick={() => mover(i, i - 1)} disabled={i === 0} title="Subir">
                    <Icone nome="seta" className="h-4 w-4 -rotate-90" />
                  </button>
                  <button type="button" className={botaoIcone} onClick={() => mover(i, i + 1)} disabled={i === itens.length - 1} title="Descer">
                    <Icone nome="seta" className="h-4 w-4 rotate-90" />
                  </button>
                  <button type="button" className={botaoIcone} onClick={() => tirar(item)} title="Tirar da lista">
                    <Icone nome="lixeira" className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-stone-400">Nenhum cliente na lista. Adicione abaixo.</p>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); adicionar(); }}
          className="mt-4 flex gap-2"
        >
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Adicionar cliente no fim da lista (ex.: Ana e Pedro PT1)"
            className={`${inputCls} min-w-0 flex-1`}
          />
          <button type="submit" disabled={!novo.trim()} className={estiloBotao.primario}>
            <Icone nome="mais" className="h-4 w-4" /> Adicionar
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-400">Arraste a linha ou use as setas para mudar a ordem. Clique no nome para editar.</p>
      </Cartao>
    </section>
  );
}
