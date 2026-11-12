import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { ROTULOS, ROTULOS2, brl, data, hojeISO, linkWhats, preencher } from "@/lib/format";
import { atualizarMarco, criarOrdem, gerarParcelas, lancarComissoes, mudarStatusPedido } from "../actions";
import { Previsao } from "../../orcamentos/previsao";
import { JanelaBotao } from "@/components/janela";

export default async function PedidoPage({ params }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: itens }, { data: ordens }, { data: parcelas }, { data: marcos }, { data: montadores }, { data: cfg }] = await Promise.all([
    supabase.from("pedidos_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("ordem"),
    supabase.from("ordens_producao").select("*").eq("pedido_id", id).order("numero"),
    supabase.from("lancamentos").select("*").eq("pedido_id", id).eq("tipo", "receber").order("vencimento"),
    supabase.from("pedido_marcos").select("*").eq("pedido_id", id),
    supabase.from("parceiros").select("id, nome").eq("tipo", "montador").eq("ativo", true).order("nome"),
    supabase.from("configuracoes").select("margem_minima, nome_fantasia, msg_agendamento, msg_cobranca, msg_pos_venda").single(),
  ]);
  const ordemMarcos = Object.keys(ROTULOS2.marco);
  const marcosOrdenados = (marcos ?? []).sort((a, b) => ordemMarcos.indexOf(a.tipo) - ordemMarcos.indexOf(b.tipo));
  const hoje = hojeISO();
  if (!p) notFound();
  const { data: cli } = await supabase.from("clientes").select("telefone").eq("id", p.cliente_id).maybeSingle();
  const marcoIds = (marcos ?? []).map((m) => m.id);
  const { data: visitas } = marcoIds.length
    ? await supabase.from("visitas").select("id, marco_id, checkin_em, checkout_em, observacoes, fotos, latitude, longitude, parceiro:parceiro_id(nome)").in("marco_id", marcoIds).order("checkin_em", { ascending: false })
    : { data: [] };
  const fotos = (visitas ?? []).flatMap((v) => v.fotos ?? []);
  const { data: urls } = fotos.length ? await supabase.storage.from("fotos").createSignedUrls(fotos, 3600) : { data: [] };
  const urlDe = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  const primeiroNome = p.cliente_nome?.split(" ")[0];
  const zap = (modelo: string | null | undefined, extra: Record<string, string>) =>
    linkWhats(cli?.telefone, preencher(modelo ?? "", { cliente: primeiroNome, empresa: cfg?.nome_fantasia, ...extra }));
  const recebido = parcelas?.filter((l) => l.pago_em).reduce((s, l) => s + Number(l.valor), 0) ?? 0;
  const lancado = parcelas?.reduce((s, l) => s + Number(l.valor), 0) ?? 0;

  return (
    <>
      <Titulo
        acao={
          <div className="flex flex-wrap gap-2">
            {p.status === "entregue" && (() => {
              const link = zap(cfg?.msg_pos_venda, {});
              return link ? <a href={link} target="_blank" rel="noreferrer" className="rounded-full bg-[#25d366] px-5 py-2 text-sm font-semibold text-white">Pós-venda no WhatsApp</a> : null;
            })()}
            <Link href={`/pedidos/${id}/contrato`} className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:border-violeta/40 hover:text-violeta">Contrato nº {p.numero}/{p.criado_em.slice(0, 4)} (PDF)</Link>
          </div>
        }
      >
        Pedido #{p.numero}
      </Titulo>
      <p className="mb-6 text-sm text-stone-600">
        Cliente: <Link href={`/clientes/${p.cliente_id}`} className="font-medium text-madeira-800 hover:underline">{p.cliente_nome}</Link>
        {p.orcamento_id && <> · <Link href={`/orcamentos/${p.orcamento_id}`} className="text-madeira-800 hover:underline">ver orçamento</Link></>}
        {" · "}{ROTULOS.unidade[p.unidade as keyof typeof ROTULOS.unidade]}
      </p>

      <Cartao className="mb-8">
        <form action={mudarStatusPedido.bind(null, id)} className="flex flex-wrap items-end gap-4">
          <Campo rotulo="Status">
            <select name="status" defaultValue={p.status} className={inputCls}>
              {Object.entries(ROTULOS.statusPedido).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Entrega prevista">
            <input type="date" name="data_entrega_prevista" defaultValue={p.data_entrega_prevista ?? ""} className={inputCls} />
          </Campo>
          <Botao type="submit">Salvar</Botao>
        </form>
      </Cartao>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <Previsao r={p} margemMinima={Number(cfg?.margem_minima ?? 0)} titulo="Resultado do pedido" />
          <Cartao className="mt-4">
            <h3 className="mb-2 font-semibold">Comissões</h3>
            <p className="text-sm text-stone-600">
              Vendedor: {brl(p.valor_comissao_vendedor)} · RT: {brl(p.valor_comissao_arquiteto)}
            </p>
            {p.comissoes_lancadas ? (
              <p className="mt-2 text-sm text-green-700">Já lançadas no financeiro (a pagar).</p>
            ) : (Number(p.valor_comissao_vendedor) + Number(p.valor_comissao_arquiteto) > 0) ? (
              <form action={lancarComissoes.bind(null, id)} className="mt-3"><Botao variante="secundario">Lançar comissões no financeiro</Botao></form>
            ) : (
              <p className="mt-2 text-sm text-stone-400">Sem comissões neste pedido.</p>
            )}
          </Cartao>
        </div>
        <Cartao>
          <h3 className="mb-3 font-semibold">Marcos de prazo</h3>
          <div className="flex flex-col divide-y divide-stone-100">
            {marcosOrdenados.map((m) => {
              const atrasado = !m.realizado && m.previsto && m.previsto < hoje;
              return (
                <form key={m.id} action={atualizarMarco.bind(null, id, m.id)} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className={`w-40 font-medium ${m.realizado ? "text-green-700" : atrasado ? "text-red-600" : ""}`}>
                    {m.realizado ? "✓ " : atrasado ? "! " : ""}{ROTULOS2.marco[m.tipo as keyof typeof ROTULOS2.marco]}
                  </span>
                  <input type="date" name="previsto" defaultValue={m.previsto ?? ""} className={`${inputCls} py-1`} title="Previsto" />
                  <input type="date" name="realizado" defaultValue={m.realizado ?? ""} className={`${inputCls} py-1`} title="Realizado" />
                  {(m.tipo === "montagem" || m.tipo === "entrega" || m.tipo === "medicao" || m.tipo === "vistoria") && (
                    <select name="responsavel_id" defaultValue={m.responsavel_id ?? ""} className={`${inputCls} py-1`}>
                      <option value="">responsável</option>
                      {montadores?.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                  )}
                  <button className="text-xs text-madeira-700 hover:underline">salvar</button>
                  {!m.realizado && <button name="concluir" value="1" className="text-xs text-green-700 hover:underline">feito hoje</button>}
                  {!m.realizado && m.previsto && ["medicao", "entrega", "montagem", "vistoria"].includes(m.tipo) && (() => {
                    const link = zap(cfg?.msg_agendamento, { etapa: ROTULOS2.marco[m.tipo as keyof typeof ROTULOS2.marco].toLowerCase(), data: data(m.previsto) });
                    return link ? <a href={link} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#1da851] hover:underline">avisar cliente</a> : null;
                  })()}
                </form>
              );
            })}
            {!marcosOrdenados.length && <p className="text-sm text-stone-400">Sem marcos para este pedido.</p>}
          </div>
          <p className="mt-2 text-xs text-stone-500">Primeira data: previsto. Segunda: realizado.</p>
        </Cartao>
      </div>

      {(visitas?.length ?? 0) > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Registros de campo</h2>
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            {visitas!.map((v) => {
              const marco = marcos?.find((m) => m.id === v.marco_id);
              const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
              return (
                <Cartao key={v.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{marco ? ROTULOS2.marco[marco.tipo as keyof typeof ROTULOS2.marco] : "Visita"}</span>
                    <span className="text-xs text-stone-500">{(v.parceiro as unknown as { nome: string } | null)?.nome}</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Chegada {hora(v.checkin_em)}{v.checkout_em ? ` · saída ${hora(v.checkout_em)}` : " · em andamento"}
                    {v.latitude && <> · <a className="text-violeta hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}>local do check-in</a></>}
                  </p>
                  {v.observacoes && <p className="mt-2 text-sm text-stone-700">{v.observacoes}</p>}
                  {(v.fotos?.length ?? 0) > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {v.fotos!.map((f: string) => urlDe.get(f) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={f} href={urlDe.get(f)!} target="_blank" rel="noreferrer"><img src={urlDe.get(f)!} alt="" className="aspect-square w-full rounded-lg object-cover" /></a>
                      ))}
                    </div>
                  )}
                </Cartao>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-semibold">Itens</h2>
      <Tabela cabecalho={["Ambiente", "Descrição", "Qtd", "Valor unit.", "Total"]} vazio={!itens?.length}>
        {itens?.map((i) => (
          <tr key={i.id}>
            <td className="px-4 py-3">{i.ambiente ?? "—"}</td>
            <td className="px-4 py-3">{i.descricao}</td>
            <td className="px-4 py-3">{Number(i.quantidade)}</td>
            <td className="px-4 py-3">{brl(i.preco_unitario)}</td>
            <td className="px-4 py-3">{brl(Number(i.quantidade) * Number(i.preco_unitario))}</td>
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 mb-8 text-right text-lg font-semibold">Total: {brl(p.total)}</p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Produção</h2>
        <JanelaBotao rotulo="Nova ordem de produção" titulo="Nova ordem de produção" descricao={`Pedido #${p.numero}`} variante="secundario" largura="xl">
          <form action={criarOrdem.bind(null, id)} className="grid gap-3 md:grid-cols-12">
            <Campo rotulo="Descrição" className="md:col-span-5">
              <input name="descricao" placeholder="Cozinha completa" className={inputCls} />
            </Campo>
            <Campo rotulo="Responsável" className="md:col-span-3">
              <input name="responsavel" className={inputCls} />
            </Campo>
            <Campo rotulo="Prazo" className="md:col-span-2">
              <input type="date" name="prazo" defaultValue={p.data_entrega_prevista ?? ""} className={inputCls} />
            </Campo>
            <div className="flex items-end md:col-span-2"><Botao type="submit">Criar OP</Botao></div>
          </form>
        </JanelaBotao>
      </div>
      <div className="mb-8">
        <Tabela cabecalho={["OP", "Descrição", "Etapa", "Responsável", "Prazo"]} vazio={!ordens?.length}>
          {ordens?.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3">#{o.numero}</td>
              <td className="px-4 py-3">{o.descricao}</td>
              <td className="px-4 py-3"><Selo cor="amber">{ROTULOS.etapa[o.etapa as keyof typeof ROTULOS.etapa]}</Selo></td>
              <td className="px-4 py-3">{o.responsavel ?? "—"}</td>
              <td className="px-4 py-3">{data(o.prazo)}</td>
            </tr>
          ))}
        </Tabela>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Recebimentos</h2>
        {Number(p.total) - lancado > 0.009 && (
          <JanelaBotao rotulo="Gerar parcelas" titulo="Gerar parcelas a receber" descricao={`Divide o que falta lançar (${brl(Number(p.total) - lancado)}) em entrada + parcelas mensais.`} variante="secundario" largura="xl">
            <form action={gerarParcelas.bind(null, id)} className="grid gap-3 md:grid-cols-12">
              <Campo rotulo="Entrada (R$)" className="md:col-span-2">
                <input name="entrada" inputMode="decimal" className={inputCls} />
              </Campo>
              <Campo rotulo="Nº de parcelas" className="md:col-span-2">
                <input name="parcelas" type="number" min={0} defaultValue={p.parcelas ?? 1} className={inputCls} />
              </Campo>
              <Campo rotulo="1º vencimento" className="md:col-span-3">
                <input name="primeiro_vencimento" type="date" className={inputCls} />
              </Campo>
              <Campo rotulo="Forma de pagamento" className="md:col-span-3">
                <input name="forma_pagamento" defaultValue={ROTULOS2.formaPagamento[p.forma_pagamento as keyof typeof ROTULOS2.formaPagamento] ?? ""} className={inputCls} />
              </Campo>
              <div className="flex items-end md:col-span-2"><Botao type="submit">Gerar</Botao></div>
            </form>
          </JanelaBotao>
        )}
      </div>
      <div className="mb-4">
        <Tabela cabecalho={["Descrição", "Vencimento", "Valor", "Situação", ""]} vazio={!parcelas?.length}>
          {parcelas?.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-3">{l.descricao}</td>
              <td className="px-4 py-3">{data(l.vencimento)}</td>
              <td className="px-4 py-3">{brl(l.valor)}</td>
              <td className="px-4 py-3">{l.pago_em ? <Selo cor="green">Recebido {data(l.pago_em)}</Selo> : <Selo>Em aberto</Selo>}</td>
              <td className="px-4 py-3 text-right">
                {!l.pago_em && (() => {
                  const link = zap(cfg?.msg_cobranca, { valor: brl(l.valor), data: data(l.vencimento) });
                  return link ? <a href={link} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#1da851] hover:underline">lembrar no WhatsApp</a> : null;
                })()}
              </td>
            </tr>
          ))}
        </Tabela>
        <p className="mt-2 text-right text-sm text-stone-600">Lançado {brl(lancado)} · Recebido {brl(recebido)} · Falta lançar {brl(Number(p.total) - lancado)}</p>
      </div>
    </>
  );
}
