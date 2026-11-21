import { formatar } from "@/components/graficos/formato";
import { data } from "@/lib/format";

export type Cartaz = { id: string; imagem: string | null; texto: string; tipo: string; em: string; link: string; numeros: { rotulo: string; valor: number | null }[] };

/** Grade de publicações com a foto, o tipo, a data e os números principais. */
export function Publicacoes({ itens, vazio = "Nenhuma publicação neste período." }: { itens: Cartaz[]; vazio?: string }) {
  if (!itens.length) return <p className="py-6 text-center text-sm text-stone-400">{vazio}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {itens.map((p, i) => (
        <li key={p.id}>
          <a href={p.link} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:border-violeta/40">
            <div className="relative aspect-square bg-stone-100">
              {p.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center text-xs text-stone-400">{p.texto.slice(0, 80) || "sem imagem"}</div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-stone-700">{i + 1}º · {p.tipo}</span>
            </div>
            <div className="p-2.5">
              <div className="truncate text-xs text-stone-700" title={p.texto}>{p.texto || "Sem legenda"}</div>
              <div className="mt-0.5 text-[11px] text-stone-400">{data(p.em)}</div>
              <dl className="mt-2 grid gap-y-0.5 text-[11px]">
                {p.numeros.map((n) => (
                  <div key={n.rotulo} className="flex justify-between gap-1">
                    <dt className="text-stone-500">{n.rotulo}</dt>
                    <dd className="font-mono tabular-nums text-stone-900">{formatar(n.valor, "num")}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
