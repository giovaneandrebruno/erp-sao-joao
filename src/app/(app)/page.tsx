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
    { rotulo: "Pedidos ativos", valor: `${pedidosAtivos.data?.length ?? 0}`, sub: `${marcosAtrasados.count ?? 0} prazos atrasados`, href: "/prazos", alerta: (marcosAtrasados.count ?? 0) > 0 },
    { rotulo: "A receber em 7 dias", valor: brl(somar(semana.data, "receber")), sub: `vencido: ${brl(somar(vencidos.data, "receber"))}`, href: "/financeiro?tipo=receber" },
    { rotulo: "A pagar em 7 dias", valor: brl(somar(semana.data, "pagar")), sub: `vencido: ${brl(somar(vencidos.data, "pagar"))}`, href: "/financeiro?tipo=pagar" },
    { rotulo: "Assistência técnica", valor: `${chamados.count ?? 0}`, sub: "chamados abertos", href: "/assistencia" },
    { rotulo: "Estoque", valor: `${repor}`, sub: "itens abaixo do mínimo", href: "/estoque", alerta: repor > 0 },
  ];

  const [destaque, ...resto] = cards;
  const lista = "divide-y divide-white/[0.05] text-sm";

  return (
    <>
      <Titulo sub={agoraTexto()}>Painel</Titulo>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href={destaque.href} className="borda-gradiente group relative overflow-hidden rounded-3xl p-8 sm:col-span-2 lg:row-span-2">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violeta/30 blur-3xl transition group-hover:bg-ciano/30" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">{destaque.rotulo}</div>
            <div>
              <div className="texto-gradiente font-mono text-4xl font-semibold tracking-tighter xl:text-5xl 2xl:text-6xl">{destaque.valor}</div>
              <div className="mt-3 text-sm text-stone-500">{destaque.sub}</div>
            </div>
          </div>
        </Link>
        {resto.map((c) => (
          <Link key={c.rotulo} href={c.href} className="group">
            <Cartao className="h-full transition group-hover:border-violeta/40">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                {c.rotulo}
                <span className={`h-1.5 w-1.5 rounded-full ${c.alerta ? "bg-rosa shadow-[0_0_10px_2px_rgb(255_77_125/0.7)]" : "bg-stone-300"}`} />
              </div>
              <div className="mt-4 font-mono text-2xl font-semibold tracking-tight text-stone-900">{c.valor}</div>
              <div className={`mt-1 text-xs ${c.alerta ? "text-rosa" : "text-stone-500"}`}>{c.sub}</div>
            </Cartao>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Retornos para hoje</h2>
          <Cartao>
            {acoesHoje.length ? (
              <ul className={lista}>
                {acoesHoje.slice(0, 8).map((n) => (
                  <li key={n.id} className="flex justify-between gap-4 py-2.5">
                    <Link href={`/crm/${n.id}`} className="text-stone-800 transition hover:text-ciano">{(n.clientes as unknown as { nome: string })?.nome} · <span className="text-stone-500">{n.proxima_acao}</span></Link>
                    <span className={`font-mono text-xs ${n.proxima_acao_data! < hoje ? "text-rosa" : "text-stone-500"}`}>{data(n.proxima_acao_data)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">Nenhum retorno pendente.</p>
            )}
          </Cartao>
        </section>
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Próximas entregas</h2>
          <Cartao>
            {pedidosAtivos.data?.length ? (
              <ul className={lista}>
                {pedidosAtivos.data.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex justify-between gap-4 py-2.5">
                    <Link href={`/pedidos/${p.id}`} className="text-stone-800 transition hover:text-ciano"><span className="font-mono text-stone-500">#{p.numero}</span> {p.cliente_nome}</Link>
                    <span className={`text-xs ${p.data_entrega_prevista && p.data_entrega_prevista < hoje ? "text-rosa" : "text-stone-500"}`}>
                      {ROTULOS.statusPedido[p.status as keyof typeof ROTULOS.statusPedido]} · <span className="font-mono">{data(p.data_entrega_prevista)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">Nenhum pedido em andamento.</p>
            )}
          </Cartao>
        </section>
      </div>
    </>
  );
}

function agoraTexto() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
}
