import Link from "next/link";
import type { ReactNode } from "react";
import { ESTADO, ORDINAL, SERIE } from "./cores";
import { Minilinha } from "./graficos";
import { formatar, type Formato } from "./formato";

/** Cartão de gráfico: título com a pergunta, subtítulo, legenda, o gráfico e a tabela com os números. */
export function Bloco({
  titulo,
  sub,
  legenda,
  tabela,
  children,
  className = "",
  acao,
}: {
  titulo: string;
  sub?: ReactNode;
  legenda?: ReactNode;
  tabela?: { cabecalho: string[]; linhas: ReactNode[][] };
  children: ReactNode;
  className?: string;
  acao?: ReactNode;
}) {
  return (
    <section className={`vidro flex flex-col rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-stone-900">{titulo}</h2>
          {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
        </div>
        {acao}
      </div>
      {legenda && <div className="mb-3">{legenda}</div>}
      <div className="flex-1">{children}</div>
      {tabela && tabela.linhas.length > 0 && (
        <details className="group mt-4 border-t border-stone-100 pt-3 text-sm">
          <summary className="cursor-pointer list-none text-xs font-medium text-stone-500 hover:text-violeta">
            <span className="group-open:hidden">Ver os números em tabela</span>
            <span className="hidden group-open:inline">Esconder tabela</span>
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr>{tabela.cabecalho.map((c, i) => <th key={c + i} className={`py-1.5 pr-3 font-medium text-stone-500 ${i ? "text-right" : ""}`}>{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tabela.linhas.map((l, i) => (
                  <tr key={i}>{l.map((c, j) => <td key={j} className={`py-1.5 pr-3 ${j ? "text-right font-mono tabular-nums" : "text-stone-700"}`}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

/** Legenda: bolinha colorida + nome em cor de texto. */
export function Legenda({ itens }: { itens: { nome: string; cor?: string; tipo?: "cheio" | "tracejado" | "linha" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {itens.map((it, i) => (
        <li key={it.nome} className="flex items-center gap-1.5">
          {it.tipo === "linha" ? (
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: it.cor ?? "#14142b" }} />
          ) : it.tipo === "tracejado" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-dashed" style={{ borderColor: it.cor ?? SERIE[0] }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: it.cor ?? SERIE[i] }} />
          )}
          {it.nome}
        </li>
      ))}
    </ul>
  );
}

/** Variação com seta e texto; a cor diz se a mudança é boa ou ruim. */
export function Variacao({ valor, bomSeSobe = true, contra }: { valor: number | null; bomSeSobe?: boolean; contra: string }) {
  if (valor === null) return <span className="text-xs text-stone-400">sem base de comparação</span>;
  const sobe = valor > 0.05;
  const desce = valor < -0.05;
  const bom = (sobe && bomSeSobe) || (desce && !bomSeSobe);
  const ruim = (sobe && !bomSeSobe) || (desce && bomSeSobe);
  const cor = bom ? "text-neon" : ruim ? "text-rosa" : "text-stone-500";
  return (
    <span className="text-xs text-stone-500">
      <span className={`font-semibold ${cor}`}>
        {sobe ? "▲" : desce ? "▼" : "■"} {Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </span>{" "}
      {contra}
    </span>
  );
}

/** Cartão de indicador: rótulo, número, variação e minilinha dos últimos meses. */
export function Kpi({
  rotulo,
  valor,
  variacao,
  bomSeSobe = true,
  contra = "vs. mês anterior",
  serie,
  rotulos,
  formato = "brl",
  sub,
  href,
}: {
  rotulo: string;
  valor: string;
  variacao?: number | null;
  bomSeSobe?: boolean;
  contra?: string;
  serie?: number[];
  rotulos?: string[];
  formato?: Formato;
  sub?: ReactNode;
  href?: string;
}) {
  const corpo = (
    <>
      <div className="text-xs font-medium text-stone-500">{rotulo}</div>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="whitespace-nowrap text-2xl font-semibold tracking-tight text-stone-900">{valor}</div>
        {serie && <Minilinha valores={serie} rotulos={rotulos} formato={formato} />}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {variacao !== undefined && <Variacao valor={variacao} bomSeSobe={bomSeSobe} contra={contra} />}
        {sub && <span className="text-xs text-stone-500">{sub}</span>}
      </div>
    </>
  );
  const cls = "vidro block h-full rounded-2xl p-5 transition";
  return href ? <Link href={href} className={`${cls} hover:ring-2 hover:ring-violeta/20`}>{corpo}</Link> : <div className={cls}>{corpo}</div>;
}

/** Barras horizontais ordenadas, com o valor na ponta. Uma cor só (ou a cor do item). */
export function BarrasH({
  itens,
  formato = "brl",
  vazio = "Nada para mostrar neste período.",
  max: maxFixo,
  limite = 8,
}: {
  itens: { nome: string; valor: number; detalhe?: string; cor?: string; href?: string }[];
  formato?: Formato;
  vazio?: string;
  max?: number;
  limite?: number;
}) {
  if (!itens.length) return <p className="py-6 text-center text-sm text-stone-400">{vazio}</p>;
  let lista = itens;
  if (itens.length > limite) {
    const resto = itens.slice(limite - 1);
    lista = [...itens.slice(0, limite - 1), { nome: `Outros (${resto.length})`, valor: resto.reduce((s, x) => s + x.valor, 0), cor: "#9a9eb0" }];
  }
  const max = maxFixo ?? Math.max(...lista.map((i) => Math.abs(i.valor)), 1);
  return (
    <ul className="space-y-3">
      {lista.map((it) => {
        const linha = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-stone-700">{it.nome}</span>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-stone-900">
                {formatar(it.valor, formato)}
                {it.detalhe && <span className="ml-2 font-sans text-xs text-stone-500">{it.detalhe}</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(1, (Math.abs(it.valor) / max) * 100)}%`, background: it.cor ?? SERIE[0] }} />
            </div>
          </>
        );
        return (
          <li key={it.nome} title={`${it.nome}: ${formatar(it.valor, formato)}${it.detalhe ? ` · ${it.detalhe}` : ""}`}>
            {it.href ? <Link href={it.href} className="block hover:opacity-80">{linha}</Link> : linha}
          </li>
        );
      })}
    </ul>
  );
}

