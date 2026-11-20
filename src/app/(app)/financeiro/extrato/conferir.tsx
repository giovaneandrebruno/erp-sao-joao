"use client";

import { useState, useTransition } from "react";
import { lerPlanilhaArquivo } from "@/lib/planilha";
import { Botao, Cartao, Selo } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { brl, data } from "@/lib/format";
import { conferirExtrato, darBaixaPeloExtrato, type MovimentoBanco, type Par } from "./actions";

const simples = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "1.234,56", "-R$ 50,00", "1234.56", "50,00 D" → número (saída fica negativa). */
function dinheiro(bruto: string) {
  let t = String(bruto ?? "").trim();
  if (!t) return NaN;
  const negativo = /^-|\(.*\)|\bD$/i.test(t) || /-$/.test(t);
  t = t.replace(/[^\d.,]/g, "");
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
}

function dataISO(bruto: string) {
  const t = String(bruto ?? "").trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function lerMovimentos(linhas: string[][]): MovimentoBanco[] {
  const iCab = linhas.findIndex((l) => l.some((c) => /^data/.test(simples(c))) && l.some((c) => /valor|credito|debito|entrada|saida/.test(simples(c))));
  if (iCab < 0) return [];
  const cab = linhas[iCab].map(simples);
  const iData = cab.findIndex((c) => /^data/.test(c));
  const iDesc = cab.findIndex((c) => /histor|descri|lancamento|detalhe/.test(c));
  const iValor = cab.findIndex((c) => /^valor/.test(c));
  const iCred = cab.findIndex((c) => /credito|entrada/.test(c));
  const iDeb = cab.findIndex((c) => /debito|saida/.test(c));
  const movs: MovimentoBanco[] = [];
  for (const l of linhas.slice(iCab + 1)) {
    const d = dataISO(l[iData]);
    if (!d) continue;
    let valor = iValor >= 0 ? dinheiro(l[iValor]) : NaN;
    if (!Number.isFinite(valor)) {
      const c = iCred >= 0 ? dinheiro(l[iCred]) : NaN;
      const db = iDeb >= 0 ? dinheiro(l[iDeb]) : NaN;
      valor = Number.isFinite(c) && c !== 0 ? Math.abs(c) : Number.isFinite(db) && db !== 0 ? -Math.abs(db) : NaN;
    }
    if (!Number.isFinite(valor) || valor === 0) continue;
    movs.push({ data: d, descricao: iDesc >= 0 ? l[iDesc] ?? "" : "", valor });
  }
  return movs;
}

export function ConferirExtrato() {
  const [pares, setPares] = useState<Par[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, iniciar] = useTransition();

  async function ler(arquivo: File | undefined) {
    setErro(null);
    setPares(null);
    if (!arquivo) return;
    try {
      const abas = await lerPlanilhaArquivo(arquivo);
      const movs = abas.flatMap((a) => lerMovimentos(a.linhas));
      if (!movs.length) { setErro("Não achei no extrato as colunas de data e valor (ou crédito e débito)."); return; }
      iniciar(async () => {
        const r = await conferirExtrato(movs);
        setPares(r);
        setEscolhidos(new Set(r.filter((p) => p.lancamento).map((p) => p.lancamento!.id)));
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o extrato.");
    }
  }

  const achados = pares?.filter((p) => p.lancamento) ?? [];
  const sem = pares?.filter((p) => !p.lancamento) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Cartao>
        <p className="mb-3 text-sm text-stone-600">Baixe o extrato no site do banco em planilha <b>.xlsx</b>, com as colunas <b>data</b> e <b>valor</b> (ou <b>crédito</b> e <b>débito</b>). O sistema procura as contas em aberto com o mesmo valor e vencimento próximo.</p>
        <input type="file" accept=".xlsx" onChange={(e) => ler(e.target.files?.[0])} className="text-sm" />
        {trabalhando && <p className="mt-2 text-sm text-stone-500">Conferindo…</p>}
        {erro && <p className="mt-3 rounded-lg bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-rosa/30">{erro}</p>}
      </Cartao>

      {pares && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-700"><b>{pares.length}</b> linhas no extrato · <b>{achados.length}</b> batem com contas em aberto · <b>{sem.length}</b> sem conta no sistema</p>
            <Botao
              type="button"
              disabled={!escolhidos.size || trabalhando}
              onClick={() => iniciar(async () => {
                const baixas = achados.filter((p) => escolhidos.has(p.lancamento!.id)).map((p) => ({ id: p.lancamento!.id, data: p.mov.data }));
                const msg = await darBaixaPeloExtrato(baixas);
                if (msg) { setErro(msg); return; }
                avisar(`${baixas.length} conta(s) marcada(s) como paga(s)`);
                setPares(pares.map((p) => (p.lancamento && escolhidos.has(p.lancamento.id) ? { ...p, baixado: true } : p)) as Par[]);
                setEscolhidos(new Set());
              })}
            >
              Marcar {escolhidos.size} como pagas
            </Botao>
          </div>
          <div className="vidro overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60 text-[11px] uppercase tracking-[0.12em] text-stone-500">
                  <th className="px-5 py-3"></th><th className="px-5 py-3">Data no banco</th><th className="px-5 py-3">Extrato</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Conta no sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {[...achados, ...sem].map((p, i) => {
                  const l = p.lancamento;
                  const feito = (p as Par & { baixado?: boolean }).baixado;
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3">
                        {l && !feito && (
                          <input
                            type="checkbox"
                            checked={escolhidos.has(l.id)}
                            onChange={(e) => { const s = new Set(escolhidos); if (e.target.checked) s.add(l.id); else s.delete(l.id); setEscolhidos(s); }}
                            className="h-4 w-4 accent-[#e37f33]"
                          />
                        )}
                      </td>
                      <td className="px-5 py-3">{data(p.mov.data)}</td>
                      <td className="px-5 py-3">{p.mov.descricao || "—"}</td>
                      <td className={`px-5 py-3 font-mono ${p.mov.valor < 0 ? "text-rosa" : "text-neon"}`}>{brl(p.mov.valor)}</td>
                      <td className="px-5 py-3">
                        {feito ? <Selo cor="green">Paga</Selo> : l ? <>{l.descricao} <span className="text-xs text-stone-500">· vence {data(l.vencimento)}</span></> : <span className="text-stone-400">Nenhuma conta em aberto com esse valor</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
