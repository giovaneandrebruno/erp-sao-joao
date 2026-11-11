"use client";

import { useActionState } from "react";
import { Botao, Campo, Erro, inputCls } from "@/components/ui";
import { trocarSenha } from "./actions";

export function TrocarSenha() {
  const [msg, acao, enviando] = useActionState(trocarSenha, null);
  if (msg === "ok") return <p className="text-sm text-neon">Senha trocada. Use a nova senha no próximo acesso.</p>;
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo rotulo="Nova senha"><input name="senha" type="password" minLength={8} required autoComplete="new-password" className={inputCls} /></Campo>
      <Campo rotulo="Repita a nova senha"><input name="repetir" type="password" minLength={8} required autoComplete="new-password" className={inputCls} /></Campo>
      <Erro mensagem={msg} />
      <div><Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Trocar senha"}</Botao></div>
    </form>
  );
}
