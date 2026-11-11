import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Indicador, Tabela, Titulo } from "@/components/ui";
import { ROTULOS, brl, hojeISO, pct } from "@/lib/format";
import { Colunas } from "@/components/graficos/graficos";
import { Legenda } from "@/components/graficos/paineis";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function somaPor<T>(lista: T[], chave: (x: T) => string, valor: (x: T) => number) {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default async function RelatoriosPage({ searchParams }: PageProps<"/relatorios">) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const unidade = sp.unidade === "marcenaria" || sp.unidade === "loja" ? sp.unidade : null;
  const [ano, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const proximo = new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 10);
  const inicio12 = new Date(Date.UTC(ano, m - 12, 1)).toISOString().slice(0, 10);
  const mesDe = (d: number) => new Date(Date.UTC(ano, m - 1 + d, 1)).toISOString().slice(0, 7);

  const supabase = await createClient();
  let qPed = supabase.from("pedidos_resumo").select("id, numero, criado_em, total, lucro, unidade, vendedor_id, cliente_nome").gte("criado_em", inicio12).lt("criado_em", proximo).neq("status", "cancelado");
  let qCaixa = supabase.from("lancamentos").select("tipo, valor, categoria, unidade").gte("pago_em", inicio).lt("pago_em", proximo);
  let qNeg = supabase.from("negociacoes").select("etapa, origem, valor_estimado, motivo_perda, unidade").gte("criado_em", inicio12).lt("criado_em", proximo);
  if (unidade) {
    qPed = qPed.eq("unidade", unidade);
    qCaixa = qCaixa.eq("unidade", unidade);
    qNeg = qNeg.eq("unidade", unidade);
  }
  const [{ data: pedidos12 }, { data: caixa }, { data: negs }, { data: vendedores }] = await Promise.all([
    qPed, qCaixa, qNeg,
    supabase.from("parceiros").select("id, nome").eq("tipo", "vendedor"),
  ]);

  const doMes = (pedidos12 ?? []).filter((p) => p.criado_em >= inicio);
  const vendido = doMes.reduce((s, p) => s + Number(p.total), 0);
  const lucro = doMes.reduce((s, p) => s + Number(p.lucro), 0);
  const entradas = (caixa ?? []).filter((l) => l.tipo === "receber").reduce((s, l) => s + Number(l.valor), 0);
  const saidas = (caixa ?? []).filter((l) => l.tipo === "pagar");
  const totalSaidas = saidas.reduce((s, l) => s + Number(l.valor), 0);
  const despesas = somaPor(saidas, (l) => l.categoria ?? "Sem categoria", (l) => Number(l.valor));

  const nomeVend = new Map((vendedores ?? []).map((v) => [v.id, v.nome]));
  const porVendedor = somaPor(doMes, (p) => (p.vendedor_id ? nomeVend.get(p.vendedor_id) ?? "—" : "Sem vendedor"), (p) => Number(p.total));
  const lucroVend = new Map(somaPor(doMes, (p) => (p.vendedor_id ? nomeVend.get(p.vendedor_id) ?? "—" : "Sem vendedor"), (p) => Number(p.lucro)));
  const qtdVend = new Map(somaPor(doMes, (p) => (p.vendedor_id ? nomeVend.get(p.vendedor_id) ?? "—" : "Sem vendedor"), () => 1));

  const meses = Array.from({ length: 12 }, (_, i) => mesDe(i - 11));
  const serie = meses.map((mm) => {
    const ps = (pedidos12 ?? []).filter((p) => p.criado_em.slice(0, 7) === mm);
    return { mes: mm, vendido: ps.reduce((s, p) => s + Number(p.total), 0), lucro: ps.reduce((s, p) => s + Number(p.lucro), 0), qtd: ps.length };
  });

  const origens = new Map<string, { total: number; ganhos: number; perdidos: number; valorGanho: number }>();
  for (const n of negs ?? []) {
    const o = n.origem?.trim() || "Não informada";
    const r = origens.get(o) ?? { total: 0, ganhos: 0, perdidos: 0, valorGanho: 0 };
    r.total++;
    if (n.etapa === "ganho") { r.ganhos++; r.valorGanho += Number(n.valor_estimado ?? 0); }
    if (n.etapa === "perdido") r.perdidos++;
    origens.set(o, r);
  }
  const motivos = somaPor((negs ?? []).filter((n) => n.etapa === "perdido"), (n) => n.motivo_perda?.trim() || "Não informado", () => 1);

  const qs = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams({ mes, ...(unidade ? { unidade } : {}) });
    for (const [k, v] of Object.entries(mudar)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/relatorios?${p}`;
  };
  const nomeMes = `${MESES[m - 1]}/${ano}`;

  return (
    <>
      <Titulo sub="Vendas e lucro pelo mês do pedido; caixa pelo dia em que o dinheiro entrou ou saiu">Relatórios</Titulo>

      <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
        <Link href={qs({ mes: mesDe(-1) })} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 hover:border-violeta/40">←</Link>
        <span className="min-w-24 text-center text-lg font-semibold">{nomeMes}</span>
        <Link href={qs({ mes: mesDe(1) })} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 hover:border-violeta/40">→</Link>
        <span className="mx-2 h-5 w-px bg-stone-200" />
        {([null, "marcenaria", "loja"] as const).map((u) => (
          <Link key={u ?? "todas"} href={qs({ unidade: u })} className={`rounded-full px-3 py-1.5 ${unidade === u ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-white"}`}>
            {u ? ROTULOS.unidade[u] : "Todas as unidades"}
          </Link>
        ))}
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Vendido no mês" valor={brl(vendido)} sub={`${doMes.length} pedidos · ticket médio ${brl(doMes.length ? vendido / doMes.length : 0)}`} />
        <Indicador rotulo="Lucro previsto" valor={brl(lucro)} sub={`margem ${pct(vendido ? (lucro / vendido) * 100 : 0)}`} cor={lucro >= 0 ? "verde" : "vermelho"} />
        <Indicador rotulo="Entrou no caixa" valor={brl(entradas)} sub="recebimentos do mês" cor="verde" />
        <Indicador rotulo="Saldo do caixa" valor={brl(entradas - totalSaidas)} sub={`saiu ${brl(totalSaidas)}`} cor={entradas - totalSaidas >= 0 ? "verde" : "vermelho"} />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Vendas nos últimos 12 meses</h2>
        <Cartao>
          <Colunas
            rotulos={serie.map((s) => MESES[Number(s.mes.slice(5)) - 1])}
            series={[{ nome: "Vendido", valores: serie.map((s) => s.vendido) }, { nome: "Lucro", valores: serie.map((s) => s.lucro) }]}
            destaque={serie.findIndex((s) => s.mes === mes)}
            links={serie.map((s) => qs({ mes: s.mes }))}
            altura={240}
          />
          <div className="mt-3"><Legenda itens={[{ nome: "Vendido" }, { nome: "Lucro" }]} /></div>
        </Cartao>
      </section>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Vendas por vendedor · {nomeMes}</h2>
          <Tabela cabecalho={["Vendedor", "Pedidos", "Vendido", "Lucro"]} vazio={!porVendedor.length}>
            {porVendedor.map(([nome, valor]) => (
              <tr key={nome}>
                <td className="py-3 font-medium">{nome}</td>
                <td className="py-3">{qtdVend.get(nome)}</td>
                <td className="py-3 font-mono">{brl(valor)}</td>
                <td className="py-3 font-mono">{brl(lucroVend.get(nome))}</td>
              </tr>
            ))}
          </Tabela>
        </section>
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Para onde foi o dinheiro · {nomeMes}</h2>
          <Cartao>
            {despesas.length ? (
              <ul className="space-y-3">
                {despesas.map(([cat, valor]) => (
                  <li key={cat}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-stone-700">{cat}</span><span className="font-mono text-stone-900">{brl(valor)}</span></div>
                    <div className="h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-rosa/70" style={{ width: `${(valor / totalSaidas) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-400">Nenhum pagamento feito neste mês.</p>}
          </Cartao>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">De onde vêm os clientes · últimos 12 meses</h2>
          <Tabela cabecalho={["Origem", "Contatos", "Fechados", "Conversão", "Valor fechado"]} vazio={!origens.size}>
            {[...origens.entries()].sort((a, b) => b[1].total - a[1].total).map(([o, r]) => (
              <tr key={o}>
                <td className="py-3 font-medium">{o}</td>
                <td className="py-3">{r.total}</td>
                <td className="py-3">{r.ganhos}</td>
                <td className="py-3">{pct(r.total ? (r.ganhos / r.total) * 100 : 0)}</td>
                <td className="py-3 font-mono">{brl(r.valorGanho)}</td>
              </tr>
            ))}
          </Tabela>
        </section>
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Por que perdemos vendas · últimos 12 meses</h2>
          <Cartao>
            {motivos.length ? (
              <ul className="divide-y divide-stone-100 text-sm">
                {motivos.map(([mot, n]) => <li key={mot} className="flex justify-between py-2"><span>{mot}</span><span className="font-mono text-stone-500">{n}</span></li>)}
              </ul>
            ) : <p className="text-sm text-stone-400">Nenhuma venda perdida registrada.</p>}
          </Cartao>
        </section>
      </div>
    </>
  );
}
