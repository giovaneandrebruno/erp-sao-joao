"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/orcamentos", rotulo: "Orçamentos" },
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/producao", rotulo: "Produção" },
  { href: "/estoque", rotulo: "Estoque" },
  { href: "/financeiro", rotulo: "Financeiro" },
  { href: "/fornecedores", rotulo: "Fornecedores" },
];

export function Menu() {
  const caminho = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITENS.map((i) => {
        const ativo = i.href === "/" ? caminho === "/" : caminho.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${ativo ? "bg-amber-700 text-white" : "text-stone-300 hover:bg-stone-700"}`}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
