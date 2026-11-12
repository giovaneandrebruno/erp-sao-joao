import Link from "next/link";
import type { ReactNode } from "react";

export function Titulo({ children, acao, sub }: { children: ReactNode; acao?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-stone-900">{children}</h1>
        {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}

const PRIMARIO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-marinho px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgb(15_29_51/0.2)] transition hover:bg-marinho-claro focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-azul/25 disabled:opacity-50";
const SECUNDARIO =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-[0_1px_2px_rgb(15_29_51/0.04)] transition hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-azul/20";
export const PERIGO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-rosa px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110";

/** Classes dos botões, para usar em links e botões que não são deste arquivo. */
export const estiloBotao = { primario: PRIMARIO, secundario: SECUNDARIO, perigo: PERIGO };

export function BotaoLink({ href, children, variante = "primario" }: { href: string; children: ReactNode; variante?: "primario" | "secundario" }) {
  return (
    <Link href={href} className={variante === "primario" ? PRIMARIO : SECUNDARIO}>
      {children}
    </Link>
  );
}

export function Botao({ children, variante = "primario", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const cls =
    variante === "primario" ? PRIMARIO : variante === "secundario" ? SECUNDARIO : PERIGO;
  return (
    <button {...props} className={`${cls} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-xs font-medium text-stone-600">{rotulo}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-azul/60 focus:outline-none focus:ring-4 focus:ring-azul/15 disabled:opacity-60";

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`vidro rounded-2xl p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: ReactNode; vazio?: boolean }) {
  return (
    <div className="vidro overflow-x-auto rounded-2xl">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50/60">
            {cabecalho.map((c, i) => (
              <th key={`${c}-${i}`} className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 [&_td]:px-5 [&_tr]:transition-colors [&_tr:hover]:bg-stone-50">{children}</tbody>
      </table>
      {vazio && <p className="p-8 text-center text-sm text-stone-400">Nada por aqui ainda.</p>}
    </div>
  );
}

const CORES_SELO = {
  stone: "bg-stone-100 text-stone-600 ring-stone-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  green: "bg-neon/10 text-neon ring-neon/25",
  red: "bg-rosa/10 text-rosa ring-rosa/30",
  blue: "bg-madeira-50 text-madeira-700 ring-madeira-200",
};

export function Selo({ children, cor = "stone" }: { children: ReactNode; cor?: keyof typeof CORES_SELO }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CORES_SELO[cor]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Erro({ mensagem }: { mensagem?: string | null }) {
  if (!mensagem) return null;
  return <p className="rounded-lg bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-rosa/30">{mensagem}</p>;
}

export function Indicador({ rotulo, valor, sub, cor }: { rotulo: string; valor: ReactNode; sub?: ReactNode; cor?: "verde" | "vermelho" }) {
  const c = cor === "verde" ? "text-neon" : cor === "vermelho" ? "text-rosa" : "text-stone-900";
  return (
    <Cartao className="h-full">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{rotulo}</div>
      <div className={`mt-3 font-mono text-2xl font-semibold tracking-tight ${c}`}>{valor}</div>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </Cartao>
  );
}

export function LinhaValor({ rotulo, valor, forte, negativo }: { rotulo: string; valor: string; forte?: boolean; negativo?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${forte ? "mt-1 border-t border-stone-200 pt-3 text-base font-semibold" : ""}`}>
      <span className="text-stone-500">{rotulo}</span>
      <span className={`font-mono tabular-nums ${negativo ? "text-stone-600" : forte ? "texto-gradiente" : "text-stone-900"}`}>{negativo ? `−${valor}` : valor}</span>
    </div>
  );
}
