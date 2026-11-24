import { Cartao, Selo, inputCls, estiloBotao } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoExcluir } from "@/components/acoes";
import { Icone } from "@/components/icones";
import { dataHora } from "@/lib/format";
import { TIPOS_DOCUMENTO, tamanhoLegivel, type TipoDocumento } from "@/lib/documentos";
import { ASSINATURAS, COR_PAGAMENTO, ROTULO_PAGAMENTO, nomeEtapa, situacaoAssinatura, type Etapa, type StatusPagamento } from "@/lib/processo";
import { FormDocumento } from "./pasta-form";
import { Briefing, type BriefingDoCliente } from "./briefing";
import { adicionarAnotacao, devolverPasta, editarAnotacao, excluirAnotacao, excluirDocumento, marcarPastaCorrigida } from "./pasta-actions";

export type DocumentoDaPasta = {
  id: string; tipo: string; descricao: string | null; nome_arquivo: string; tamanho: number | null;
  enviado_por_nome: string | null; atualizado_em: string; url: string | null;
};
export type AnotacaoDaPasta = {
  id: string; texto: string; criado_por_nome: string | null; alterado_por_nome: string | null; criado_em: string; atualizado_em: string;
};

export type ProcessoDaPasta = {
  etapa: Etapa | null;
  pagamento: StatusPagamento | null;
  pagamentoCombinado: { pedidoId: string; numero: number; texto: string | null }[];
  devolucoes: { id: string; motivo: string; responsavel: string | null; devolvida_por_nome: string | null; criado_em: string }[];
  pessoas: { user_id: string; nome: string | null; email: string | null }[];
};

const rotuloTipo = (t: string) => TIPOS_DOCUMENTO[t as TipoDocumento] ?? "Outro";

/**
 * Cliente novo (lead): briefing do primeiro atendimento + anotações.
 * Cliente fechado: pasta com os arquivos (pedido fechado, memorial, eletrodomésticos, referências...) + anotações;
 * o briefing feito lá no começo continua visível embaixo.
 */
