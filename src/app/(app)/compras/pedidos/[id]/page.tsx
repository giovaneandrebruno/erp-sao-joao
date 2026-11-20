import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { Botao, Campo, Indicador, LinhaValor, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoExcluir } from "@/components/acoes";
import { Copiar } from "@/components/copiar";
import { BotaoImprimir } from "../../../pedidos/[id]/contrato/botao";
import { brl, data, hojeISO, linkWhats } from "@/lib/format";
import { COR_COMPRA, STATUS_COMPRA, qtd, totalDaCompra, type StatusCompra } from "@/lib/estoque";
import { adicionarItemCompra, marcarClienteDoItem, mudarStatusCompra, receberCompra, removerItemCompra, salvarCompra } from "../../actions";
import { ClienteDoItem } from "./cliente-item";

type Item = { id: string; produto_id: string | null; descricao: string; quantidade: number; unidade: string; preco_unitario: number; recebido: number; pedido_id: string | null; pedido: { numero: number; cliente: { nome: string } | null } | null };
type Receb = { id: string; recebido_em: string; nota_fiscal: string | null; conferido_por: string | null; observacoes: string | null; itens: { descricao: string; quantidade: number }[]; lancamento_id: string | null };

const dec = (v: number | null | undefined) => (v === null || v === undefined || Number(v) === 0 ? "" : String(v).replace(".", ","));

