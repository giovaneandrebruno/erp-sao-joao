import { connection } from "next/server";
import Link from "next/link";
import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { ROTULOS, brl, data, hojeISO, linkWhats, preencher } from "@/lib/format";
import { criarLancamento, excluirLancamento, marcarPago } from "./actions";

function mesAtual() {
  return hojeISO().slice(0, 7);
}

export default async function FinanceiroPage({ searchParams }: PageProps<"/financeiro">) {
  await connection();
  const sp = await searchParams;
  const tipo = sp.tipo === "receber" || sp.tipo === "pagar" ? sp.tipo : null;
  const situacao = sp.situacao === "abertos" || sp.situacao === "pagos" || sp.situacao === "vencidos" ? sp.situacao : null;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesAtual();
  const hoje = hojeISO();

  const supabase = await createClient();
  const [ano, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const fim = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);

  const { data: cfg } = await supabase.from("configuracoes").select("nome_fantasia, msg_cobranca").single();
  let consulta = supabase
    .from("lancamentos")
    .select("id, tipo, unidade, descricao, categoria, valor, vencimento, pago_em, pedido_id, clientes(nome, telefone), fornecedores(nome)")
    .order("vencimento");
  if (situacao === "vencidos") consulta = consulta.is("pago_em", null).lt("vencimento", hoje);
  else consulta = consulta.gte("vencimento", inicio).lte("vencimento", fim);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (situacao === "abertos") consulta = consulta.is("pago_em", null);
  if (situacao === "pagos") consulta = consulta.not("pago_em", "is", null);

  const [{ data: lancamentos }, { data: fornecedores }, { data: clientes }] = await Promise.all([
    consulta,
    supabase.from("fornecedores").select("id, nome").order("nome"),
    supabase.from("clientes").select("id, nome").order("nome"),
  ]);

  const soma = (t: "receber" | "pagar", pagos?: boolean) =>
    (lancamentos ?? []).filter((l) => l.tipo === t && (pagos === undefined || Boolean(l.pago_em) === pagos)).reduce((s, l) => s + Number(l.valor), 0);
  const aReceber = soma("receber");
  const aPagar = soma("pagar");

  const link = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base = { tipo, situacao, mes, ...extra };
    Object.entries(base).forEach(([k, v]) => v && p.set(k, v));
    return `/financeiro?${p.toString()}`;
  };
  const mesAnterior = new Date(Date.UTC(ano, m - 2, 1)).toISOString().slice(0, 7);
  const mesSeguinte = new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 7);

  return (
    <>
      <Titulo acao={<FerramentasImportacao area="financeiro" />}>Financeiro</Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        {situacao !== "vencidos" && (
          <span className="flex items-center gap-2">
            <Link href={link({ mes: mesAnterior })} className="px-2 text-madeira-800">←</Link>
            <strong>{mes.split("-").reverse().join("/")}</strong>
            <Link href={link({ mes: mesSeguinte })} className="px-2 text-madeira-800">→</Link>
          </span>
        )}
        <span className="flex gap-3">
          {[[null, "Tudo"], ["receber", "A receber"], ["pagar", "A pagar"]].map(([k, r]) => (
            <Link key={r} href={link({ tipo: k })} className={tipo === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
          ))}
        </span>
        <span className="flex gap-3">
          {[[null, "Todos"], ["abertos", "Em aberto"], ["pagos", "Pagos"], ["vencidos", "Vencidos"]].map(([k, r]) => (
            <Link key={r} href={link({ situacao: k })} className={situacao === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
          ))}
        </span>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Cartao><div className="text-sm text-stone-500">Entradas</div><div className="text-xl font-semibold text-green-700">{brl(aReceber)}</div><div className="text-xs text-stone-500">recebido {brl(soma("receber", true))}</div></Cartao>
        <Cartao><div className="text-sm text-stone-500">Saídas</div><div className="text-xl font-semibold text-red-700">{brl(aPagar)}</div><div className="text-xs text-stone-500">pago {brl(soma("pagar", true))}</div></Cartao>
        <Cartao><div className="text-sm text-stone-500">Saldo previsto</div><div className="text-xl font-semibold">{brl(aReceber - aPagar)}</div></Cartao>
      </div>

      <div className="mb-8">
        <Tabela cabecalho={["Vencimento", "Descrição", "Quem", "Unidade", "Valor", "Situação", ""]} vazio={!lancamentos?.length}>
          {lancamentos?.map((l) => {
            const cli = l.clientes as unknown as { nome: string; telefone: string | null } | null;
            const cobrar = l.tipo === "receber" && !l.pago_em && cli
              ? linkWhats(cli.telefone, preencher(cfg?.msg_cobranca ?? "", { cliente: cli.nome.split(" ")[0], empresa: cfg?.nome_fantasia, valor: brl(l.valor), data: data(l.vencimento) }))
              : null;
            const quem = (l.clientes as unknown as { nome: string } | null)?.nome ?? (l.fornecedores as unknown as { nome: string } | null)?.nome ?? "—";
            const vencido = !l.pago_em && l.vencimento < hoje;
            return (
              <tr key={l.id}>
                <td className={`px-4 py-3 ${vencido ? "font-semibold text-red-600" : ""}`}>{data(l.vencimento)}</td>
                <td className="px-4 py-3">
                  {l.pedido_id ? <Link href={`/pedidos/${l.pedido_id}`} className="text-madeira-800 hover:underline">{l.descricao}</Link> : l.descricao}
                  {l.categoria && <span className="ml-2 text-xs text-stone-400">{l.categoria}</span>}
                </td>
                <td className="px-4 py-3">{quem}</td>
                <td className="px-4 py-3">{ROTULOS.unidade[l.unidade as keyof typeof ROTULOS.unidade]}</td>
                <td className={`px-4 py-3 font-medium ${l.tipo === "receber" ? "text-green-700" : "text-red-700"}`}>{l.tipo === "receber" ? "+" : "−"}{brl(l.valor)}</td>
                <td className="px-4 py-3">
                  <form action={marcarPago.bind(null, l.id, !l.pago_em)}>
                    <button title="Clique para alterar">
                      {l.pago_em ? <Selo cor="green">{l.tipo === "receber" ? "Recebido" : "Pago"} {data(l.pago_em)}</Selo> : <Selo cor={vencido ? "red" : "stone"}>Marcar {l.tipo === "receber" ? "recebido" : "pago"}</Selo>}
                    </button>
                  </form>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {cobrar && <a href={cobrar} target="_blank" rel="noreferrer" className="mr-3 text-xs font-medium text-[#1da851] hover:underline">cobrar</a>}
                  <form className="inline" action={excluirLancamento.bind(null, l.id)}><button className="text-xs text-stone-400 hover:text-red-600 hover:underline">excluir</button></form>
                </td>
              </tr>
            );
          })}
        </Tabela>
      </div>

      <Cartao>
        <h2 className="mb-3 font-semibold">Novo lançamento</h2>
        <form action={criarLancamento} className="grid gap-3 md:grid-cols-12">
          <Campo rotulo="Tipo" className="md:col-span-2">
            <select name="tipo" className={inputCls}><option value="pagar">A pagar</option><option value="receber">A receber</option></select>
          </Campo>
          <Campo rotulo="Descrição *" className="md:col-span-4">
            <input name="descricao" required placeholder="Compra de chapas, aluguel, energia..." className={inputCls} />
          </Campo>
          <Campo rotulo="Categoria" className="md:col-span-2">
            <input name="categoria" list="categorias" className={inputCls} />
            <datalist id="categorias">
              {["Matéria-prima", "Ferragens", "Salários", "Aluguel", "Energia", "Impostos", "Frete", "Manutenção", "Venda", "Outros"].map((c) => <option key={c} value={c} />)}
            </datalist>
          </Campo>
          <Campo rotulo="Valor (R$) *" className="md:col-span-2">
            <input name="valor" required inputMode="decimal" className={inputCls} />
          </Campo>
          <Campo rotulo="Vencimento *" className="md:col-span-2">
            <input name="vencimento" type="date" required defaultValue={hoje} className={inputCls} />
          </Campo>
          <Campo rotulo="Unidade" className="md:col-span-2">
            <select name="unidade" className={inputCls}><option value="marcenaria">Marcenaria</option><option value="loja">Loja</option></select>
          </Campo>
          <Campo rotulo="Fornecedor" className="md:col-span-3">
            <select name="fornecedor_id" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Cliente" className="md:col-span-3">
            <select name="cliente_id" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Forma de pagamento" className="md:col-span-2">
            <input name="forma_pagamento" className={inputCls} />
          </Campo>
          <div className="flex items-end md:col-span-2"><Botao type="submit">Lançar</Botao></div>
        </form>
      </Cartao>
    </>
  );
}
