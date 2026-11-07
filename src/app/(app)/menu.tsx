"use client";

import Link from "next/link";
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
      { href: "/relatorios", rotulo: "Relatórios" },
      { href: "/comissoes", rotulo: "Comissões" },
      { href: "/estoque", rotulo: "Estoque" },
      { href: "/fornecedores", rotulo: "Fornecedores" },
      { href: "/equipe", rotulo: "Equipe e parceiros" },
      { href: "/configuracoes", rotulo: "Configurações" },
    ],
  },
];

export function Menu({ papel }: { papel: Papel }) {
  const caminho = usePathname();
  return (
    <nav className="flex gap-4 overflow-x-auto md:flex-col md:gap-6">
      {GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => podeAbrir(papel, i.href)) })).filter((g) => g.itens.length).map((g) => (
        <div key={g.titulo} className="flex gap-1 md:flex-col">
          <div className="hidden px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 md:block">{g.titulo}</div>
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
  );
}
