"use client";

import { useState } from "react";
import { Botao, Campo, inputCls } from "@/components/ui";
import { CAMPOS, GRUPOS, POSICOES, STATUS_PCP, diasEntre, somarDias, textoDias } from "@/lib/pcp";
import { data } from "@/lib/format";
import { salvarOrdem } from "./actions";

type Valores = Record<string, string | number | null>;

const DICA_MARCO = "OK, uma data (dd/mm/aaaa), ? ou -";

export function FormOrdem({ ordem, clientes, hoje }: { ordem?: Valores & { id: string }; clientes: { id: string; nome: string }[]; hoje: string }) {
  const v = (k: string) => (ordem?.[k] ?? "") as string;
  const [dataVenda, setDataVenda] = useState(v("data_venda"));
  const [dias, setDias] = useState(String(ordem?.prazo_dias ?? ""));
  const [limiteFixo, setLimiteFixo] = useState(v("prazo_limite"));
  const limite = limiteFixo || (dataVenda && Number(dias) > 0 ? somarDias(dataVenda, Number(dias)) : "");

  return (
    <form action={salvarOrdem.bind(null, ordem?.id ?? null)} className="flex flex-col gap-6">
      {GRUPOS.map((grupo) => (
        <fieldset key={grupo} className="rounded-xl border border-stone-200 p-4">
          <legend className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{grupo}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {grupo === "Comercial" && (
              <>
                <Campo rotulo="Cliente do cadastro" className="sm:col-span-2">
                  <select name="cliente_id" defaultValue={v("cliente_id")} className={inputCls}>
                    <option value="">— escolher —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Ambiente / parte">
                  <input name="ambiente" defaultValue={v("ambiente")} placeholder="Ex.: Cozinha, Parte 2" className={inputCls} />
                </Campo>
              </>
            )}
            {CAMPOS.filter((c) => c.grupo === grupo).map((c) => {
              if (c.chave === "status_pcp")
                return (
                  <Campo key={c.chave} rotulo="Status">
                    <select name="status_pcp" defaultValue={v("status_pcp") || "VR"} className={inputCls}>
                      {STATUS_PCP.map((s) => <option key={s.sigla} value={s.sigla}>{s.sigla} · {s.nome}</option>)}
                    </select>
                  </Campo>
                );
              if (c.chave === "posicao")
                return (
                  <Campo key={c.chave} rotulo="Posição">
                    <input name="posicao" list="posicoes" defaultValue={v("posicao")} className={inputCls} />
                    <datalist id="posicoes">{POSICOES.map((p) => <option key={p} value={p} />)}</datalist>
                  </Campo>
                );
              if (c.chave === "data_venda")
                return (
                  <Campo key={c.chave} rotulo="Data venda">
                    <input name="data_venda" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} className={inputCls} />
                  </Campo>
                );
              if (c.chave === "prazo_texto")
                return (
                  <div key={c.chave} className="grid gap-4 sm:col-span-2 lg:col-span-4 lg:grid-cols-4">
                    <Campo rotulo="Prazo a cumprir (dias)">
                      <input name="prazo_dias" type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="60" className={inputCls} />
                    </Campo>
                    <Campo rotulo="Ou data limite fixa">
                      <input name="prazo_limite" type="date" value={limiteFixo} onChange={(e) => setLimiteFixo(e.target.value)} className={inputCls} />
                    </Campo>
                    <Campo rotulo="Anotação do prazo">
                      <input name="prazo_texto" defaultValue={v("prazo_texto")} placeholder="Ex.: 70 DIAS EXATO" className={inputCls} />
                    </Campo>
                    <div className="flex flex-col justify-end rounded-lg bg-stone-50 px-3 py-2 text-sm ring-1 ring-inset ring-stone-200">
                      <span className="text-xs text-stone-500">Entrega limite (venda + prazo)</span>
                      {limite ? (
                        <span className={`font-semibold ${diasEntre(hoje, limite) < 0 ? "text-rosa" : "text-stone-900"}`}>
                          {data(limite)} · {textoDias(diasEntre(hoje, limite))}
                        </span>
                      ) : (
                        <span className="text-stone-400">informe a data da venda e o prazo</span>
                      )}
                    </div>
                  </div>
                );
              const largo = c.tipo === "longo" || c.chave === "endereco" || c.chave === "cliente_nome";
              return (
                <Campo key={c.chave} rotulo={c.chave === "cliente_nome" ? "Cliente (como aparece na OS)" : c.rotulo} className={largo ? "sm:col-span-2" : ""}>
                  {c.tipo === "longo" ? (
                    <textarea name={c.chave} rows={2} defaultValue={v(c.chave)} className={inputCls} />
                  ) : (
                    <input name={c.chave} defaultValue={v(c.chave)} placeholder={c.tipo === "marco" ? DICA_MARCO : c.dica} className={inputCls} />
                  )}
                </Campo>
              );
            })}
            {grupo === "Comercial" && ordem?.data_venda_obs && (
              <Campo rotulo="Obs. da data da venda (planilha)">
                <input name="data_venda_obs" defaultValue={v("data_venda_obs")} className={inputCls} />
              </Campo>
            )}
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-stone-500">Nas etapas, escreva <b>OK</b> quando concluída, a <b>data</b> combinada, <b>?</b> se ainda não sabe ou <b>-</b> se não se aplica, igual na planilha.</p>
      <div>
        <Botao type="submit">Salvar ordem de serviço</Botao>
      </div>
    </form>
  );
}
