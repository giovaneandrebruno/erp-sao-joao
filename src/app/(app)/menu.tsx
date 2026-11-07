"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      { href: "/prazos", rotulo: "Prazos" },
      { href: "/producao", rotulo: "Produção" },
      { href: "/assistencia", rotulo: "Assistência técnica" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/financeiro", rotulo: "Financeiro" },
      { href: "/comissoes", rotulo: "Comissões" },
      { href: "/estoque", rotulo: "Estoque" },
      { href: "/fornecedores", rotulo: "Fornecedores" },
      { href: "/equipe", rotulo: "Equipe e parceiros" },
      { href: "/configuracoes", rotulo: "Configurações" },
    ],
  },
];

export function Menu() {
  const caminho = usePathname();
  return (
    <nav className="flex gap-4 overflow-x-auto md:flex-col md:gap-5">
      {GRUPOS.map((g) => (
        <div key={g.titulo} className="flex gap-1 md:flex-col">
          <div className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500 md:block">{g.titulo}</div>
          {g.itens.map((i) => {
            const ativo = i.href === "/" ? caminho === "/" : caminho.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${ativo ? "bg-madeira-500 font-medium text-white" : "text-stone-300 hover:bg-white/10"}`}
              >
                {i.rotulo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
