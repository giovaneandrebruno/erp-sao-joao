"use client";

import { useMemo, useState, useTransition } from "react";
import { Botao, Erro, inputCls } from "@/components/ui";
import { agruparPorAmbiente, lerPlanilha } from "@/lib/importar";
import { brl } from "@/lib/format";
import { importarItens } from "./actions";

export function ImportarProjeto({ orcamentoId, markup }: { orcamentoId: string; markup: number }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [agrupar, setAgrupar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const { linhas, avisos } = useMemo(() => (texto.trim() ? lerPlanilha(texto) : { linhas: [], avisos: [] }), [texto]);
  const finais = agrupar ? agruparPorAmbiente(linhas) : linhas;
  const venda = (l: (typeof finais)[number]) => l.preco_unitario ?? (l.custo_unitario ?? 0) * markup;
  const total = finais.reduce((s, l) => s + venda(l) * l.quantidade, 0);

  async function lerArquivo(f: File | undefined) {
    if (!f) return;
    const buf = await f.arrayBuffer();
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
    setTexto(t);
  }

  if (!aberto) {
    return <Botao variante="secundario" type="button" onClick={() => setAberto(true)}>Importar do projeto</Botao>;
  }

  return (
    <div className="vidro mb-8 rounded-2xl p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Importar itens do projeto</h3>
          <p className="text-sm text-stone-500">Exporte a lista de peças ou o orçamento do programa de projeto em planilha (CSV) e envie o arquivo, ou copie as linhas da planilha e cole abaixo. Colunas reconhecidas: ambiente, descrição, quantidade, custo, venda, largura, altura, profundidade.</p>
        </div>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-stone-400 hover:text-stone-700">fechar</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium hover:border-violeta/40">
          Escolher arquivo
          <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => lerArquivo(e.target.files?.[0])} />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} className="accent-violeta" />
          Juntar as peças numa linha por ambiente
        </label>
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder={"Ambiente;Descrição;Qtd;Custo\nCozinha;Armário aéreo 3 portas;1;1.250,00"} className={`${inputCls} w-full font-mono text-xs`} />
      {avisos.map((a) => <p key={a} className="mt-1 text-xs text-stone-500">{a}</p>)}

      {finais.length > 0 && (
        <>
          <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-stone-50 text-stone-500">
                <tr><th className="px-3 py-2">Ambiente</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Qtd</th><th className="px-3 py-2">Custo</th><th className="px-3 py-2">Venda</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {finais.slice(0, 200).map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{l.ambiente ?? "—"}</td>
                    <td className="px-3 py-1.5">{l.descricao}</td>
                    <td className="px-3 py-1.5">{l.quantidade}</td>
                    <td className="px-3 py-1.5">{brl(l.custo_unitario)}</td>
                    <td className="px-3 py-1.5">{brl(venda(l))}{l.preco_unitario == null && <span className="text-stone-400"> (markup)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-stone-600">{finais.length} linha(s) · venda {brl(total)}</span>
            <Botao
              type="button"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  const e = await importarItens(orcamentoId, finais);
                  setErro(e);
                  if (!e) { setTexto(""); setAberto(false); }
                })
              }
            >
              {pendente ? "Importando…" : `Adicionar ${finais.length} item(ns)`}
            </Botao>
          </div>
        </>
      )}
      <div className="mt-2"><Erro mensagem={erro} /></div>
    </div>
  );
}
