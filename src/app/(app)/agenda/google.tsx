"use client";

import { useActionState } from "react";
import { Botao, Campo, Erro, inputCls } from "@/components/ui";
import { desligarGoogle, ligarGoogle } from "./actions";

export function LigarGoogle() {
  const [msg, acao, enviando] = useActionState(ligarGoogle, null);
  return (
    <form action={acao} data-manter-aberta className="flex flex-col gap-4">
      {msg === "ok" && <p className="rounded-lg bg-neon/10 p-3 text-sm text-neon ring-1 ring-neon/30">Agenda ligada. Os compromissos já aparecem no calendário.</p>}
      <Campo rotulo="Endereço secreto no formato iCal">
        <input name="url" required placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className={inputCls} autoComplete="off" />
      </Campo>
      <Campo rotulo="Nome (opcional)">
        <input name="nome" placeholder="Ex.: Minha agenda" className={inputCls} />
      </Campo>
      <Erro mensagem={msg === "ok" ? null : msg} />
      <div><Botao type="submit" disabled={enviando}>{enviando ? "Conferindo…" : "Ligar agenda"}</Botao></div>
    </form>
  );
}

export function Desligar({ id }: { id: string }) {
  return (
    <form action={desligarGoogle} data-manter-aberta>
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-medium text-rosa hover:underline">Desligar</button>
    </form>
  );
}
