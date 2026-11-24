import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Indicador, Selo, Tabela, Titulo } from "@/components/ui";
import { brl, data, pct } from "@/lib/format";
import { centavos, faixaDoValor, type Faixa, type Regra } from "@/lib/comissoes";
import { TrocarMes } from "../funcionarios/componentes";
import { hojeSP, limitesDoMes, mesValido } from "@/lib/funcionarios";

type Pedido = {
  id: string; numero: number; cliente_nome: string | null; criado_em: string; total: number;
  vendedor_id: string | null; arquiteto_id: string | null; comissao_arquiteto_pct: number | null;
};

/** Comissões do mês calculadas pelas regras: comercial por faixa, RT por pedido e equipe sobre as vendas gerais. */
export default async function ComissoesPage({ searchParams }: PageProps<"/comissoes">) {
  await connection();
  const sp = await searchParams;
  const mes = mesValido(sp.mes) ? sp.mes : hojeSP().slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);

  const supabase = await createClient();
  const [{ data: pedidosBrutos }, { data: parceiros }, { data: regrasBrutas }, { data: faixasBrutas }] = await Promise.all([
    supabase
      .from("pedidos_resumo")
      .select("id, numero, cliente_nome, criado_em, total, vendedor_id, arquiteto_id, comissao_arquiteto_pct")
      .gte("criado_em", `${inicio}T00:00:00-03:00`)
      .lte("criado_em", `${fim}T23:59:59.999-03:00`)
      .neq("status", "cancelado")
      .order("numero"),
    supabase.from("parceiros").select("id, nome, tipo"),
    supabase.from("comissao_regras").select("*").order("ordem"),
    supabase.from("comissao_faixas").select("*").order("a_partir_de"),
  ]);
  const pedidos = (pedidosBrutos ?? []) as Pedido[];
  const regras = (regrasBrutas ?? []) as Regra[];
  const faixas = (faixasBrutas ?? []) as Faixa[];
  const nome = (id: string | null) => parceiros?.find((p) => p.id === id)?.nome ?? "—";

  const vendasMes = pedidos.reduce((s, p) => s + Number(p.total), 0);
  const rt = regras.find((r) => r.tipo === "rt");
  const comercial = regras.find((r) => r.tipo === "comercial");
  const equipe = regras.filter((r) => r.tipo === "equipe" && r.ativo);

  // Comercial: total de cada vendedor no mês → faixa
  const porVendedor = [...new Set(pedidos.map((p) => p.vendedor_id).filter(Boolean))].map((id) => {
    const meus = pedidos.filter((p) => p.vendedor_id === id);
    const vendido = meus.reduce((s, p) => s + Number(p.total), 0);
    const { percentual, proxima } = comercial?.ativo === false ? { percentual: 0, proxima: null } : faixaDoValor(vendido, faixas);
    return { id: id!, nome: nome(id), meus, vendido, percentual, proxima, valor: centavos((vendido * percentual) / 100) };
  }).sort((a, b) => b.vendido - a.vendido);
  const semVendedor = pedidos.filter((p) => !p.vendedor_id);

  // RT: cada pedido com arquiteto
  const rtPct = rt?.ativo === false ? 0 : Number(rt?.percentual ?? 0);
  const porArquiteto = [...new Set(pedidos.map((p) => p.arquiteto_id).filter(Boolean))].map((id) => {
    const meus = pedidos.filter((p) => p.arquiteto_id === id).map((p) => {
      const pc = Number(p.comissao_arquiteto_pct) > 0 ? Number(p.comissao_arquiteto_pct) : rtPct;
      return { ...p, pc, valor: centavos((Number(p.total) * pc) / 100) };
    });
    return { id: id!, nome: nome(id), meus, vendido: meus.reduce((s, p) => s + Number(p.total), 0), valor: meus.reduce((s, p) => s + p.valor, 0) };
  }).sort((a, b) => b.valor - a.valor);

  // Equipe: % sobre as vendas gerais, a partir do mínimo
  const daEquipe = equipe.map((r) => {
    const atingiu = vendasMes >= Number(r.minimo_mes);
    return { ...r, atingiu, valor: atingiu ? centavos((vendasMes * Number(r.percentual)) / 100) : 0 };
  });

  const total = porVendedor.reduce((s, v) => s + v.valor, 0) + porArquiteto.reduce((s, a) => s + a.valor, 0) + daEquipe.reduce((s, e) => s + e.valor, 0);
  const ordemFaixas = faixas.map((f) => `${pct(f.percentual)} a partir de ${brl(f.a_partir_de)}`).join(" · ");

  return (
    <>
      <Titulo
        sub="Calculado pelas regras da aba Regras, sobre os pedidos fechados no mês (cancelados ficam de fora)."
        acao={<Link href="/comissoes/regras" className="text-sm font-medium text-madeira-700 hover:underline">Alterar as regras</Link>}
      >
        Comissões
      </Titulo>
      <div className="mb-6"><TrocarMes mes={mes} base="/comissoes" /></div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Vendas do mês" valor={brl(vendasMes)} sub={`${pedidos.length} pedido(s)`} />
        <Indicador rotulo="Total de comissões" valor={brl(total)} />
        <Indicador rotulo="Sobre as vendas" valor={vendasMes ? pct((total / vendasMes) * 100) : "—"} />
      </div>

      <h2 className="mb-1 text-lg font-semibold">Comercial</h2>
      <p className="mb-3 text-sm text-stone-500">Sobre o total que cada vendedor fechou no mês. {ordemFaixas || "Nenhuma faixa cadastrada."}</p>
      <div className="mb-8">
        <Tabela cabecalho={["Vendedor", "Pedidos", "Vendido no mês", "Faixa", "Comissão"]} vazio={!porVendedor.length}>
          {porVendedor.map((v) => (
            <tr key={v.id}>
              <td className="px-4 py-3 font-medium">{v.nome}</td>
              <td className="px-4 py-3">
                <details>
                  <summary className="cursor-pointer text-madeira-700">{v.meus.length} pedido(s)</summary>
                  <ul className="mt-2 space-y-1 text-xs text-stone-600">
                    {v.meus.map((p) => <li key={p.id}><Link href={`/pedidos/${p.id}`} className="hover:underline">#{p.numero} · {p.cliente_nome} · {data(p.criado_em)} · {brl(p.total)}</Link></li>)}
                  </ul>
                </details>
              </td>
              <td className="px-4 py-3 font-mono">{brl(v.vendido)}</td>
              <td className="px-4 py-3">
                {v.percentual ? <Selo cor="green">{pct(v.percentual)}</Selo> : <Selo>abaixo do mínimo</Selo>}
                {v.proxima && <div className="mt-1 text-xs text-stone-500">faltam {brl(Number(v.proxima.a_partir_de) - v.vendido)} para {pct(v.proxima.percentual)}</div>}
              </td>
              <td className="px-4 py-3 font-mono font-semibold">{brl(v.valor)}</td>
            </tr>
          ))}
        </Tabela>
        {semVendedor.length > 0 && <p className="mt-2 text-xs text-stone-500">{semVendedor.length} pedido(s) do mês sem vendedor escolhido ({brl(semVendedor.reduce((s, p) => s + Number(p.total), 0))}) não entram na comissão comercial.</p>}
      </div>

      <h2 className="mb-1 text-lg font-semibold">RT de arquitetos e indicadores</h2>
      <p className="mb-3 text-sm text-stone-500">{pct(rtPct)} sobre cada pedido com arquiteto. Quando o pedido tem uma % própria, vale a do pedido.</p>
      <div className="mb-8">
        <Tabela cabecalho={["Arquiteto / indicador", "Pedidos", "Vendido", "RT"]} vazio={!porArquiteto.length}>
          {porArquiteto.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3 font-medium">{a.nome}</td>
              <td className="px-4 py-3">
                <details>
                  <summary className="cursor-pointer text-madeira-700">{a.meus.length} pedido(s)</summary>
                  <ul className="mt-2 space-y-1 text-xs text-stone-600">
                    {a.meus.map((p) => <li key={p.id}><Link href={`/pedidos/${p.id}`} className="hover:underline">#{p.numero} · {p.cliente_nome} · {brl(p.total)} × {pct(p.pc)} = {brl(p.valor)}</Link></li>)}
                  </ul>
                </details>
              </td>
              <td className="px-4 py-3 font-mono">{brl(a.vendido)}</td>
              <td className="px-4 py-3 font-mono font-semibold">{brl(a.valor)}</td>
            </tr>
          ))}
        </Tabela>
      </div>

      <h2 className="mb-1 text-lg font-semibold">Equipe</h2>
      <p className="mb-3 text-sm text-stone-500">Sobre as vendas gerais do mês ({brl(vendasMes)}).</p>
      {daEquipe.length ? (
        <Tabela cabecalho={["Função", "Quem recebe", "Regra", "Comissão"]}>
          {daEquipe.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 font-medium">{e.nome}</td>
              <td className="px-4 py-3">{e.pessoa || <span className="text-stone-400">a definir</span>}</td>
              <td className="px-4 py-3">
                {pct(e.percentual)}{Number(e.minimo_mes) > 0 && <> a partir de {brl(e.minimo_mes)}</>}
                {!e.atingiu && <div className="mt-1"><Selo cor="amber">faltam {brl(Number(e.minimo_mes) - vendasMes)} para a meta</Selo></div>}
              </td>
              <td className="px-4 py-3 font-mono font-semibold">{brl(e.valor)}</td>
            </tr>
          ))}
        </Tabela>
      ) : (
        <Cartao><p className="text-sm text-stone-400">Nenhuma comissão de equipe ligada. Cadastre em Regras.</p></Cartao>
      )}
    </>
  );
}
