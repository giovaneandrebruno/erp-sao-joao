"use client";

import { useRef, useState, useTransition } from "react";
import { lerPlanilhaArquivo } from "@/lib/planilha";
import { Botao } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { importarMateriais, type MaterialImportado } from "../materiais-entrega";

type Produto = { id: string; codigo: string | null; nome: string; unidade_medida: string };

const simples = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const numeroBR = (s: string) => {
  const t = String(s ?? "").trim();
  const n = Number(/,\d{1,3}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Lê a lista de materiais de uma planilha .xlsx (a do programa de projeto, por exemplo):
 * uma coluna com o código ou o nome do material e outra com a quantidade.
 */
export function ImportarMateriais({ pedidoId, produtos }: { pedidoId: string; produtos: Produto[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<{ ok: (MaterialImportado & { nome: string; un: string })[]; fora: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  const porCodigo = new Map(produtos.filter((p) => p.codigo).map((p) => [simples(p.codigo!), p]));
  const porNome = new Map(produtos.map((p) => [simples(p.nome), p]));

  async function ler(arquivo: File | undefined) {
    setErro(null);
    setPrevia(null);
    if (!arquivo) return;
    try {
      const abas = await lerPlanilhaArquivo(arquivo);
      for (const aba of abas) {
        const iCab = aba.linhas.findIndex((l) => l.some((c) => /quant|qtd|qtde/i.test(c)) && l.some((c) => /material|descri|produto|item|c[oó]d/i.test(c)));
        if (iCab < 0) continue;
        const cab = aba.linhas[iCab].map((c) => simples(c));
        const iQtd = cab.findIndex((c) => /quant|qtd|qtde/.test(c));
        const iCod = cab.findIndex((c) => /^cod|codigo|referencia|ref\b/.test(c));
        const iNome = cab.findIndex((c) => /material|descri|produto|item|nome/.test(c));
        const soma = new Map<string, MaterialImportado & { nome: string; un: string }>();
        const fora: string[] = [];
        for (const l of aba.linhas.slice(iCab + 1)) {
          const qtd = numeroBR(l[iQtd]);
          const cod = iCod >= 0 ? simples(l[iCod] ?? "") : "";
          const nome = iNome >= 0 ? simples(l[iNome] ?? "") : "";
          if (!qtd || (!cod && !nome)) continue;
          const p = (cod && porCodigo.get(cod)) || (nome && (porNome.get(nome) ?? porCodigo.get(nome)));
          if (!p) { fora.push(`${l[iCod] ?? ""} ${l[iNome] ?? ""}`.trim()); continue; }
          const atual = soma.get(p.id);
          soma.set(p.id, { produto_id: p.id, quantidade: Math.round(((atual?.quantidade ?? 0) + qtd) * 1000) / 1000, nome: p.nome, un: p.unidade_medida });
        }
        setPrevia({ ok: [...soma.values()], fora: [...new Set(fora)] });
        return;
      }
      setErro("Não achei na planilha uma coluna de quantidade e outra com o código ou o nome do material.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-stone-600">A planilha precisa ter uma coluna de <b>quantidade</b> e outra com o <b>código</b> ou o <b>nome</b> do material, igual ao cadastro do Estoque. Linhas do mesmo material são somadas.</p>
      <input ref={input} type="file" accept=".xlsx" onChange={(e) => ler(e.target.files?.[0])} className="text-sm" />
      {erro && <p className="rounded-lg bg-rosa/10 p-3 text-rosa ring-1 ring-rosa/30">{erro}</p>}
      {previa && (
        <>
          <p><b>{previa.ok.length}</b> materiais reconhecidos{previa.fora.length ? <>, <b>{previa.fora.length}</b> não encontrados no Estoque</> : null}.</p>
          {previa.ok.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 p-2">
              {previa.ok.map((m) => <li key={m.produto_id} className="flex justify-between py-0.5"><span>{m.nome}</span><span className="font-mono">{m.quantidade} {m.un}</span></li>)}
            </ul>
          )}
          {previa.fora.length > 0 && (
            <details className="text-xs text-stone-500">
              <summary className="cursor-pointer">Ver os não encontrados (cadastre no Estoque e importe de novo)</summary>
              <ul className="mt-1 list-disc pl-5">{previa.fora.slice(0, 50).map((f) => <li key={f}>{f}</li>)}</ul>
            </details>
          )}
          <div>
            <Botao
              type="button"
              disabled={!previa.ok.length || gravando}
              onClick={() => iniciar(async () => {
                const msg = await importarMateriais(pedidoId, previa.ok.map(({ produto_id, quantidade }) => ({ produto_id, quantidade })));
                if (msg) { setErro(msg); return; }
                setPrevia(null);
                avisar("Materiais importados");
              })}
            >
              {gravando ? "Gravando…" : "Gravar materiais no pedido"}
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}