/** Negociações abertas por etapa (escala ordenada), com valor e chance de fechar de cada etapa. */
export function Funil({ etapas }: { etapas: { nome: string; qtd: number; valor: number; ponderado?: number }[] }) {
  const max = Math.max(...etapas.map((e) => e.qtd), 1);
  return (
    <ol className="space-y-3">
      {etapas.map((e, i) => {
        const largura = (e.qtd / max) * 100;
        const chance = e.valor && e.ponderado !== undefined ? Math.round((e.ponderado / e.valor) * 100) : null;
        return (
          <li key={e.nome} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm" title={`${e.nome}: ${e.qtd} negociações · ${formatar(e.valor)}`}>
            <span className="truncate text-stone-700">{e.nome}</span>
            <div className="flex h-6 items-center gap-2">
              <div className="flex h-full items-center rounded-md pl-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max(e.qtd ? 4 : 0, largura * 0.85)}%`, background: ORDINAL[Math.min(i, ORDINAL.length - 1)] }}>
                {largura > 12 ? e.qtd : ""}
              </div>
              {largura <= 12 && <span className="text-xs text-stone-500">{e.qtd}</span>}
            </div>
            <span className="text-right">
              <span className="font-mono text-[13px] tabular-nums text-stone-900">{formatar(e.valor)}</span>
              {chance !== null && <span className="block text-[11px] text-stone-500">chance {chance}%</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra segmentada alta: partes de um todo (até 6), com legenda e % dentro quando couber. */
export function Segmentada({ partes, formato = "brl" }: { partes: { nome: string; valor: number }[]; formato?: Formato }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  if (!total) return <p className="py-6 text-center text-sm text-stone-400">Nada para mostrar neste período.</p>;
  let lista = [...partes].sort((a, b) => b.valor - a.valor);
  if (lista.length > 6) lista = [...lista.slice(0, 5), { nome: "Outros", valor: lista.slice(5).reduce((s, p) => s + p.valor, 0) }];
  return (
    <div>
      <div className="flex h-7 gap-[2px]" role="img" aria-label={lista.map((p) => `${p.nome} ${Math.round((p.valor / total) * 100)}%`).join(", ")}>
        {lista.map((p, i) => {
          const pctV = (p.valor / total) * 100;
          return p.valor > 0 ? (
            <div
              key={p.nome}
              title={`${p.nome}: ${formatar(p.valor, formato)} (${Math.round(pctV)}%)`}
              className={`flex items-center rounded-[4px] pl-2 text-[11px] font-semibold ${i === 2 ? "text-stone-900" : "text-white"}`}
              style={{ width: `${pctV}%`, background: p.nome === "Outros" ? "#9a9eb0" : SERIE[i] }}
            >
              {pctV >= 9 ? `${Math.round(pctV)}%` : ""}
            </div>
          ) : null;
        })}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1 text-xs text-stone-600 sm:grid-cols-2">
        {lista.map((p, i) => (
          <li key={p.nome} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.nome === "Outros" ? "#9a9eb0" : SERIE[i] }} />
              <span className="truncate">{p.nome}</span>
            </span>
            <span className="font-mono tabular-nums text-stone-900">{formatar(p.valor, formato)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type Insight = {
  nivel: "bom" | "atencao" | "risco" | "info";
  titulo: string;
  detalhe?: string;
  href?: string;
};

const ICONE = { bom: "▲", atencao: "!", risco: "▼", info: "i" } as const;
const ROTULO_NIVEL = { bom: "Boa notícia", atencao: "Atenção", risco: "Risco", info: "Para saber" } as const;
const COR_NIVEL = { bom: ESTADO.bom, atencao: ESTADO.atencao, risco: ESTADO.ruim, info: SERIE[0] } as const;

/** Lista de insights automáticos, cada um com ícone, rótulo, frase e link. */
export function Insights({ itens }: { itens: Insight[] }) {
  if (!itens.length) return <p className="py-6 text-center text-sm text-stone-400">Nada fora do normal por enquanto. Os avisos aparecem aqui conforme os dados chegam.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {itens.map((it, i) => {
        const conteudo = (
          <div className="flex gap-3 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: COR_NIVEL[it.nivel] }} aria-hidden>
              {ICONE[it.nivel]}
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{ROTULO_NIVEL[it.nivel]}</div>
              <div className="text-sm font-medium text-stone-900">{it.titulo}</div>
              {it.detalhe && <div className="mt-0.5 text-xs text-stone-500">{it.detalhe}</div>}
            </div>
            {it.href && <span className="ml-auto self-center text-stone-300">→</span>}
          </div>
        );
        return <li key={i}>{it.href ? <Link href={it.href} className="block rounded-xl px-2 -mx-2 hover:bg-stone-50">{conteudo}</Link> : conteudo}</li>;
      })}
    </ul>
  );
}
