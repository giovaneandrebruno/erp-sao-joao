"use client";

import { useActionState } from "react";
import { Botao, Campo, Erro, inputCls } from "@/components/ui";
import { CORES_AGENDA } from "@/lib/cores-agenda";
import { desligarGoogle, editarGoogle, ligarGoogle } from "./actions";

/** Bolinhas de cor para escolher (rádio: funciona até sem JavaScript). */
function EscolherCor({ atual, nome = "cor" }: { atual?: string; nome?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CORES_AGENDA.map(({ cor, nome: rotulo }, i) => (
        <label key={cor} title={rotulo} className="cursor-pointer">
          <input type="radio" name={nome} value={cor} defaultChecked={atual ? atual === cor : i === 0} className="peer sr-only" />
          <span
            className="block h-7 w-7 rounded-full ring-2 ring-transparent ring-offset-2 transition peer-checked:ring-stone-800 peer-focus-visible:ring-stone-400"
            style={{ backgroundColor: cor }}
          />
          <span className="sr-only">{rotulo}</span>
        </label>
      ))}
    </div>
  );
}

export function LigarGoogle({ proximaCor }: { proximaCor?: string }) {
  const [msg, acao, enviando] = useActionState(ligarGoogle, null);
  return (
    <form action={acao} data-manter-aberta className="flex flex-col gap-4">
      {msg === "ok" && <p className="rounded-lg bg-neon/10 p-3 text-sm text-neon ring-1 ring-neon/30">Agenda ligada. Os compromissos já aparecem no calendário.</p>}
      <Campo rotulo="Endereço secreto no formato iCal">
        <input name="url" required placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className={inputCls} autoComplete="off" />
      </Campo>
      <Campo rotulo="Nome que aparece na Agenda">
        <input name="nome" required placeholder="Ex.: Giovane" className={inputCls} />
      </Campo>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Cor</span>
        <EscolherCor atual={proximaCor} />
      </div>
      <Erro mensagem={msg === "ok" ? null : msg} />
      <div><Botao type="submit" disabled={enviando}>{enviando ? "Conferindo…" : "Ligar agenda"}</Botao></div>
    </form>
  );
}

/** Uma agenda já ligada: trocar nome e cor, ou desligar. */
export function AgendaLigada({ id, nome, cor, falhou }: { id: string; nome: string; cor: string; falhou?: boolean }) {
  return (
    <li className="flex flex-col gap-3 px-3 py-3">
      <form action={editarGoogle} data-manter-aberta className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
          <input name="nome" defaultValue={nome} aria-label="Nome da agenda" className={`${inputCls} min-w-0 flex-1 py-1.5`} />
          <Botao type="submit" variante="secundario" className="px-3 py-1.5">Salvar</Botao>
        </div>
        <EscolherCor atual={cor} />
      </form>
      <div className="flex items-center justify-between">
        {falhou ? <span className="text-xs text-rosa">sem resposta do Google agora</span> : <span />}
        <form action={desligarGoogle} data-manter-aberta>
          <input type="hidden" name="id" value={id} />
          <button className="text-xs font-medium text-rosa hover:underline">Desligar</button>
        </form>
      </div>
    </li>
  );
}
