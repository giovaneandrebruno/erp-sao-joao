"use client";

import { startTransition, useActionState, useState } from "react";
import { Botao, Campo, inputCls } from "@/components/ui";
import { ETAPAS, ORDEM_ETAPAS, SITUACOES, situacoesDa, type Etapa } from "@/lib/processo";
import { mudarEtapa, type RespostaEtapa } from "../processo-actions";

type Pessoa = { user_id: string; nome: string | null; email: string | null };

/** Formulário da etapa e da situação do pedido (mostra o que falta quando não dá para avançar). */
export function FormEtapa({ pedidoId, etapa, situacao, responsavelId, prazo, motivo, pessoas, admin }: {
  pedidoId: string; etapa: Etapa; situacao: string | null; responsavelId: string | null; prazo: string | null; motivo: string | null;
  pessoas: Pessoa[]; admin: boolean;
}) {
  const [resposta, enviar, enviando] = useActionState<RespostaEtapa, FormData>(mudarEtapa.bind(null, pedidoId), null);
  const [escolhida, setEscolhida] = useState<Etapa>(etapa);
  const [sit, setSit] = useState<string>(situacao ?? "");
  const opcoes = situacoesDa(escolhida);
  const sugestao = sit && sit in SITUACOES ? SITUACOES[sit as keyof typeof SITUACOES] : null;

  return (
    <form
      // sem limpar o formulário depois de enviar: se faltar algo, a etapa escolhida continua na tela
      onSubmit={(e) => { e.preventDefault(); const dados = new FormData(e.currentTarget); startTransition(() => enviar(dados)); }}
      className="grid gap-3 md:grid-cols-12"
    >
      <Campo rotulo="Etapa" className="md:col-span-3">
        <select
          name="etapa"
          value={escolhida}
          onChange={(e) => { const nova = e.target.value as Etapa; setEscolhida(nova); setSit(nova === etapa ? (situacao ?? "") : ""); }}
          className={inputCls}
        >
          {ORDEM_ETAPAS.map((e, i) => <option key={e} value={e}>{i + 1}. {ETAPAS[e].nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo={escolhida === "cancelamento" ? "Motivo do cancelamento *" : "Situação"} className="md:col-span-3">
        <select name="situacao" value={sit} onChange={(e) => setSit(e.target.value)} className={inputCls}>
          <option value="">{escolhida === "cancelamento" ? "Escolha o motivo" : "—"}</option>
          {opcoes.map(([k, s]) => <option key={k} value={k}>{s.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Responsável" className="md:col-span-3">
        <select name="situacao_responsavel_id" defaultValue={responsavelId ?? ""} className={inputCls}>
          <option value="">{sugestao ? `— (${sugestao.responsavel})` : "—"}</option>
          {pessoas.map((p) => <option key={p.user_id} value={p.user_id}>{p.nome || p.email}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Prazo da situação" className="md:col-span-2">
        <input type="date" name="situacao_prazo" defaultValue={sit === (situacao ?? "") && escolhida === etapa ? (prazo ?? "") : ""} key={`${escolhida}-${sit}`} className={inputCls} />
      </Campo>
      <div className="flex items-end md:col-span-1"><Botao type="submit" disabled={enviando}>Salvar</Botao></div>

      {escolhida === "cancelamento" && (
        <Campo rotulo="Detalhe do motivo" className="md:col-span-12">
          <input name="cancelamento_motivo" defaultValue={motivo ?? ""} placeholder="O que o cliente disse, onde comprou, valor..." className={inputCls} />
        </Campo>
      )}
      <p className="text-xs text-stone-500 md:col-span-12">
        {sugestao
          ? <>Cargo responsável: <strong>{sugestao.responsavel}</strong>{sugestao.prazoDias !== null ? ` · prazo sugerido: ${sugestao.prazoDias} dia(s) (se deixar o prazo vazio)` : ""}{"detalhe" in sugestao && sugestao.detalhe ? ` · ${sugestao.detalhe}` : ""}</>
          : ETAPAS[escolhida].criterio ? <>Para passar adiante: <strong>{ETAPAS[escolhida].criterio.toLowerCase()}</strong>.</> : null}
      </p>

      {resposta?.erro && (
        <div className="rounded-xl bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-inset ring-rosa/30 md:col-span-12">
          <p className="font-medium">{resposta.erro}</p>
          {!!resposta.pendencias?.length && <ul className="mt-1 list-disc pl-5">{resposta.pendencias.map((x) => <li key={x}>{x}</li>)}</ul>}
          {admin && !!resposta.pendencias?.length && (
            <label className="mt-2 flex items-center gap-2 text-stone-700">
              <input type="checkbox" name="passar_mesmo_assim" value="1" className="h-4 w-4 accent-[#e37f33]" /> Passar mesmo assim (fica anotado no histórico)
            </label>
          )}
        </div>
      )}
      {resposta?.ok && <p className="text-sm text-neon md:col-span-12">Etapa salva.</p>}
    </form>
  );
}
