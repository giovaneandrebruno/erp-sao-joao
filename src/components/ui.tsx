import Link from "next/link";
import type { ReactNode } from "react";

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold text-stone-800">{children}</h1>
      {acao}
    </div>
  );
}

export function BotaoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
      {children}
    </Link>
  );
}

export function Botao({ children, variante = "primario", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const cores = {
    primario: "bg-amber-700 text-white hover:bg-amber-800",
    secundario: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
    perigo: "bg-red-600 text-white hover:bg-red-700",
  }[variante];
  return (
    <button {...props} className={`rounded-md px-4 py-2 text-sm font-medium ${cores} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium text-stone-600">{rotulo}</span>
      {children}
    </label>
  );
}

export const inputCls = "rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-amber-600 focus:outline-none";

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-stone-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: ReactNode; vazio?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-50 text-stone-500">
          <tr>{cabecalho.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
      {vazio && <p className="p-6 text-center text-sm text-stone-400">Nenhum registro ainda.</p>}
    </div>
  );
}

export function Selo({ children, cor = "stone" }: { children: ReactNode; cor?: "stone" | "amber" | "green" | "red" | "blue" }) {
  const cores = {
    stone: "bg-stone-100 text-stone-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-800",
  }[cor];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cores}`}>{children}</span>;
}

export function Erro({ mensagem }: { mensagem?: string | null }) {
  if (!mensagem) return null;
  return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mensagem}</p>;
}
