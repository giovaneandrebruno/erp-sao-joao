import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { ROTULOS, brl, data, pct } from "@/lib/format";

export default async function PainelPage() {
  const supabase = await createClient();
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  agora.setDate(agora.getDate() + 7);
  const daqui7 = agora.toISOString().slice(0, 10);

  const [vendasMes, negociacoes, pedidosAtivos, marcosAtrasados, vencidos, semana, produtos, chamados] = await Promise.all([
    supabase.from("pedidos_resumo").select("total, lucro").gte("criado_em", inicioMes).neq("status", "cancelado"),
    supabase.from("negociacoes").select("id, titulo, valor_estimado, proxima_acao, proxima_acao_data, clientes(nome)").not("etapa", "in", "(ganho,perdido)").order("proxima_acao_data", { nullsFirst: false }),
    supabase.from("pedidos_resumo").select("id, numero, cliente_nome, status, data_entrega_prevista").in("status", ["aberto", "em_producao", "pronto"]).order("data_entrega_prevista", { nullsFirst: false }),
    supabase.from("pedido_marcos").select("id", { count: "exact", head: true }).is("realizado", null).lt("previsto", hoje),
    supabase.from("lancamentos").select("tipo, valor").is("pago_em", null).lt("vencimento", hoje),
    supabase.from("lancamentos").select("tipo, valor").is("pago_em", null).gte("vencimento", hoje).lte("vencimento", daqui7),
    supabase.from("produtos").select("estoque_atual, estoque_minimo").eq("ativo", true).neq("tipo", "servico"),
    supabase.from("chamados").select("id", { count: "exact", head: true }).neq("status", "resolvido"),
  ]);

  const somar = (rows: { tipo: string; valor: number }[] | null, t: string) => (rows ?? []).filter((r) => r.tipo === t).reduce((s, r) => s + Number(r.valor), 0);
  const vendido = (vendasMes.data ?? []).reduce((s, p) => s + Number(p.total), 0);
  const lucroMes = (vendasMes.data ?? []).reduce((s, p) => s + Number(p.lucro), 0);
  const potencial = (negociacoes.data ?? []).reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0);
  const acoesHoje = (negociacoes.data ?? []).filter((n) => n.proxima_acao_data && n.proxima_acao_data <= hoje);
  const repor = (produtos.data ?? []).filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo)).length;

  const cards = [
    { rotulo: "Vendido no mês", valor: brl(vendido), sub: `${vendasMes.data?.length ?? 0} pedidos · lucro ${brl(lucroMes)}${vendido ? ` (${pct((lucroMes / vendido) * 100)})` : ""}`, href: "/pedidos" },
    { rotulo: "Funil de vendas", valor: `${negociacoes.data?.length ?? 0}`, sub: `potencial ${brl(potencial)}`, href: "/crm" },
    { rotulo: "Pedidos em andamento", valor: `${pedidosAtivos.data?.length ?? 0}`, sub: `${marcosAtrasados.count ?? 0} prazos atrasados`, href: "/prazos", alerta: (marcosAtrasados.count ?? 0) > 0 },
    { rotulo: "A receber em 7 dias", valor: brl(somar(semana.data, "receber")), sub: `vencido: ${brl(somar(vencidos.data, "receber"))}`, href: "/financeiro?tipo=receber" },
    { rotulo: "A pagar em 7 dias", valor: brl(somar(semana.data, "pagar")), sub: `vencido: ${brl(somar(vencidos.data, "pagar"))}`, href: "/financeiro?tipo=pagar" },
    { rotulo: "Assistência técnica", valor: `${chamados.count ?? 0}`, sub: `chamados abertos · ${repor} itens para repor`, href: "/assistencia" },
  ];

  return (
    <>
      <Titulo>Painel</Titulo>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.rotulo} href={c.href}>
            <Cartao className="h-full transition-colors hover:border-madeira-400">
              <div className="text-sm text-stone-500">{c.rotulo}</div>
              <div className="text-2xl font-semibold text-grafite">{c.valor}</div>
              <div className={`text-xs ${c.alerta ? "font-semibold text-red-600" : "text-stone-500"}`}>{c.sub}</div>
            </Cartao>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Retornos para hoje</h2>
          <Cartao>
            {acoesHoje.length ? (
              <ul className="divide-y divide-stone-100 text-sm">
                {acoesHoje.slice(0, 8).map((n) => (
                  <li key={n.id} className="flex justify-between gap-4 py-2">
                    <Link href={`/crm/${n.id}`} className="text-madeira-700 hover:underline">{(n.clientes as unknown as { nome: string })?.nome} · {n.proxima_acao}</Link>
                    <span className={n.proxima_acao_data! < hoje ? "font-semibold text-red-600" : "text-stone-500"}>{data(n.proxima_acao_data)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">Nenhum retorno pendente.</p>
            )}
          </Cartao>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Próximas entregas</h2>
          <Cartao>
            {pedidosAtivos.data?.length ? (
              <ul className="divide-y divide-stone-100 text-sm">
                {pedidosAtivos.data.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex justify-between gap-4 py-2">
                    <Link href={`/pedidos/${p.id}`} className="text-madeira-700 hover:underline">#{p.numero} · {p.cliente_nome}</Link>
                    <span className={p.data_entrega_prevista && p.data_entrega_prevista < hoje ? "font-semibold text-red-600" : "text-stone-500"}>
                      {ROTULOS.statusPedido[p.status as keyof typeof ROTULOS.statusPedido]} · {data(p.data_entrega_prevista)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">Nenhum pedido em andamento.</p>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}
