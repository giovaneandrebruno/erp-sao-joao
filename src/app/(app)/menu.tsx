"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { podeAbrir, type Papel } from "@/lib/acesso";

const GRUPOS = [
  {
    titulo: "Vendas",
    itens: [
      { href: "/", rotulo: "Painel" },
      { href: "/crm", rotulo: "Funil de vendas" },
      { href: "/clientes", rotulo: "Clientes" },
      { href: "/orcamentos", rotulo: "Orçamentos" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/pedidos", rotulo: "Pedidos" },
      { href: "/agenda", rotulo: "Agenda" },
      { href: "/prazos", rotulo: "Prazos" },
      { href: "/producao", rotulo: "Produção" },
      { href: "/assistencia", rotulo: "Assistência técnica" },
      { href: "/campo", rotulo: "App do montador" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/financeiro", rotulo: "Financeiro" },
      { href: "/analises", rotulo: "Análises" },
      { href: "/relatorios", rotulo: "Relatórios" },
      { href: "/comissoes", rotulo: "Comissões" },
      { href: "/estoque", rotulo: "Estoque" },
      { href: "/fornecedores", rotulo: "Fornecedores" },
      { href: "/equipe", rotulo: "Equipe e parceiros" },
      { href: "/configuracoes", rotulo: "Configurações" },
    ],
  },
];

export function Menu({ papel, marca, rodape }: { papel: Papel; marca: ReactNode; rodape: ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between">
        {marca}
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-expanded={aberto}
          aria-label="Abrir menu"
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] md:hidden"
        >
          <span className={`h-0.5 w-5 rounded bg-stone-900 transition ${aberto ? "translate-y-1 rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-stone-900 transition ${aberto ? "-translate-y-1 -rotate-45" : ""}`} />
        </button>
      </div>
      <div className={`${aberto ? "flex" : "hidden"} flex-1 flex-col gap-8 md:flex`} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setAberto(false); }}>
    <nav className="grid grid-cols-2 gap-x-2 gap-y-6 md:flex md:flex-col md:gap-6">
      {GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => podeAbrir(papel, i.href)) })).filter((g) => g.itens.length).map((g) => (
        <div key={g.titulo} className="flex flex-col gap-1">
          <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400">{g.titulo}</div>
          {g.itens.map((i) => {
            const ativo = i.href === "/" ? caminho === "/" : caminho.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`group relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition-colors ${ativo ? "bg-white/[0.06] font-medium text-stone-900" : "text-stone-500 hover:bg-white/[0.03] hover:text-stone-800"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition ${ativo ? "bg-ciano shadow-[0_0_10px_2px_rgb(0_229_255/0.7)]" : "bg-stone-300 group-hover:bg-stone-400"}`} />
                {i.rotulo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
        {rodape}
      </div>
    </>
  );
}
