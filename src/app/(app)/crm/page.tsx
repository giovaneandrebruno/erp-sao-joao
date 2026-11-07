import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Titulo } from "@/components/ui";
import { ETAPAS_NEGOCIACAO, ROTULOS2, brl, data, hojeISO } from "@/lib/format";
import { moverNegociacao } from "./actions";

export default async function CrmPage({ searchParams }: PageProps<"/crm">) {
  const { fechadas } = await searchParams;
  const supabase = await createClient();
  let consulta = supabase
    .from("negociacoes")
    .select("id, titulo, etapa, origem, valor_estimado, proxima_acao, proxima_acao_data, clientes(nome, telefone), vendedor:vendedor_id(nome)")
    .order("proxima_acao_data", { ascending: true, nullsFirst: false });
  if (!fechadas) consulta = consulta.not("etapa", "in", "(ganho,perdido)");
  const { data: negociacoes } = await consulta;
  const hoje = hojeISO();
  const colunas = fechadas ? ETAPAS_NEGOCIACAO : ETAPAS_NEGOCIACAO.filter((e) => e !== "ganho" && e !== "perdido");
  const abertas = (negociacoes ?? []).filter((n) => n.etapa !== "ganho" && n.etapa !== "perdido");
  const potencial = abertas.reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0);

  return (
    <>
      <Titulo acao={<BotaoLink href="/crm/nova">Nova negociação</BotaoLink>}>Funil de vendas</Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-stone-600">
        <span>{abertas.length} negociações em aberto · potencial <strong>{brl(potencial)}</strong></span>
        <Link href={fechadas ? "/crm" : "/crm?fechadas=1"} className="text-madeira-700 hover:underline">{fechadas ? "Ocultar ganhas e perdidas" : "Mostrar ganhas e perdidas"}</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {colunas.map((etapa) => {
          const daEtapa = negociacoes?.filter((n) => n.etapa === etapa) ?? [];
          const soma = daEtapa.reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0);
          const idx = ETAPAS_NEGOCIACAO.indexOf(etapa);
          return (
            <div key={etapa} className="min-w-44 flex-1 rounded-lg bg-stone-200/60 p-2">
              <div className="mb-2 px-1">
                <div className="text-sm font-semibold text-stone-700">{ROTULOS2.etapaNegociacao[etapa]} <span className="text-stone-400">({daEtapa.length})</span></div>
                <div className="text-xs text-stone-500">{brl(soma)}</div>
              </div>
              <div className="flex flex-col gap-2">
                {daEtapa.map((n) => {
                  const cli = n.clientes as unknown as { nome: string; telefone: string | null } | null;
                  const vend = n.vendedor as unknown as { nome: string } | null;
                  const atrasada = n.proxima_acao_data && n.proxima_acao_data < hoje;
                  return (
                    <div key={n.id} className="rounded-md border border-stone-200 bg-white p-3 text-sm shadow-sm">
                      <Link href={`/crm/${n.id}`} className="font-medium text-stone-900 hover:text-madeira-700">{cli?.nome}</Link>
                      <div className="text-xs text-stone-500">{n.titulo}</div>
                      {n.valor_estimado && <div className="mt-1 text-sm font-medium">{brl(n.valor_estimado)}</div>}
                      {n.proxima_acao && (
                        <div className={`mt-1 text-xs ${atrasada ? "font-semibold text-red-600" : "text-stone-600"}`}>
                          → {n.proxima_acao} {n.proxima_acao_data ? `(${data(n.proxima_acao_data)})` : ""}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-stone-400">{[n.origem, vend?.nome].filter(Boolean).join(" · ")}</div>
                      <div className="mt-2 flex justify-between">
                        <form action={moverNegociacao.bind(null, n.id, ETAPAS_NEGOCIACAO[Math.max(0, idx - 1)])}><button disabled={idx === 0} className="rounded px-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30">←</button></form>
                        {cli?.telefone && (
                          <a href={`https://wa.me/55${cli.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline">WhatsApp</a>
                        )}
                        <form action={moverNegociacao.bind(null, n.id, ETAPAS_NEGOCIACAO[Math.min(5, idx + 1)])}><button disabled={idx >= 5} className="rounded px-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30">→</button></form>
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
