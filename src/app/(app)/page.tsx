import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { ROTULOS, brl, data } from "@/lib/format";

export default async function PainelPage() {
  const supabase = await createClient();
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  agora.setDate(agora.getDate() + 7);
  const daqui7 = agora.toISOString().slice(0, 10);

  const [orcAbertos, pedidosAtivos, ordens, vencidos, semana, produtos] = await Promise.all([
    supabase.from("orcamentos_resumo").select("total").in("status", ["rascunho", "enviado"]),
    supabase.from("pedidos_resumo").select("id, numero, cliente_nome, status, data_entrega_prevista").in("status", ["aberto", "em_producao", "pronto"]).order("data_entrega_prevista", { nullsFirst: false }),
    supabase.from("ordens_producao").select("etapa").neq("etapa", "concluido"),
    supabase.from("lancamentos").select("tipo, valor").is("pago_em", null).lt("vencimento", hoje),
    supabase.from("lancamentos").select("tipo, valor").is("pago_em", null).gte("vencimento", hoje).lte("vencimento", daqui7),
    supabase.from("produtos").select("estoque_atual, estoque_minimo, tipo").eq("ativo", true).neq("tipo", "servico"),
  ]);

  const somar = (rows: { tipo: string; valor: number }[] | null, t: string) => (rows ?? []).filter((r) => r.tipo === t).reduce((s, r) => s + Number(r.valor), 0);
  const valorOrc = (orcAbertos.data ?? []).reduce((s, o) => s + Number(o.total), 0);
  const repor = (produtos.data ?? []).filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo)).length;

  const cards = [
    { rotulo: "Orçamentos em aberto", valor: `${orcAbertos.data?.length ?? 0}`, sub: brl(valorOrc), href: "/orcamentos?status=enviado" },
    { rotulo: "Pedidos em andamento", valor: `${pedidosAtivos.data?.length ?? 0}`, sub: `${ordens.data?.length ?? 0} OPs na produção`, href: "/producao" },
    { rotulo: "A receber esta semana", valor: brl(somar(semana.data, "receber")), sub: `vencido: ${brl(somar(vencidos.data, "receber"))}`, href: "/financeiro?tipo=receber" },
    { rotulo: "A pagar esta semana", valor: brl(somar(semana.data, "pagar")), sub: `vencido: ${brl(somar(vencidos.data, "pagar"))}`, href: "/financeiro?tipo=pagar" },
    { rotulo: "Itens para repor", valor: `${repor}`, sub: "abaixo do estoque mínimo", href: "/estoque?baixo=1" },
  ];

  return (
    <>
      <Titulo>Painel</Titulo>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.rotulo} href={c.href}>
            <Cartao className="h-full hover:border-amber-600">
              <div className="text-sm text-stone-500">{c.rotulo}</div>
              <div className="text-2xl font-semibold">{c.valor}</div>
              <div className="text-xs text-stone-500">{c.sub}</div>
            </Cartao>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Próximas entregas</h2>
      <Cartao>
        {pedidosAtivos.data?.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {pedidosAtivos.data.slice(0, 10).map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <Link href={`/pedidos/${p.id}`} className="text-amber-800 hover:underline">#{p.numero} · {p.cliente_nome}</Link>
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
    </>
  );
}
