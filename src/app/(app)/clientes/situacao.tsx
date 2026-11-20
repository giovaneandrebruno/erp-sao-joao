"use client";

import { useTransition } from "react";
import { COR_SITUACAO, ROTULO_CURTO_SITUACAO, SITUACOES, type Situacao } from "@/lib/cliente";
import { avisar } from "@/components/acoes";
import { mudarSituacao } from "./actions";

const COR: Record<(typeof COR_SITUACAO)[Situacao], string> = {
  blue: "bg-madeira-50 text-madeira-700 ring-madeira-200",
  green: "bg-neon/10 text-neon ring-neon/25",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  stone: "bg-stone-100 text-stone-600 ring-stone-200",
};

/** Selo da situação que também é uma lista: escolher outra opção já grava. */
export function SeletorSituacao({ id, situacao }: { id: string; situacao: Situacao }) {
  const [salvando, iniciar] = useTransition();
  return (
    <select
      aria-label="Situação do cliente"
      title="Clique para mudar a situação"
      value={situacao}
      disabled={salvando}
      onChange={(e) => {
        const nova = e.target.value as Situacao;
        iniciar(async () => {
          await mudarSituacao(id, nova);
          avisar(`Marcado como ${ROTULO_CURTO_SITUACAO[nova].toLowerCase()}`);
        });
      }}
      className={`cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset focus:outline-none focus:ring-2 disabled:opacity-60 ${COR[COR_SITUACAO[situacao]]}`}
    >
      {(Object.keys(SITUACOES) as Situacao[]).map((s) => (
        <option key={s} value={s}>{ROTULO_CURTO_SITUACAO[s]}</option>
      ))}
    </select>
  );
}
