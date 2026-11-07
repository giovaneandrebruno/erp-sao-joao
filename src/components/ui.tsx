import Link from "next/link";
import type { ReactNode } from "react";

export function Titulo({ children, acao, sub }: { children: ReactNode; acao?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-stone-900">{children}</h1>
        {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}

const PRIMARIO =
  "rounded-full bg-gradient-to-r from-violeta to-ciano px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(108_71_255/0.7)] transition hover:brightness-110 hover:shadow-[0_10px_24px_-6px_rgb(0_178_214/0.6)] disabled:opacity-50";
const SECUNDARIO =
  "rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:border-violeta/40 hover:text-violeta";

export function BotaoLink({ href, children, variante = "primario" }: { href: string; children: ReactNode; variante?: "primario" | "secundario" }) {
  return (
    <Link href={href} className={variante === "primario" ? PRIMARIO : SECUNDARIO}>
      {children}
    </Link>
  );
}

export function Botao({ children, variante = "primario", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const cls =
    variante === "primario" ? PRIMARIO : variante === "secundario" ? SECUNDARIO : "rounded-full bg-rosa px-5 py-2 text-sm font-semibold text-white hover:brightness-110";
  return (
    <button {...props} className={`${cls} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">{rotulo}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-violeta/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violeta/15 disabled:opacity-60";

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`vidro rounded-2xl p-6 ${className}`}>{children}</div>;
}

export function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: ReactNode; vazio?: boolean }) {
  return (
    <div className="vidro overflow-x-auto rounded-2xl">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200/70">
            {cabecalho.map((c, i) => (
              <th key={`${c}-${i}`} className="px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">{c}</th>
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
  amber: "bg-violeta/10 text-violeta ring-violeta/25",
  green: "bg-neon/10 text-neon ring-neon/25",
  red: "bg-rosa/10 text-rosa ring-rosa/30",
  blue: "bg-ciano/10 text-[#0089a8] ring-ciano/30",
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
  return <p className="rounded-xl bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-rosa/30">{mensagem}</p>;
}

export function Indicador({ rotulo, valor, sub, cor }: { rotulo: string; valor: ReactNode; sub?: ReactNode; cor?: "verde" | "vermelho" }) {
  const c = cor === "verde" ? "text-neon" : cor === "vermelho" ? "text-rosa" : "text-stone-900";
  return (
    <Cartao className="h-full">
      <div className="text-[11px] font-medium uppercase tracking-wider text-stone-500">{rotulo}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${c}`}>{valor}</div>
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
