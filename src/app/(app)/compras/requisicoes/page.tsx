import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { data } from "@/lib/format";
import { COR_REQUISICAO, STATUS_REQUISICAO, qtd, type StatusRequisicao } from "@/lib/estoque";
import { cancelarRequisicao, compraDasRequisicoes, cotacaoDasRequisicoes, salvarRequisicao } from "../actions";

type Req = {
  id: string; numero: number; descricao: string; quantidade: number; unidade: string; necessario_em: string | null; urgente: boolean;
  status: StatusRequisicao; solicitante: string | null; observacoes: string | null; criado_em: string; produto_id: string | null;
  pedido: { id: string; numero: number } | null; cotacao_id: string | null; compra_id: string | null;
};

/** Requisições: a equipe (produção, projeto, montagem) pede o material; o comprador junta numa cotação ou num pedido de compra. */
export default async function RequisicoesPage({ searchParams }: PageProps<"/compras/requisicoes">) {
  const sp = await searchParams;
  const ver = sp.ver === "todas" ? "todas" : "abertas";
  const supabase = await createClient();
  let consulta = supabase
    .from("requisicoes_compra")
    .select("id, numero, descricao, quantidade, unidade, necessario_em, urgente, status, solicitante, observacoes, criado_em, produto_id, cotacao_id, compra_id, pedido:pedido_id(id, numero)")
    .order("urgente", { ascending: false })
    .order("necessario_em", { ascending: true, nullsFirst: false })
    .limit(300);
  if (ver === "abertas") consulta = consulta.in("status", ["aberta", "em_cotacao"]);
  const [{ data: reqs }, { data: produtos }, { data: pedidos }, { data: fornecedores }] = await Promise.all([
    consulta,
    supabase.from("produtos").select("id, nome, codigo, unidade_medida").eq("ativo", true).neq("tipo", "servico").order("nome"),
    supabase.from("pedidos").select("id, numero, cliente:cliente_id(nome)").in("status", ["aberto", "em_producao", "pronto"]).order("numero", { ascending: false }).limit(300),
    supabase.from("fornecedores").select("id, nome").order("nome"),
  ]);
  const lista = (reqs ?? []) as unknown as Req[];
  const abertas = lista.filter((r) => r.status === "aberta");

  const nova = (
    <JanelaBotao rotulo="Nova requisição" titulo="Nova requisição de compra" descricao="Peça o material que precisa. O comprador junta as requisições numa cotação ou num pedido de compra." abrirAoCarregar={sp.novo === "1"} aviso="Requisição enviada" largura="xl">
      <form action={salvarRequisicao} className="grid gap-4 md:grid-cols-6">
        <Campo rotulo="Material do cadastro" className="md:col-span-4">
          <select name="produto_id" className={inputCls}>
            <option value="">— Item fora do cadastro (descreva ao lado) —</option>
            {produtos?.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ""} · {p.unidade_medida}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Quantidade *" className="md:col-span-1"><input name="quantidade" required inputMode="decimal" className={inputCls} /></Campo>
        <Campo rotulo="Unidade" className="md:col-span-1"><input name="unidade" placeholder="un, m, chapa" className={inputCls} /></Campo>
        <Campo rotulo="Descrição (se não está no cadastro)" className="md:col-span-6"><input name="descricao" placeholder="Corrediça telescópica 450mm, cola PVA 5kg..." className={inputCls} /></Campo>
        <Campo rotulo="Para o pedido" className="md:col-span-3">
          <select name="pedido_id" className={inputCls}>
            <option value="">— Estoque geral —</option>
            {(pedidos as unknown as { id: string; numero: number; cliente: { nome: string } | null }[] | null)?.map((p) => <option key={p.id} value={p.id}>#{p.numero} · {p.cliente?.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Precisa até" className="md:col-span-2"><input type="date" name="necessario_em" className={inputCls} /></Campo>
        <label className="flex items-end gap-2 pb-2 text-sm md:col-span-1"><input type="checkbox" name="urgente" /> Urgente</label>
        <Campo rotulo="Quem pediu" className="md:col-span-2"><input name="solicitante" placeholder="Nome" className={inputCls} /></Campo>
        <Campo rotulo="Observações" className="md:col-span-4"><input name="observacoes" className={inputCls} /></Campo>
        <div className="md:col-span-6"><Botao type="submit">Enviar requisição</Botao></div>
      </form>
    </JanelaBotao>
  );

  return (
    <>
      <Titulo sub="Pedidos de material feitos pela produção, projeto ou montagem. Marque as abertas e junte numa cotação ou direto num pedido de compra." acao={nova}>
        Requisições de compra
      </Titulo>
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/compras/requisicoes" className={ver === "abertas" ? "font-semibold text-madeira-800" : "text-stone-500"}>Abertas e em cotação</Link>
        <Link href="/compras/requisicoes?ver=todas" className={ver === "todas" ? "font-semibold text-madeira-800" : "text-stone-500"}>Todas</Link>
      </div>
      <form action={cotacaoDasRequisicoes}>
        <Tabela cabecalho={["", "Nº", "Material", "Quantidade", "Para", "Precisa até", "Quem pediu", "Situação", ""]} vazio={!lista.length}>
          {lista.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">{r.status === "aberta" && <input type="checkbox" name={`r:${r.id}`} aria-label={`Marcar requisição ${r.numero}`} />}</td>
              <td className="px-4 py-3">#{r.numero}</td>
              <td className="px-4 py-3">
                {r.produto_id ? <Link href={`/estoque/${r.produto_id}`} className="font-medium text-madeira-800 hover:underline">{r.descricao}</Link> : <span className="font-medium">{r.descricao}</span>}
                {r.urgente && <span className="ml-2"><Selo cor="red">urgente</Selo></span>}
                {r.observacoes && <div className="text-xs text-stone-500">{r.observacoes}</div>}
              </td>
              <td className="px-4 py-3">{qtd(r.quantidade, r.unidade)}</td>
              <td className="px-4 py-3">{r.pedido ? <Link href={`/pedidos/${r.pedido.id}`} className="text-madeira-800 hover:underline">Pedido #{r.pedido.numero}</Link> : "Estoque"}</td>
              <td className="px-4 py-3">{data(r.necessario_em)}</td>
              <td className="px-4 py-3">{r.solicitante ?? "—"}</td>
              <td className="px-4 py-3">
                {r.status === "em_cotacao" && r.cotacao_id ? <Link href={`/compras/cotacoes/${r.cotacao_id}`}><Selo cor={COR_REQUISICAO[r.status]}>{STATUS_REQUISICAO[r.status]}</Selo></Link>
                  : r.status === "comprada" && r.compra_id ? <Link href={`/compras/pedidos/${r.compra_id}`}><Selo cor={COR_REQUISICAO[r.status]}>{STATUS_REQUISICAO[r.status]}</Selo></Link>
                  : <Selo cor={COR_REQUISICAO[r.status]}>{STATUS_REQUISICAO[r.status]}</Selo>}
              </td>
              <td className="px-4 py-3">
                {["aberta", "em_cotacao"].includes(r.status) && <button formAction={cancelarRequisicao.bind(null, r.id)} className="text-xs text-stone-500 hover:text-rosa hover:underline">Cancelar</button>}
              </td>
            </tr>
          ))}
        </Tabela>
        {abertas.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end justify-end gap-3">
            <Botao type="submit" variante="secundario">Pedir cotação das marcadas</Botao>
            <span className="text-sm text-stone-400">ou</span>
            <select name="fornecedor_id" className={inputCls} aria-label="Fornecedor">
              <option value="">Escolha o fornecedor</option>
              {fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <Botao type="submit" formAction={compraDasRequisicoes}>Comprar direto</Botao>
          </div>
        )}
      </form>
    </>
  );
}
