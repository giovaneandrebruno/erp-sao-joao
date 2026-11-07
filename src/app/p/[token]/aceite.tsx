"use client";

import { useActionState } from "react";
import { Botao, Erro, inputCls } from "@/components/ui";
import { aceitar } from "./actions";

export function Aceite({ token }: { token: string }) {
  const [erro, acao, enviando] = useActionState(aceitar.bind(null, token), null);
  return (
    <form action={acao} className="vidro space-y-4 rounded-2xl p-6">
      <h2 className="font-semibold text-stone-900">Gostou? Aceite a proposta por aqui</h2>
      <input name="nome" placeholder="Seu nome completo" className={`${inputCls} w-full`} />
      <label className="flex items-start gap-2 text-sm text-stone-600">
        <input type="checkbox" name="concordo" className="mt-1 accent-violeta" />
        Li e aceito esta proposta. Sei que o contrato e a medição final serão combinados com a equipe.
      </label>
      <Erro mensagem={erro} />
      <Botao type="submit" disabled={enviando} className="w-full">{enviando ? "Enviando…" : "Aceitar proposta"}</Botao>
    </form>
  );
}