export function PastaDoCliente({ clienteId, nome, fechado, documentos, anotacoes, briefing, processo }: {
  clienteId: string; nome: string; fechado: boolean; documentos: DocumentoDaPasta[]; anotacoes: AnotacaoDaPasta[]; briefing: BriefingDoCliente;
  processo: ProcessoDaPasta;
}) {
  if (!fechado) {
    return (
      <>
        <h2 className="mb-3 text-lg font-semibold">Briefing do cliente novo</h2>
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><Briefing clienteId={clienteId} nome={nome} briefing={briefing} colunas={2} /></div>
          <Anotacoes clienteId={clienteId} anotacoes={anotacoes} />
        </div>
      </>
    );
  }

  const tem = new Set(documentos.map((d) => d.tipo));
  const grupos = (Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[])
    .map((t) => ({ tipo: t, docs: documentos.filter((d) => (Object.hasOwn(TIPOS_DOCUMENTO, d.tipo) ? d.tipo : "outro") === t) }))
    .filter((g) => g.docs.length);
  return (
    <>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Icone nome="pasta" className="h-5 w-5 text-madeira-700" /> Pasta do cliente</h2>
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {ASSINATURAS.map((a) => {
                const s = situacaoAssinatura(a, tem, processo.etapa);
                return <Selo key={a.tipo} cor={s === "tem" ? "green" : s === "falta" ? "amber" : "stone"}>{a.nome}{s === "falta" ? ": falta" : s === "depois" ? ": mais tarde" : ""}</Selo>;
              })}
              {processo.pagamento && <Selo cor={COR_PAGAMENTO[processo.pagamento]}>{ROTULO_PAGAMENTO[processo.pagamento]}</Selo>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <JanelaBotao rotulo="Devolver para correção" titulo="Devolver a pasta para correção" descricao={`${nome} · o pedido não avança de etapa até a pasta ser corrigida`} variante="secundario" icone={null} largura="md" aviso="Pasta devolvida">
                <form action={devolverPasta.bind(null, clienteId)} className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-medium text-stone-600">O que precisa corrigir *</span>
                    <textarea name="motivo" required rows={4} placeholder="Endereço da obra incompleto, contrato sem assinatura, memorial faltando o ambiente da suíte..." className={inputCls} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-medium text-stone-600">Quem vai corrigir</span>
                    <select name="responsavel_id" defaultValue="" className={inputCls}>
                      <option value="">—</option>
                      {processo.pessoas.map((p) => <option key={p.user_id} value={p.user_id}>{p.nome || p.email}</option>)}
                    </select>
                  </label>
                  <button className={`${estiloBotao.primario} justify-self-end`}>Devolver</button>
                </form>
              </JanelaBotao>
              <JanelaBotao rotulo="Adicionar arquivo" titulo="Adicionar arquivo à pasta" descricao={nome} largura="md" aviso={null}>
                <FormDocumento clienteId={clienteId} tipoInicial={proximoTipo(tem)} />
              </JanelaBotao>
            </div>
          </div>
          {processo.etapa && <p className="-mt-2 mb-4 text-xs text-stone-500">Pedido na etapa <strong>{nomeEtapa(processo.etapa)}</strong>: o que já devia estar na pasta aparece como &quot;falta&quot;.</p>}

          {processo.devolucoes.map((d) => (
            <div key={d.id} className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-rosa/10 p-3 text-sm ring-1 ring-inset ring-rosa/30">
              <div className="min-w-0">
                <p className="font-medium text-rosa">Pasta devolvida para correção</p>
                <p className="whitespace-pre-line text-stone-800">{d.motivo}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {d.devolvida_por_nome ?? "Equipe"} · {dataHora(d.criado_em)}{d.responsavel ? ` · para ${d.responsavel} corrigir` : ""}
                </p>
              </div>
              <form action={marcarPastaCorrigida.bind(null, d.id, clienteId)}><button className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Marcar como corrigida</button></form>
            </div>
          ))}

          {processo.pagamentoCombinado.length > 0 && (
            <div className="mb-4 rounded-xl bg-stone-50 p-3 text-sm ring-1 ring-inset ring-stone-200">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Forma de pagamento combinada no fechamento</p>
              {processo.pagamentoCombinado.map((x) => (
                <p key={x.pedidoId} className="mt-1 whitespace-pre-line text-stone-800">
                  {processo.pagamentoCombinado.length > 1 && <strong>Pedido #{x.numero}: </strong>}
                  {x.texto || <span className="text-amber-700">ainda não registrada (registre no pedido, em Recebimentos)</span>}
                </p>
              ))}
            </div>
          )}

          {grupos.length ? (
            <div className="grid gap-5">
              {grupos.map((g) => (
                <section key={g.tipo}>
                  <h4 className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                    <Icone nome="pasta" className="h-3.5 w-3.5 text-madeira-600" /> {rotuloTipo(g.tipo)} <span className="text-stone-400">({g.docs.length})</span>
                  </h4>
                  <ul className="divide-y divide-stone-100">
                    {g.docs.map((d) => <LinhaDocumento key={d.id} d={d} clienteId={clienteId} />)}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
              A pasta está vazia. Coloque aqui o pedido fechado assinado, o memorial descritivo, os eletrodomésticos, as referências que o cliente mandou e tudo o que for importante.
            </p>
          )}
        </Cartao>
        <Anotacoes clienteId={clienteId} anotacoes={anotacoes} />
      </div>
      {briefing && <div className="mb-8"><Briefing clienteId={clienteId} nome={nome} briefing={briefing} colunas={3} titulo="Briefing do primeiro atendimento" /></div>}
    </>
  );
}

/** Tipo sugerido ao adicionar arquivo: o primeiro documento obrigatório que ainda falta. */
function proximoTipo(tem: Set<string>): TipoDocumento {
  return ASSINATURAS.find((a) => !tem.has(a.tipo) && !(a.ou && tem.has(a.ou)))?.tipo ?? "outro";
}

function LinhaDocumento({ d, clienteId }: { d: DocumentoDaPasta; clienteId: string }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-madeira-50 text-madeira-700 ring-1 ring-inset ring-madeira-200">
        <Icone nome="documento" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        {d.url ? (
          <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-madeira-800 hover:underline">{d.nome_arquivo}</a>
        ) : (
          <span className="block truncate text-sm font-medium">{d.nome_arquivo}</span>
        )}
        <div className="mt-0.5 text-xs text-stone-500">
          {d.descricao && <>{d.descricao} · </>}
          {tamanhoLegivel(d.tamanho) && <>{tamanhoLegivel(d.tamanho)} · </>}
          {dataHora(d.atualizado_em)}{d.enviado_por_nome ? `, por ${d.enviado_por_nome}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {d.url && <a href={d.url} target="_blank" rel="noreferrer" className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Abrir</a>}
        <JanelaBotao rotulo="Alterar" titulo="Alterar arquivo" descricao={d.nome_arquivo} variante="secundario" icone={null} largura="md" aviso={null} className="!px-3 !py-1.5">
          <FormDocumento clienteId={clienteId} documento={d} />
        </JanelaBotao>
        <BotaoExcluir acao={excluirDocumento.bind(null, d.id)} titulo="Excluir este arquivo?" detalhe={<strong>{d.nome_arquivo}</strong>} aviso="Arquivo excluído" />
      </div>
    </li>
  );
}

function Anotacoes({ clienteId, anotacoes }: { clienteId: string; anotacoes: AnotacaoDaPasta[] }) {
  return (
    <Cartao>
      <h3 className="mb-3 text-sm font-semibold text-stone-800">Anotações</h3>
      <form action={adicionarAnotacao.bind(null, clienteId)} className="mb-4 grid gap-2">
        <textarea name="texto" required rows={3} placeholder="Escreva uma anotação para a equipe…" className={inputCls} />
        <button className={`${estiloBotao.primario} justify-self-end`}>Adicionar anotação</button>
      </form>
      {anotacoes.length ? (
        <ul className="grid gap-3">
          {anotacoes.map((a) => (
            <li key={a.id} className="rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
              <p className="whitespace-pre-line text-sm text-stone-800">{a.texto}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-stone-500">
                  {a.criado_por_nome ?? "Equipe"} · {dataHora(a.criado_em)}
                  {a.alterado_por_nome && a.atualizado_em !== a.criado_em ? ` · alterada por ${a.alterado_por_nome}` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <JanelaBotao rotulo="Alterar" titulo="Alterar anotação" variante="link" icone={null} largura="sm" aviso="Anotação alterada" className="!text-xs">
                    <form action={editarAnotacao.bind(null, a.id, clienteId)} className="grid gap-3">
                      <textarea name="texto" required rows={6} defaultValue={a.texto} className={inputCls} />
                      <button className={`${estiloBotao.primario} justify-self-end`}>Salvar</button>
                    </form>
                  </JanelaBotao>
                  <BotaoExcluir acao={excluirAnotacao.bind(null, a.id, clienteId)} titulo="Excluir esta anotação?" aviso="Anotação excluída" />
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-stone-400">Nenhuma anotação ainda.</p>
      )}
    </Cartao>
  );
}
