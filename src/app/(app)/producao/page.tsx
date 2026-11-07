import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Titulo } from "@/components/ui";
import { ETAPAS, ROTULOS, data } from "@/lib/format";
import { moverEtapa } from "./actions";

export default async function ProducaoPage({ searchParams }: PageProps<"/producao">) {
  const { concluidas } = await searchParams;
  const supabase = await createClient();
  let consulta = supabase
    .from("ordens_producao")
    .select("id, numero, descricao, etapa, responsavel, prazo, pedido_id, pedidos(numero, clientes(nome))")
    .order("prazo", { ascending: true, nullsFirst: false });
  if (!concluidas) consulta = consulta.neq("etapa", "concluido");
  const { data: ordens } = await consulta;
  const hoje = new Date().toISOString().slice(0, 10);
  const colunas = concluidas ? ETAPAS : ETAPAS.filter((e) => e !== "concluido");

  return (
    <>
      <Titulo acao={<Link href={concluidas ? "/producao" : "/producao?concluidas=1"} className="text-sm text-amber-800 hover:underline">{concluidas ? "Ocultar concluídas" : "Mostrar concluídas"}</Link>}>
        Produção
      </Titulo>
      <p className="mb-4 text-sm text-stone-500">Crie ordens de produção dentro de cada pedido. Use as setas para mudar a etapa.</p>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {colunas.map((etapa) => {
          const daEtapa = ordens?.filter((o) => o.etapa === etapa) ?? [];
          return (
            <div key={etapa} className="w-60 shrink-0 rounded-lg bg-stone-200/60 p-2">
              <div className="mb-2 px-1 text-sm font-semibold text-stone-600">{ROTULOS.etapa[etapa]} <span className="text-stone-400">({daEtapa.length})</span></div>
              <div className="flex flex-col gap-2">
                {daEtapa.map((o) => {
                  const pedido = o.pedidos as unknown as { numero: number; clientes: { nome: string } | null } | null;
                  const atrasada = o.prazo && o.prazo < hoje;
                  return (
                    <div key={o.id} className="rounded-md border border-stone-200 bg-white p-3 text-sm shadow-sm">
                      <div className="font-medium">OP #{o.numero} · {o.descricao}</div>
                      {pedido && (
                        <Link href={`/pedidos/${o.pedido_id}`} className="block text-xs text-amber-800 hover:underline">
                          Pedido #{pedido.numero} · {pedido.clientes?.nome}
                        </Link>
                      )}
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
