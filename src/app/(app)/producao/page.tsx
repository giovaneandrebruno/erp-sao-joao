import Link from "next/link";
import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { Titulo } from "@/components/ui";
import { ETAPAS, ROTULOS, data, hojeISO } from "@/lib/format";
import { moverEtapa } from "./actions";

export default async function ProducaoPage({ searchParams }: PageProps<"/producao">) {
  const { concluidas } = await searchParams;
  const supabase = await createClient();
  let consulta = supabase
    .from("ordens_producao")
    .select("id, numero, descricao, etapa, responsavel, prazo, pedido_id, cliente_nome, ambiente, extras, pedidos(numero, clientes(nome))")
    .order("prazo", { ascending: true, nullsFirst: false });
  if (!concluidas) consulta = consulta.neq("etapa", "concluido");
  const { data: ordens } = await consulta;
  const hoje = hojeISO();
  const colunas = concluidas ? ETAPAS : ETAPAS.filter((e) => e !== "concluido");

  return (
    <>
      <Titulo acao={<FerramentasImportacao area="producao" extra={<Link href={concluidas ? "/producao" : "/producao?concluidas=1"} className="px-2 text-sm text-madeira-800 hover:underline">{concluidas ? "Ocultar concluídas" : "Mostrar concluídas"}</Link>} />}>
        Produção
      </Titulo>
      <p className="mb-4 text-sm text-stone-500">Crie ordens de produção dentro de cada pedido, ou importe a planilha de PCP. Use as setas para mudar a etapa.</p>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {colunas.map((etapa) => {
          const daEtapa = ordens?.filter((o) => o.etapa === etapa) ?? [];
          return (
            <div key={etapa} className="min-w-40 flex-1 rounded-lg bg-stone-200/60 p-2">
              <div className="mb-2 px-1 text-sm font-semibold text-stone-600">{ROTULOS.etapa[etapa]} <span className="text-stone-400">({daEtapa.length})</span></div>
              <div className="flex flex-col gap-2">
                {daEtapa.map((o) => {
                  const pedido = o.pedidos as unknown as { numero: number; clientes: { nome: string } | null } | null;
                  const atrasada = o.prazo && o.prazo < hoje;
                  return (
                    <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-[0_1px_2px_rgb(20_20_43/0.04)] transition hover:border-violeta/40 hover:shadow-[0_8px_20px_-10px_rgb(108_71_255/0.4)]">
                      <div className="font-medium">OP #{o.numero} · {o.ambiente ? `${o.ambiente} · ` : ""}{o.descricao}</div>
                      {pedido ? (
                        <Link href={`/pedidos/${o.pedido_id}`} className="block text-xs text-madeira-800 hover:underline">
                          Pedido #{pedido.numero} · {pedido.clientes?.nome}
                        </Link>
                      ) : o.cliente_nome ? (
                        <div className="text-xs text-stone-600">{o.cliente_nome}</div>
                      ) : null}
                      {o.extras && <Extras extras={o.extras as Record<string, string>} />}
                      <div className={`mt-1 text-xs ${atrasada ? "font-semibold text-red-600" : "text-stone-500"}`}>
                        Prazo {data(o.prazo)}{o.responsavel ? ` · ${o.responsavel}` : ""}
                      </div>
                      <div className="mt-2 flex justify-between">
                        <form action={moverEtapa.bind(null, o.id, -1)}><button disabled={etapa === ETAPAS[0]} className="rounded px-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30">←</button></form>
                        <form action={moverEtapa.bind(null, o.id, 1)}><button disabled={etapa === "concluido"} className="rounded px-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30">→</button></form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Informações extras vindas da planilha: as mais úteis aparecem no cartão, o resto ao passar o mouse. */
function Extras({ extras }: { extras: Record<string, string> }) {
  const todas = Object.entries(extras);
  const peso = ([k]: [string, string]) => (/^etapa$/i.test(k) ? 0 : /posi[cç][aã]o|situa/i.test(k) ? 1 : /pend|obs/i.test(k) ? 2 : 3);
  const principais = [...todas].sort((a, b) => peso(a) - peso(b)).slice(0, 3);
  return (
    <div className="mt-1 text-[11px] leading-snug text-stone-400" title={todas.map(([k, v]) => `${k}: ${v}`).join("\n")}>
      {principais.map(([k, v]) => `${k}: ${v}`).join(" · ")}
      {todas.length > 3 && <span className="text-stone-300"> · +{todas.length - 3}</span>}
    </div>
  );
}
