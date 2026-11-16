import Link from "next/link";
import { data } from "@/lib/format";
import { lerMarco, situacaoPrazo, statusPcp, textoDias, textoSobre } from "@/lib/pcp";

/** Sigla do STATUS com a cor da legenda da planilha. */
export function SeloStatus({ sigla, nome = false, grande = false }: { sigla: string; nome?: boolean; grande?: boolean }) {
  const s = statusPcp(sigla);
  return (
    <span
      title={s.nome}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold ring-1 ring-inset ring-black/10 ${grande ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"}`}
      style={{ background: s.cor, color: textoSobre(s.cor) }}
    >
      {s.sigla}
      {nome && <span className="font-medium">{s.nome}</span>}
    </span>
  );
}

/** Valor de uma etapa: ✓ para OK, data, "a confirmar" para "?", "—" para "-". */
export function ValorMarco({ valor, hoje, compacto = false }: { valor: unknown; hoje: string; compacto?: boolean }) {
  const l = lerMarco(valor);
  const base = "inline-flex items-center gap-1 whitespace-nowrap";
  switch (l.estado) {
    case "vazio":
      return <span className="text-stone-300">·</span>;
    case "feito":
      return (
        <span className={`${base} font-semibold text-neon`} title={l.texto}>
          ✓ {l.data ? data(l.data) : compacto ? "" : "OK"}
        </span>
      );
    case "nao_se_aplica":
      return <span className="text-stone-400" title="Não se aplica">—</span>;
    case "duvida":
      return <span className={`${base} text-amber-600`} title={l.texto}>? {l.data ? data(l.data) : compacto ? "" : "a confirmar"}</span>;
    case "pendente":
      return <span className={`${base} font-medium text-rosa`} title={l.texto}>● {compacto ? "pend." : "Pendente"}</span>;
    case "data":
      return <span className={`${base} ${l.data! > hoje ? "text-azul" : "text-stone-700"}`} title={l.data! > hoje ? "Data prevista" : "Data"}>{data(l.data)}</span>;
    default:
      return <span className="text-stone-700" title={l.texto}>{l.texto}</span>;
  }
}

/** Entrega limite com a contagem de dias (vermelho quando atrasada). */
export function PrazoSelo({ ordem, hoje }: { ordem: { status_pcp: string; entrega_limite?: unknown }; hoje: string }) {
  const p = situacaoPrazo(ordem, hoje);
  if (p.tipo === "concluida") return p.limite ? <span className="text-stone-500">{data(p.limite)}</span> : <span className="text-stone-400">—</span>;
  if (p.tipo === "sem_prazo") return <span className="text-stone-400">sem prazo</span>;
  const cor = p.tipo === "atrasada" ? "bg-rosa/10 text-rosa ring-rosa/30" : p.tipo === "proxima" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-neon/10 text-neon ring-neon/25";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cor}`}>
      {data(p.limite)} · {textoDias(p.dias!)}
    </span>
  );
}

/** Legenda de siglas, como no topo da planilha. Cada sigla filtra a tela. */
export function Legenda({ contagem, ativo, href }: { contagem: Record<string, number>; ativo?: string; href: (sigla?: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href={href()} className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition ${!ativo ? "bg-marinho text-white ring-marinho" : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50"}`}>
        Todos
      </Link>
      {Object.entries(contagem).map(([sigla, qtd]) => {
        const s = statusPcp(sigla);
        return (
          <Link
            key={sigla}
            href={href(ativo === sigla ? undefined : sigla)}
            className={`inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs ring-1 ring-inset transition hover:bg-stone-50 ${ativo === sigla ? "ring-2 ring-marinho" : "ring-stone-200"}`}
            title={s.nome}
          >
            <span className="h-3 w-3 rounded-sm ring-1 ring-inset ring-black/10" style={{ background: s.cor }} />
            <span className="font-semibold text-stone-800">{s.sigla}</span>
            <span className="text-stone-500">{s.nome}</span>
            <span className="rounded bg-stone-100 px-1 font-mono text-[10px] text-stone-600">{qtd}</span>
          </Link>
        );
      })}
    </div>
  );
}
