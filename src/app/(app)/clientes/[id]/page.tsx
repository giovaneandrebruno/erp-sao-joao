import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Cartao, Indicador, Selo, Tabela, Titulo } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { ROTULOS, ROTULOS2, brl, data, hojeISO, linkMapa, linkWhats } from "@/lib/format";
import { enderecoCompleto, idade, type Situacao } from "@/lib/cliente";
import { FormCliente } from "../form";
import { excluirCliente } from "../actions";
import { SeletorSituacao } from "../situacao";
import { BotaoExcluir } from "@/components/acoes";
import { SeloStatus } from "../../producao/componentes";
import { PastaDoCliente, type ProcessoDaPasta } from "./pasta";
import { LINHA_PRINCIPAL, etapaDoPedido, statusPagamento } from "@/lib/processo";
import { BUCKET_DOCUMENTOS } from "@/lib/documentos";

export default async function ClientePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: cliente }, { data: orcamentos }, { data: pedidos }, { data: ordens }, { data: negociacoes }, { data: lancamentos }, { data: parceiros }, { data: documentos }, { data: anotacoes }, { data: briefing }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase.from("orcamentos_resumo").select("id, numero, status, total, criado_em").eq("cliente_id", id).order("numero", { ascending: false }),
    supabase.from("pedidos_resumo").select("id, numero, status, total, data_entrega_prevista, criado_em").eq("cliente_id", id).order("numero", { ascending: false }),
    supabase.from("ordens_producao").select("id, os, cliente_nome, status_pcp, posicao, entrega_limite, pedido_id").eq("cliente_id", id).order("ordem"),
    supabase.from("negociacoes").select("id, titulo, etapa, valor_estimado, proxima_acao, proxima_acao_data").eq("cliente_id", id).order("criado_em", { ascending: false }),
    supabase.from("lancamentos").select("id, descricao, valor, vencimento, pago_em, pedido_id").eq("cliente_id", id).eq("tipo", "receber").order("vencimento"),
    supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
    supabase.from("cliente_documentos").select("id, tipo, descricao, nome_arquivo, caminho, tamanho, enviado_por_nome, atualizado_em").eq("cliente_id", id).order("criado_em", { ascending: false }),
    supabase.from("cliente_anotacoes").select("id, texto, criado_por_nome, alterado_por_nome, criado_em, atualizado_em").eq("cliente_id", id).order("criado_em", { ascending: false }),
    supabase.from("cliente_briefing").select("respostas, preenchido_por_nome, alterado_por_nome, criado_em, atualizado_em").eq("cliente_id", id).maybeSingle(),
  ]);
  if (!cliente) notFound();
  // processo do pedido para a pasta: etapa, forma de pagamento combinada e devoluções
  const [{ data: pedidosProcesso }, { data: devolucoes }, { data: pessoas }] = await Promise.all([
    supabase.from("pedidos").select("id, numero, pagamento_combinado").eq("cliente_id", id).neq("status", "cancelado").order("numero", { ascending: false }),
    supabase.from("cliente_pasta_devolucoes").select("id, motivo, responsavel_id, devolvida_por_nome, criado_em").eq("cliente_id", id).is("corrigida_em", null).order("criado_em"),
    supabase.from("perfis").select("user_id, nome, email").in("papel", ["admin", "vendedor"]).order("nome"),
  ]);
  // links para abrir os arquivos da pasta privada (valem 1 hora)
  const caminhos = (documentos ?? []).map((d) => d.caminho);
  const { data: links } = caminhos.length ? await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrls(caminhos, 3600) : { data: [] };
  const docsComLink = (documentos ?? []).map((d, i) => ({ ...d, url: links?.[i]?.signedUrl ?? null }));

  const situacao = (cliente.situacao ?? "lead") as Situacao;
  const pj = cliente.tipo_pessoa === "juridica";
  const nomeDe = (pid: string | null) => parceiros?.find((p) => p.id === pid)?.nome ?? null;
  const hoje = hojeISO();
  const pedidosValidos = (pedidos ?? []).filter((p) => p.status !== "cancelado");
  const totalComprado = pedidosValidos.reduce((t, p) => t + Number(p.total ?? 0), 0);
  const recebido = (lancamentos ?? []).filter((l) => l.pago_em).reduce((t, l) => t + Number(l.valor), 0);
  const aReceber = (lancamentos ?? []).filter((l) => !l.pago_em).reduce((t, l) => t + Number(l.valor), 0);
  const vencido = (lancamentos ?? []).filter((l) => !l.pago_em && l.vencimento < hoje).reduce((t, l) => t + Number(l.valor), 0);
  const primeiraCompra = pedidosValidos.map((p) => p.criado_em).filter(Boolean).sort()[0] ?? null;
  const endereco = enderecoCompleto(cliente);
  const mapa = endereco ? linkMapa(endereco) : null;
  const whats = linkWhats(cliente.telefone);
  const anos = idade(cliente.data_nascimento);
  // etapa de cada pedido a partir das suas OS (SCRUM); a pasta acompanha o pedido mais adiantado
  const ordensAtivas = (ordens ?? []) as { status_pcp: string; pedido_id?: string | null }[];
  const etapasAtivas = (pedidosProcesso ?? []).map((x) => etapaDoPedido(ordensAtivas.filter((o) => o.pedido_id === x.id).map((o) => o.status_pcp)));
  const processo: ProcessoDaPasta = {
    // a pasta acompanha o pedido mais adiantado
    etapa: etapasAtivas.sort((a, b) => LINHA_PRINCIPAL.indexOf(b) - LINHA_PRINCIPAL.indexOf(a))[0] ?? null,
    pagamento: pedidosValidos.length ? statusPagamento(totalComprado, lancamentos ?? [], hoje).status : null,
    pagamentoCombinado: (pedidosProcesso ?? []).map((x) => ({ pedidoId: x.id, numero: x.numero, texto: x.pagamento_combinado })),
    devolucoes: (devolucoes ?? []).map((d) => ({ ...d, responsavel: pessoas?.find((x) => x.user_id === d.responsavel_id)?.nome ?? null })),
    pessoas: pessoas ?? [],
    atendimento: { situacao: cliente.atendimento_situacao ?? null, responsavelId: cliente.atendimento_responsavel_id ?? null, prazo: cliente.atendimento_prazo ?? null, desde: cliente.atendimento_desde ?? null },
  };

  const grupos: { titulo: string; itens: [string, React.ReactNode, boolean?][] }[] = [
    {
      titulo: pj ? "Dados da empresa" : "Dados pessoais",
      itens: pj
        ? [["CNPJ", cliente.cpf_cnpj], ["Nome fantasia", cliente.nome_fantasia], ["Inscrição estadual", cliente.inscricao_estadual], ["Pessoa de contato", cliente.contato_nome]]
        : [
            ["CPF", cliente.cpf_cnpj], ["RG", cliente.rg],
            ["Nascimento", cliente.data_nascimento ? `${data(cliente.data_nascimento)}${anos !== null ? ` (${anos} anos)` : ""}` : null],
            ["Estado civil", cliente.estado_civil], ["Profissão", cliente.profissao], ["Cônjuge / outro contato", cliente.contato_nome],
          ],
    },
    {
      titulo: "Contato",
      itens: [
        ["Celular / WhatsApp", cliente.telefone ? (
          <span className="flex flex-wrap items-center gap-2">{cliente.telefone}{whats && <a href={whats} target="_blank" rel="noreferrer" className="text-xs font-medium text-madeira-700 hover:underline">Abrir WhatsApp</a>}</span>
        ) : null],
        ["Outro telefone", cliente.telefone2],
        ["E-mail", cliente.email ? <a href={`mailto:${cliente.email}`} className="text-madeira-800 hover:underline">{cliente.email}</a> : null],
      ],
    },
    {
      titulo: "Endereço",
      itens: [
        ["Endereço", endereco ? (
          <span>{endereco}{mapa && <> · <a href={mapa} target="_blank" rel="noreferrer" className="text-xs font-medium text-madeira-700 hover:underline">Ver no mapa</a></>}</span>
        ) : null, true],
        ["Endereço da obra / entrega", cliente.endereco_obra, true],
      ],
    },
    {
      titulo: "Atendimento",
      itens: [
        ["Origem", cliente.origem], ["Indicado por", cliente.indicado_por],
        ["Vendedor", nomeDe(cliente.vendedor_id)], ["Arquiteto / designer", nomeDe(cliente.arquiteto_id)],
        ["Cliente desde", primeiraCompra ? data(primeiraCompra) : null], ["Cadastrado em", data(cliente.criado_em)],
        ["Observações", cliente.observacoes, true],
      ],
    },
  ];

  return (
    <>
      <Titulo
        acao={
          <div className="flex flex-wrap gap-2">
            <JanelaBotao rotulo="Editar cadastro" titulo="Editar cliente" descricao={cliente.nome} variante="secundario" icone={null} largura="xl">
              <FormCliente cliente={cliente} parceiros={parceiros ?? []} />
            </JanelaBotao>
            <BotaoExcluir acao={excluirCliente.bind(null, id)} rotulo="Excluir" titulo="Excluir este cliente?" detalhe={<strong>{cliente.nome}</strong>} aviso="Cliente excluído" depois="/clientes" />
            <BotaoLink href={`/producao/nova?cliente=${id}`} variante="secundario">Nova OS</BotaoLink>
            <BotaoLink href={`/crm/nova?cliente=${id}`} variante="secundario">Nova negociação</BotaoLink>
            <BotaoLink href={`/orcamentos/novo?cliente=${id}`}>Novo orçamento</BotaoLink>
          </div>
        }
      >
        {cliente.nome}
      </Titulo>

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3 text-sm">
        {pj && <Selo>Empresa</Selo>}
        <span className="text-xs text-stone-500">Situação:</span>
        <SeletorSituacao id={id} situacao={situacao} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Total comprado" valor={brl(totalComprado)} sub={`${pedidosValidos.length} ${pedidosValidos.length === 1 ? "pedido" : "pedidos"}`} />
        <Indicador rotulo="Já recebido" valor={brl(recebido)} cor="verde" />
        <Indicador rotulo="A receber" valor={brl(aReceber)} sub={vencido > 0 ? `${brl(vencido)} vencido` : undefined} />
        <Indicador rotulo="Orçamentos" valor={orcamentos?.length ?? 0} sub={`${negociacoes?.length ?? 0} no funil de vendas`} />
      </div>

      <Cartao className="mb-8">
        <div className="grid gap-6">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <h3 className="mb-3 text-sm font-semibold text-stone-800">{g.titulo}</h3>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {g.itens.map(([rotulo, valor, largo]) => (
                  <div key={rotulo} className={largo ? "sm:col-span-2" : ""}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{rotulo}</dt>
                    <dd className="mt-1 whitespace-pre-line text-stone-800">{valor || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Cartao>

      <PastaDoCliente clienteId={id} nome={cliente.nome} fechado={situacao !== "lead" || pedidosValidos.length > 0} documentos={docsComLink} anotacoes={anotacoes ?? []} briefing={briefing} processo={processo} />

      {!!negociacoes?.length && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Funil de vendas</h2>
          <div className="mb-8">
            <Tabela cabecalho={["Negociação", "Etapa", "Valor estimado", "Próxima ação"]}>
              {negociacoes.map((n) => (
                <tr key={n.id}>
                  <td className="px-4 py-3"><Link href={`/crm/${n.id}`} className="text-madeira-800 hover:underline">{n.titulo}</Link></td>
                  <td className="px-4 py-3"><Selo cor={n.etapa === "ganho" ? "green" : n.etapa === "perdido" ? "red" : "blue"}>{ROTULOS2.etapaNegociacao[n.etapa as keyof typeof ROTULOS2.etapaNegociacao]}</Selo></td>
                  <td className="px-4 py-3">{n.valor_estimado ? brl(n.valor_estimado) : "—"}</td>
                  <td className="px-4 py-3">{n.proxima_acao ?? "—"}{n.proxima_acao_data ? ` · ${data(n.proxima_acao_data)}` : ""}</td>
                </tr>
              ))}
            </Tabela>
          </div>
        </>
      )}

      {!!ordens?.length && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Produção (ordens de serviço)</h2>
          <div className="mb-8">
            <Tabela cabecalho={["OS", "Descrição", "Status", "Posição", "Entrega limite"]}>
              {ordens.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-xs">{o.os ?? "—"}</td>
                  <td className="px-4 py-3"><Link href={`/producao/${o.id}`} className="text-madeira-800 hover:underline">{o.cliente_nome}</Link></td>
                  <td className="px-4 py-3"><SeloStatus sigla={o.status_pcp} nome /></td>
                  <td className="px-4 py-3">{o.posicao ?? "—"}</td>
                  <td className="px-4 py-3">{data(o.entrega_limite)}</td>
                </tr>
              ))}
            </Tabela>
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-semibold">Orçamentos</h2>
      <div className="mb-8">
        <Tabela cabecalho={["Nº", "Data", "Status", "Total"]} vazio={!orcamentos?.length}>
          {orcamentos?.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3"><Link href={`/orcamentos/${o.id}`} className="text-madeira-800 hover:underline">#{o.numero}</Link></td>
              <td className="px-4 py-3">{data(o.criado_em)}</td>
              <td className="px-4 py-3"><Selo>{ROTULOS.statusOrcamento[o.status as keyof typeof ROTULOS.statusOrcamento]}</Selo></td>
              <td className="px-4 py-3">{brl(o.total)}</td>
            </tr>
          ))}
        </Tabela>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Pedidos</h2>
      <Tabela cabecalho={["Nº", "Entrega prevista", "Status", "Total"]} vazio={!pedidos?.length}>
        {pedidos?.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3"><Link href={`/pedidos/${p.id}`} className="text-madeira-800 hover:underline">#{p.numero}</Link></td>
            <td className="px-4 py-3">{data(p.data_entrega_prevista)}</td>
            <td className="px-4 py-3"><Selo>{ROTULOS.statusPedido[p.status as keyof typeof ROTULOS.statusPedido]}</Selo></td>
            <td className="px-4 py-3">{brl(p.total)}</td>
          </tr>
        ))}
      </Tabela>

      {!!lancamentos?.length && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">Financeiro (parcelas a receber)</h2>
          <Tabela cabecalho={["Vencimento", "Descrição", "Valor", "Situação"]}>
            {lancamentos.map((l) => {
              const atrasado = !l.pago_em && l.vencimento < hoje;
              return (
                <tr key={l.id}>
                  <td className={`px-4 py-3 ${atrasado ? "font-semibold text-red-600" : ""}`}>{data(l.vencimento)}</td>
                  <td className="px-4 py-3">{l.pedido_id ? <Link href={`/pedidos/${l.pedido_id}`} className="text-madeira-800 hover:underline">{l.descricao}</Link> : l.descricao}</td>
                  <td className="px-4 py-3">{brl(l.valor)}</td>
                  <td className="px-4 py-3">{l.pago_em ? <Selo cor="green">Recebido {data(l.pago_em)}</Selo> : <Selo cor={atrasado ? "red" : "stone"}>{atrasado ? "Vencido" : "Em aberto"}</Selo>}</td>
                </tr>
              );
            })}
          </Tabela>
        </>
      )}
    </>
  );
}
