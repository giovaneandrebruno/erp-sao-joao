"use client";

import { useActionState } from "react";
import { entrar } from "./actions";
import { Botao, Campo, Erro, inputCls } from "@/components/ui";

export function FormLogin() {
  const [erro, acao, enviando] = useActionState(entrar, null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo rotulo="E-mail">
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </Campo>
      <Campo rotulo="Senha">
        <input name="senha" type="password" required autoComplete="current-password" className={inputCls} />
      </Campo>
      <Erro mensagem={erro} />
      <Botao type="submit" disabled={enviando}>{enviando ? "Entrando..." : "Entrar"}</Botao>
    </form>
  );
}
