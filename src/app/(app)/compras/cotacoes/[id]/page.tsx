import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Selo, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoExcluir } from "@/components/acoes";
import { Copiar } from "@/components/copiar";
import { brl, data, linkWhats } from "@/lib/format";
import { COR_COTACAO, COR_COMPRA, STATUS_COTACAO, STATUS_COMPRA, qtd, type StatusCompra, type StatusCotacao } from "@/lib/estoque";
import { adicionarFornecedorCotacao, adicionarItemCotacao, cancelarCotacao, fecharCotacao, removerFornecedorCotacao, removerItemCotacao, salvarRespostas } from "../../actions";

type Item = { id: string; produto_id: string | null; descricao: string; quantidade: number; unidade: string; pedido: { numero: number; cliente: { nome: string } | null } | null; precos: { fornecedor_id: string; preco_unitario: number }[] };
type Forn = { id: string; fornecedor_id: string; prazo_entrega_dias: number | null; condicao_pagamento: string | null; frete: number; fornecedor: { nome: string; telefone: string | null; contato: string | null } | null };

const dec = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

/** Mapa da cotação: itens nas linhas, fornecedores nas colunas; o menor preço de cada item fica marcado. */
export default async function CotacaoPage({ params }: PageProps<"/compras/cotacoes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: cot }, { data: itensDb }, { data: fornsDb }, { data: todosForn }, { data: produtos }, { data: compras }, { data: cfg }, { data: pedidos }] = await Promise.all([
    supabase.from("cotacoes").select("*").eq("id", id).maybeSingle(),
    supabase.from("cotacao_itens").select("id, produto_id, descricao, quantidade, unidade, pedido:pedido_id(numero, cliente:cliente_id(nome)), precos:cotacao_precos(fornecedor_id, preco_unitario)").eq("cotacao_id", id).order("ordem"),
    supabase.from("cotacao_fornecedores").select("id, fornecedor_id, prazo_entrega_dias, condicao_pagamento, frete, fornecedor:fornecedor_id(nome, telefone, contato)").eq("cotacao_id", id),
    supabase.from("fornecedores").select("id, nome").order("nome"),
    supabase.from("produtos").select("id, nome, codigo, unidade_medida").eq("ativo", true).neq("tipo", "servico").order("nome"),
    supabase.from("compras").select("id, numero, status, fornecedor:fornecedor_id(nome)").eq("cotacao_id", id),
    supabase.from("configuracoes").select("nome_fantasia").single(),
    supabase.from("pedidos").select("id, numero, cliente:cliente_id(nome)").in("status", ["aberto", "em_producao", "pronto"]).order("numero", { ascending: false }).limit(300),
  ]);
  if (!cot) notFound();
  const itens = (itensDb ?? []) as unknown as Item[];
  const forns = (fornsDb ?? []) as unknown as Forn[];
  const status = cot.status as StatusCotacao;
  const aberta = status === "aberta";

  const preco = (i: Item, f: string) => i.precos.find((p) => p.fornecedor_id === f)?.preco_unitario;
  const menor = (i: Item) => Math.min(...i.precos.map((p) => Number(p.preco_unitario)));
  const totalDe = (f: Forn) => itens.reduce((s, i) => s + Number(preco(i, f.fornecedor_id) ?? 0) * Number(i.quantidade), 0) + Number(f.frete);
  const completo = (f: Forn) => itens.every((i) => preco(i, f.fornecedor_id) !== undefined);
  const totalMelhor = itens.reduce((s, i) => s + (i.precos.length ? menor(i) * Number(i.quantidade) : 0), 0);
  const melhorTotal = forns.filter(completo).sort((a, b) => totalDe(a) - totalDe(b))[0];

  const pedidoTexto = (f: Forn) => [
    `Olá${f.fornecedor?.contato ? `, ${f.fornecedor.contato.split(" ")[0]}` : ""}! Aqui é da ${cfg?.nome_fantasia ?? "marcenaria"}. Poderia me passar preço, prazo de entrega e condição de pagamento para:`,
    ...itens.map((i) => `• ${qtd(i.quantidade, i.unidade)} de ${i.descricao}`),
    cot.responder_ate ? `Se possível, responder até ${data(cot.responder_ate)}.` : "",
    "Obrigado!",
  ].filter(Boolean).join("\n");

  return (
    <>
      <Titulo
        sub={[`Cotação #${cot.numero}`, cot.responder_ate && `responder até ${data(cot.responder_ate)}`, cot.observacoes].filter(Boolean).join(" · ")}
        acao={
          <div className="flex flex-wrap gap-2">
            <Link href="/compras/cotacoes" className="self-center text-sm text-stone-500 hover:underline">Voltar</Link>
            {aberta && (
              <form action={cancelarCotacao.bind(null, id)}><Botao type="submit" variante="secundario">Cancelar cotação</Botao></form>
            )}
          </div>
        }
      >
        {cot.titulo}
        <Selo cor={COR_COTACAO[status]}>{STATUS_COTACAO[status]}</Selo>
      </Titulo>

      {compras && compras.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 text-sm">
          <span className="text-stone-500">Pedidos de compra gerados:</span>
          {(compras as unknown as { id: string; numero: number; status: StatusCompra; fornecedor: { nome: string } | null }[]).map((c) => (
            <Link key={c.id} href={`/compras/pedidos/${c.id}`} className="inline-flex items-center gap-2 font-medium text-madeira-800 hover:underline">
              #{c.numero} {c.fornecedor?.nome} <Selo cor={COR_COMPRA[c.status]}>{STATUS_COMPRA[c.status]}</Selo>
            </Link>
          ))}
        </div>
      )}

      {aberta && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <JanelaBotao rotulo="Incluir item" titulo="Incluir item na cotação" variante="secundario" largura="md">
            <form action={adicionarItemCotacao.bind(null, id)} className="grid gap-3 md:grid-cols-6">
              <Campo rotulo="Material do cadastro" className="md:col-span-6">
                <select name="produto_id" className={inputCls}>
                  <option value="">— Item fora do cadastro —</option>
                  {produtos?.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ""}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Descrição" className="md:col-span-4"><input name="descricao" placeholder="Se não está no cadastro" className={inputCls} /></Campo>
              <Campo rotulo="Qtd *" className="md:col-span-1"><input name="quantidade" required inputMode="decimal" className={inputCls} /></Campo>
              <Campo rotulo="Unid." className="md:col-span-1"><input name="unidade" className={inputCls} /></Campo>
              <Campo rotulo="Para qual cliente (opcional)" className="md:col-span-6">
                <select name="pedido_id" className={inputCls}>
                  <option value="">Estoque (sem cliente)</option>
                  {(pedidos as unknown as { id: string; numero: number; cliente: { nome: string } | null }[] | null)?.map((p) => <option key={p.id} value={p.id}>{p.cliente?.nome} · pedido #{p.numero}</option>)}
                </select>
              </Campo>
              <div className="md:col-span-6"><Botao type="submit">Incluir</Botao></div>
            </form>
          </JanelaBotao>
          <JanelaBotao rotulo="Convidar fornecedor" titulo="Convidar fornecedor" variante="secundario" largura="sm">
            <form action={adicionarFornecedorCotacao.bind(null, id)} className="flex flex-col gap-3">
              <select name="fornecedor_id" required className={inputCls}>
                <option value="">Escolha</option>
                {todosForn?.filter((f) => !forns.some((x) => x.fornecedor_id === f.id)).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <Botao type="submit">Convidar</Botao>
            </form>
          </JanelaBotao>
        </div>
      )}

      <form action={salvarRespostas.bind(null, id)}>
        <div className="vidro overflow-x-auto rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 align-top">
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Item</th>
                <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Qtd</th>
                {forns.map((f) => {
                  const whats = linkWhats(f.fornecedor?.telefone, pedidoTexto(f));
                  return (
                    <th key={f.id} className="min-w-[200px] px-5 py-3 font-normal normal-case">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-900">{f.fornecedor?.nome}</span>
                        {aberta && <BotaoExcluir acao={removerFornecedorCotacao.bind(null, id, f.fornecedor_id)} titulo="Tirar este fornecedor da cotação?" detalhe={<strong>{f.fornecedor?.nome}</strong>} aviso="Fornecedor retirado" />}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <Copiar texto={pedidoTexto(f)} rotulo="Copiar pedido" />
                        {whats && aberta && <a href={whats} target="_blank" rel="noreferrer" className="font-semibold text-[#1da851] hover:underline">WhatsApp</a>}
                      </div>
                      {melhorTotal?.id === f.id && itens.length > 0 && <div className="mt-1"><Selo cor="green">menor total</Selo></div>}
                    </th>
                  );
                })}
                {aberta && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 [&_td]:px-5">
              {itens.map((i) => (
                <tr key={i.id}>
                  <td className="py-3 font-medium">
                    {i.produto_id ? <Link href={`/estoque/${i.produto_id}`} className="text-madeira-800 hover:underline">{i.descricao}</Link> : i.descricao}
                    {i.pedido && <div className="text-xs font-normal text-stone-500">para {i.pedido.cliente?.nome} · pedido #{i.pedido.numero}</div>}
                  </td>
                  <td className="py-3">{qtd(i.quantidade, i.unidade)}</td>
                  {forns.map((f) => {
                    const p = preco(i, f.fornecedor_id);
                    const eMenor = p !== undefined && i.precos.length > 1 && Number(p) === menor(i);
                    return (
                      <td key={f.id} className="py-2">
                        {aberta
                          ? <input name={`p:${i.id}:${f.fornecedor_id}`} defaultValue={dec(p)} inputMode="decimal" placeholder="R$ unit." className={`${inputCls} w-28 ${eMenor ? "border-neon/60 ring-2 ring-neon/20" : ""}`} />
                          : <span className={eMenor ? "font-semibold text-neon" : ""}>{p !== undefined ? brl(p) : "—"}</span>}
                        {p !== undefined && <div className="mt-1 text-xs text-stone-500">{brl(Number(p) * Number(i.quantidade))}</div>}
                      </td>
                    );
                  })}
                  {aberta && <td className="py-2"><BotaoExcluir acao={removerItemCotacao.bind(null, id, i.id)} titulo="Tirar este item da cotação?" detalhe={<strong>{i.descricao}</strong>} aviso="Item retirado" /></td>}
                </tr>
              ))}
              {forns.length > 0 && (
                <>
                  <tr className="bg-stone-50/60">
                    <td className="py-2 text-xs font-medium uppercase tracking-[0.12em] text-stone-500" colSpan={2}>Prazo de entrega (dias)</td>
                    {forns.map((f) => <td key={f.id} className="py-2">{aberta ? <input name={`prazo:${f.fornecedor_id}`} defaultValue={dec(f.prazo_entrega_dias)} inputMode="numeric" className={`${inputCls} w-20`} /> : f.prazo_entrega_dias ?? "—"}</td>)}
                    {aberta && <td />}
                  </tr>
                  <tr className="bg-stone-50/60">
                    <td className="py-2 text-xs font-medium uppercase tracking-[0.12em] text-stone-500" colSpan={2}>Frete (R$)</td>
                    {forns.map((f) => <td key={f.id} className="py-2">{aberta ? <input name={`frete:${f.fornecedor_id}`} defaultValue={dec(f.frete || null)} inputMode="decimal" className={`${inputCls} w-24`} /> : brl(f.frete)}</td>)}
                    {aberta && <td />}
                  </tr>
                  <tr className="bg-stone-50/60">
                    <td className="py-2 text-xs font-medium uppercase tracking-[0.12em] text-stone-500" colSpan={2}>Pagamento</td>
                    {forns.map((f) => <td key={f.id} className="py-2">{aberta ? <input name={`cond:${f.fornecedor_id}`} defaultValue={f.condicao_pagamento ?? ""} placeholder="28 dias, à vista..." className={`${inputCls} w-36`} /> : f.condicao_pagamento ?? "—"}</td>)}
                    {aberta && <td />}
                  </tr>
                  <tr className="border-t border-stone-200">
                    <td className="py-3 font-semibold" colSpan={2}>Total com frete</td>
                    {forns.map((f) => <td key={f.id} className="py-3 font-mono font-semibold">{brl(totalDe(f))}{!completo(f) && itens.length > 0 && <div className="font-sans text-xs font-normal text-stone-400">faltam preços</div>}</td>)}
                    {aberta && <td />}
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {(!itens.length || !forns.length) && <p className="p-8 text-center text-sm text-stone-400">{!itens.length ? "Inclua os itens da cotação." : "Convide pelo menos um fornecedor."}</p>}
        </div>

        {aberta && itens.length > 0 && forns.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <Botao type="submit" variante="secundario">Salvar respostas</Botao>
            <Botao type="submit" formAction={fecharCotacao.bind(null, id, "melhor")} variante="secundario">Comprar cada item do mais barato ({brl(totalMelhor)} sem frete)</Botao>
            {melhorTotal && <Botao type="submit" formAction={fecharCotacao.bind(null, id, melhorTotal.fornecedor_id)}>Fechar tudo com {melhorTotal.fornecedor?.nome}</Botao>}
          </div>
        )}
        {aberta && <p className="mt-2 text-right text-xs text-stone-500">Ao fechar, as respostas são salvas e os pedidos de compra são criados como rascunho para você conferir e enviar.</p>}
      </form>
    </>
  );
}