/** Pedido de compra: itens, envio ao fornecedor, impressão e recebimento do material. */
export default async function CompraPage({ params }: PageProps<"/compras/pedidos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: compra }, { data: itensDb }, { data: recebDb }, { data: produtos }, { data: pedidos }, { data: cfg }, perfil] = await Promise.all([
    supabase.from("compras").select("*, fornecedor:fornecedor_id(nome, telefone, contato, cpf_cnpj, email), pedido:pedido_id(id, numero), cotacao:cotacao_id(id, numero)").eq("id", id).maybeSingle(),
    supabase.from("compra_itens").select("id, produto_id, descricao, quantidade, unidade, preco_unitario, recebido, pedido_id, pedido:pedido_id(numero, cliente:cliente_id(nome))").eq("compra_id", id).order("ordem"),
    supabase.from("recebimentos").select("id, recebido_em, nota_fiscal, conferido_por, observacoes, itens, lancamento_id").eq("compra_id", id).order("criado_em", { ascending: false }),
    supabase.from("produtos").select("id, nome, codigo, unidade_medida").eq("ativo", true).neq("tipo", "servico").order("nome"),
    supabase.from("pedidos").select("id, numero, cliente:cliente_id(nome)").in("status", ["aberto", "em_producao", "pronto"]).order("numero", { ascending: false }).limit(300),
    supabase.from("configuracoes").select("nome_fantasia, razao_social, cnpj, endereco, cidade, uf, telefone").single(),
    perfilAtual(),
  ]);
  if (!compra) notFound();
  const itens = (itensDb ?? []) as unknown as Item[];
  const recebimentos = (recebDb ?? []) as Receb[];
  const status = compra.status as StatusCompra;
  const editavel = ["rascunho", "enviado"].includes(status);
  const recebivel = ["enviado", "parcial"].includes(status);
  const f = compra.fornecedor as { nome: string; telefone: string | null; contato: string | null; cpf_cnpj: string | null; email: string | null } | null;
  const pedidoCliente = compra.pedido as { id: string; numero: number } | null;
  const cotacao = compra.cotacao as { id: string; numero: number } | null;
  const subtotal = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
  const total = totalDaCompra({ frete: compra.frete, desconto: compra.desconto, itens });
  const listaPedidos = ((pedidos ?? []) as unknown as { id: string; numero: number; cliente: { nome: string } | null }[]).map((p) => ({ id: p.id, rotulo: `${p.cliente?.nome ?? "Cliente"} · #${p.numero}` }));
  const nomeDoItem = (i: Item) => (i.pedido ? `${i.pedido.cliente?.nome ?? "Cliente"} · #${i.pedido.numero}` : null);
  const falta = itens.reduce((s, i) => s + Math.max(0, Number(i.quantidade) - Number(i.recebido)) * Number(i.preco_unitario), 0);
  const atrasado = recebivel && compra.previsao_entrega && compra.previsao_entrega < hojeISO();

  const texto = [
    `Olá${f?.contato ? `, ${f.contato.split(" ")[0]}` : ""}! Aqui é da ${cfg?.nome_fantasia ?? "marcenaria"}. Segue o pedido de compra nº ${compra.numero}:`,
    ...itens.map((i) => `• ${qtd(i.quantidade, i.unidade)} de ${i.descricao}${Number(i.preco_unitario) ? ` a ${brl(i.preco_unitario)}` : ""}`),
    `Total: ${brl(total)}`,
    compra.condicao_pagamento ? `Pagamento: ${compra.condicao_pagamento}` : "",
    compra.previsao_entrega ? `Entrega até ${data(compra.previsao_entrega)}.` : "",
    "Por favor, confirme o recebimento do pedido. Obrigado!",
  ].filter(Boolean).join("\n");
  const whats = linkWhats(f?.telefone, texto);

  const editar = (
    <JanelaBotao rotulo="Editar" titulo={`Pedido de compra #${compra.numero}`} variante="secundario" icone={null}>
      <form action={salvarCompra.bind(null, id)} className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Previsão de entrega"><input type="date" name="previsao_entrega" defaultValue={compra.previsao_entrega ?? ""} className={inputCls} /></Campo>
        <Campo rotulo="Condição de pagamento"><input name="condicao_pagamento" defaultValue={compra.condicao_pagamento ?? ""} className={inputCls} /></Campo>
        <Campo rotulo="Frete (R$)"><input name="frete" inputMode="decimal" defaultValue={dec(compra.frete)} className={inputCls} /></Campo>
        <Campo rotulo="Desconto (R$)"><input name="desconto" inputMode="decimal" defaultValue={dec(compra.desconto)} className={inputCls} /></Campo>
        <Campo rotulo="Para o pedido" className="md:col-span-2">
          <select name="pedido_id" defaultValue={pedidoCliente?.id ?? ""} className={inputCls}>
            <option value="">— Estoque geral —</option>
            {(pedidos as unknown as { id: string; numero: number; cliente: { nome: string } | null }[] | null)?.map((p) => <option key={p.id} value={p.id}>#{p.numero} · {p.cliente?.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observações" className="md:col-span-2"><textarea name="observacoes" rows={2} defaultValue={compra.observacoes ?? ""} className={inputCls} /></Campo>
        <div className="md:col-span-2"><Botao type="submit">Salvar</Botao></div>
      </form>
    </JanelaBotao>
  );

  const receber = (
    <JanelaBotao rotulo="Receber material" titulo="Receber material" descricao="Confira o que chegou. A quantidade informada entra no estoque com o preço desta compra." icone="certo" largura="xl" aviso="Material recebido">
      <form action={receberCompra.bind(null, id)} className="flex flex-col gap-4">
        <Tabela cabecalho={["Item", "Para", "Pedido", "Já recebido", "Chegou agora"]}>
          {itens.map((i) => {
            const resta = Math.max(0, Number(i.quantidade) - Number(i.recebido));
            return (
              <tr key={i.id}>
                <td className="px-4 py-3 font-medium">{i.descricao}</td>
                <td className="px-4 py-3">{nomeDoItem(i) ?? "Estoque"}</td>
                <td className="px-4 py-3">{qtd(i.quantidade, i.unidade)}</td>
                <td className="px-4 py-3">{qtd(i.recebido)}</td>
                <td className="px-4 py-2"><input name={`r:${i.id}`} defaultValue={resta ? String(resta).replace(".", ",") : ""} inputMode="decimal" className={`${inputCls} w-28`} /></td>
              </tr>
            );
          })}
        </Tabela>
        <div className="grid gap-3 md:grid-cols-4">
          <Campo rotulo="Data"><input type="date" name="recebido_em" defaultValue={hojeISO()} className={inputCls} /></Campo>
          <Campo rotulo="Nota fiscal"><input name="nota_fiscal" placeholder="Número da NF" className={inputCls} /></Campo>
          <Campo rotulo="Conferido por"><input name="conferido_por" className={inputCls} /></Campo>
          <Campo rotulo="Observações"><input name="observacoes" placeholder="Chapa com avaria, faltou 1..." className={inputCls} /></Campo>
        </div>
        {perfil?.papel === "admin" && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 p-4">
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="lancar" defaultChecked /> Lançar conta a pagar no Financeiro</label>
            <Campo rotulo="Vencimento"><input type="date" name="vencimento" defaultValue={hojeISO(28)} className={inputCls} /></Campo>
            <span className="pb-2 text-xs text-stone-500">Valor dos itens recebidos (o frete entra no último recebimento).</span>
          </div>
        )}
        <div><Botao type="submit">Confirmar recebimento</Botao></div>
        {itens.some((i) => i.pedido_id) && <p className="text-xs text-stone-500">Os itens marcados para um cliente entram livres no estoque. A marcação é só um lembrete para separar; se usar em outro pedido, não tem problema.</p>}
      </form>
    </JanelaBotao>
  );

  return (
    <>
      <div className="print:hidden">
        <Titulo
          sub={[f?.nome, `emitido em ${data(compra.emitido_em)}`, compra.previsao_entrega && `entrega até ${data(compra.previsao_entrega)}`, cotacao && `da cotação #${cotacao.numero}`].filter(Boolean).join(" · ")}
          acao={
            <div className="flex flex-wrap items-center gap-2">
              {editavel && editar}
              <Copiar texto={texto} rotulo="Copiar pedido" />
              {whats && status !== "cancelado" && <a href={whats} target="_blank" rel="noreferrer" className="rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white">Enviar no WhatsApp</a>}
              <BotaoImprimir />
              {status === "rascunho" && <form action={mudarStatusCompra.bind(null, id, "enviado")}><Botao type="submit">Marcar como enviado</Botao></form>}
              {recebivel && receber}
              {["rascunho", "enviado", "parcial"].includes(status) && <form action={mudarStatusCompra.bind(null, id, "cancelado")}><Botao type="submit" variante="secundario">Cancelar compra</Botao></form>}
            </div>
          }
        >
          Pedido de compra #{compra.numero}
          <Selo cor={COR_COMPRA[status]}>{STATUS_COMPRA[status]}</Selo>
          {atrasado && <Selo cor="red">atrasado</Selo>}
        </Titulo>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador rotulo="Total" valor={brl(total)} />
          <Indicador rotulo="Falta chegar" valor={brl(falta)} cor={falta && recebivel ? "vermelho" : undefined} />
          <Indicador rotulo="Pagamento" valor={<span className="font-sans text-base">{compra.condicao_pagamento ?? "—"}</span>} />
          <Indicador rotulo="Para" valor={<span className="font-sans text-base">{pedidoCliente ? <Link href={`/pedidos/${pedidoCliente.id}`} className="underline">Pedido #{pedidoCliente.numero}</Link> : "Estoque geral"}</span>} />
        </div>
      </div>

      {/* Cabeçalho que só aparece na impressão */}
      <div className="mb-6 hidden print:block">
        <h1 className="text-xl font-semibold">Pedido de compra nº {compra.numero}</h1>
        <p className="text-sm">{cfg?.razao_social || cfg?.nome_fantasia}{cfg?.cnpj ? ` · CNPJ ${cfg.cnpj}` : ""}{cfg?.endereco ? ` · ${cfg.endereco}` : ""}{cfg?.cidade ? `, ${cfg.cidade}/${cfg.uf ?? ""}` : ""}{cfg?.telefone ? ` · ${cfg.telefone}` : ""}</p>
        <p className="mt-2 text-sm"><b>Fornecedor:</b> {f?.nome}{f?.cpf_cnpj ? ` · CNPJ ${f.cpf_cnpj}` : ""}{f?.contato ? ` · ${f.contato}` : ""}</p>
        <p className="text-sm"><b>Emissão:</b> {data(compra.emitido_em)} · <b>Entrega:</b> {data(compra.previsao_entrega)} · <b>Pagamento:</b> {compra.condicao_pagamento ?? "—"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
            <h2 className="text-lg font-semibold">Itens</h2>
            {editavel && (
              <JanelaBotao rotulo="Incluir item" titulo="Incluir item" variante="secundario" largura="md">
                <form action={adicionarItemCompra.bind(null, id)} className="grid gap-3 md:grid-cols-6">
                  <Campo rotulo="Material do cadastro" className="md:col-span-6">
                    <select name="produto_id" className={inputCls}>
                      <option value="">— Item fora do cadastro —</option>
                      {produtos?.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ""}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Descrição" className="md:col-span-6"><input name="descricao" placeholder="Se não está no cadastro" className={inputCls} /></Campo>
                  <Campo rotulo="Qtd *" className="md:col-span-2"><input name="quantidade" required inputMode="decimal" className={inputCls} /></Campo>
                  <Campo rotulo="Unid." className="md:col-span-2"><input name="unidade" className={inputCls} /></Campo>
                  <Campo rotulo="Preço unit. (R$)" className="md:col-span-2"><input name="preco_unitario" inputMode="decimal" placeholder="custo do cadastro" className={inputCls} /></Campo>
                  <Campo rotulo="Para qual cliente (opcional)" className="md:col-span-6">
                    <select name="pedido_id" defaultValue={pedidoCliente?.id ?? ""} className={inputCls}>
                      <option value="">Estoque (sem cliente)</option>
                      {listaPedidos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
                    </select>
                  </Campo>
                  <div className="md:col-span-6"><Botao type="submit">Incluir</Botao></div>
                </form>
              </JanelaBotao>
            )}
          </div>
          <Tabela cabecalho={["Item", "Para qual cliente", "Quantidade", "Preço unit.", "Total", "Recebido", ""]} vazio={!itens.length}>
            {itens.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-medium">{i.produto_id ? <Link href={`/estoque/${i.produto_id}`} className="text-madeira-800 hover:underline">{i.descricao}</Link> : i.descricao}</td>
                <td className="px-4 py-2">
                  <span className="print:hidden">
                    {status !== "cancelado"
                      ? <ClienteDoItem acao={marcarClienteDoItem.bind(null, id, i.id)} valor={i.pedido_id ?? ""} pedidos={i.pedido_id && !listaPedidos.some((p) => p.id === i.pedido_id) ? [...listaPedidos, { id: i.pedido_id, rotulo: nomeDoItem(i)! }] : listaPedidos} />
                      : nomeDoItem(i) ?? "Estoque"}
                  </span>
                  <span className="hidden print:inline">{nomeDoItem(i) ?? "Estoque"}</span>
                </td>
                <td className="px-4 py-3">{qtd(i.quantidade, i.unidade)}</td>
                <td className="px-4 py-3">{brl(i.preco_unitario)}</td>
                <td className="px-4 py-3">{brl(Number(i.quantidade) * Number(i.preco_unitario))}</td>
                <td className="px-4 py-3">{Number(i.recebido) >= Number(i.quantidade) ? <Selo cor="green">completo</Selo> : Number(i.recebido) > 0 ? qtd(i.recebido) : "—"}</td>
                <td className="px-4 py-3 print:hidden">{editavel && !Number(i.recebido) && <BotaoExcluir acao={removerItemCompra.bind(null, id, i.id)} titulo="Tirar este item?" detalhe={<strong>{i.descricao}</strong>} aviso="Item retirado" />}</td>
              </tr>
            ))}
          </Tabela>
          {compra.observacoes && <p className="mt-3 text-sm text-stone-600"><b>Observações:</b> {compra.observacoes}</p>}
        </div>
        <Cartao className="h-fit">
          <LinhaValor rotulo="Itens" valor={brl(subtotal)} />
          <LinhaValor rotulo="Frete" valor={brl(compra.frete)} />
          {Number(compra.desconto) > 0 && <LinhaValor rotulo="Desconto" valor={brl(compra.desconto)} negativo />}
          <LinhaValor rotulo="Total" valor={brl(total)} forte />
        </Cartao>
      </div>

      {recebimentos.length > 0 && (
        <section className="mt-8 print:hidden">
          <h2 className="mb-3 text-lg font-semibold">Recebimentos</h2>
          <Tabela cabecalho={["Data", "Nota fiscal", "O que chegou", "Conferido por", "Observações", "Financeiro"]}>
            {recebimentos.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{data(r.recebido_em)}</td>
                <td className="px-4 py-3">{r.nota_fiscal ?? "—"}</td>
                <td className="px-4 py-3">{r.itens.map((x) => `${qtd(x.quantidade)} ${x.descricao}`).join(" · ")}</td>
                <td className="px-4 py-3">{r.conferido_por ?? "—"}</td>
                <td className="px-4 py-3">{r.observacoes ?? "—"}</td>
                <td className="px-4 py-3">{r.lancamento_id ? <Selo cor="green">conta lançada</Selo> : "—"}</td>
              </tr>
            ))}
          </Tabela>
        </section>
      )}
    </>
  );
}
