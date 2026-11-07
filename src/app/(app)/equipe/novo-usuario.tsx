"use client";

import { useActionState } from "react";
import { Botao, Campo, Erro, inputCls } from "@/components/ui";
import { ROTULO_PAPEL } from "@/lib/acesso";
import { criarUsuario } from "./actions";

export function NovoUsuario({ parceiros }: { parceiros: { id: string; nome: string }[] }) {
  const [msg, acao, enviando] = useActionState(criarUsuario, null);
  return (
    <form action={acao} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Nome" className="md:col-span-2"><input name="nome" className={inputCls} /></Campo>
      <Campo rotulo="E-mail *" className="md:col-span-2"><input name="email" type="email" required className={inputCls} /></Campo>
      <Campo rotulo="Senha inicial *" className="md:col-span-2"><input name="senha" type="text" minLength={8} required placeholder="mínimo 8 caracteres" className={inputCls} /></Campo>
      <Campo rotulo="Perfil" className="md:col-span-3">
        <select name="papel" defaultValue="vendedor" className={inputCls}>
          {Object.entries(ROTULO_PAPEL).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="É a pessoa da equipe" className="md:col-span-3">
        <select name="parceiro_id" defaultValue="" className={inputCls}>
          <option value="">—</option>
          {parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <div className="flex items-center gap-4 md:col-span-6">
        <Botao type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar usuário"}</Botao>
        {msg === "ok" && <span className="text-sm text-neon">Usuário criado. Passe o e-mail e a senha para a pessoa.</span>}
      </div>
      {msg && msg !== "ok" && <div className="md:col-span-6"><Erro mensagem={msg} /></div>}
    </form>
  );
}
