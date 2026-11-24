import Link from "next/link";
import { Botao, Campo, Selo, inputCls } from "@/components/ui";
import { AcoesLinha, BotaoCancelar, BotaoExcluir, LinkEditar } from "@/components/acoes";
import { data, hojeISO } from "@/lib/format";
import { diasUteisEntre } from "@/lib/dias-uteis";
import { SITUACOES_ACAO, TIPOS_REUNIAO, ordinal, type Acao, type Reuniao } from "@/lib/reunioes";
import { alterarAcao, criarAcao, criarReuniao, alterarReuniao, excluirAcao, mudarSituacaoAcao } from "./actions";

/** Lista de nomes para sugerir no campo "Responsável". */
export function ListaDePessoas({ id, nomes }: { id: string; nomes: string[] }) {
  return <datalist id={id}>{[...new Set(nomes)].sort((a, b) => a.localeCompare(b, "pt-BR")).map((n) => <option key={n} value={n} />)}</datalist>;
}

export function FormReuniao({ r }: { r?: Reuniao }) {
  return (
    <form action={r ? alterarReuniao.bind(null, r.id) : criarReuniao} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Data *" className="md:col-span-2"><input name="data" type="date" required defaultValue={r?.data ?? hojeISO()} className={inputCls} /></Campo>
      <Campo rotulo="Tipo" className="md:col-span-2">
        <select name="tipo" defaultValue={r?.tipo ?? "reuniao"} className={inputCls}>
          {Object.entries(TIPOS_REUNIAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Início" className="md:col-span-1"><input name="inicio" type="time" defaultValue={r?.inicio?.slice(0, 5) ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Término" className="md:col-span-1"><input name="termino" type="time" defaultValue={r?.termino?.slice(0, 5) ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Assunto" className="md:col-span-4"><input name="assunto" defaultValue={r?.assunto ?? ""} placeholder="Ex.: Pendências e gargalos" className={inputCls} /></Campo>
      <Campo rotulo="Local" className="md:col-span-2"><input name="local" defaultValue={r?.local ?? ""} placeholder="Marcenaria" className={inputCls} /></Campo>
      <Campo rotulo="Participantes" className="md:col-span-6"><input name="participantes" defaultValue={r?.participantes ?? ""} placeholder="Ex.: Douglas, Andreina, Giovane" className={inputCls} /></Campo>
      <Campo rotulo="Anotações da reunião" className="md:col-span-6"><textarea name="anotacoes" rows={4} defaultValue={r?.anotacoes ?? ""} placeholder="O que foi conversado e decidido" className={inputCls} /></Campo>
      {!r && <p className="text-xs text-stone-500 md:col-span-6">As ações que ficaram sem resolver nas reuniões anteriores aparecem sozinhas nesta reunião, como pendentes.</p>}
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{r ? "Salvar alterações" : "Criar reunião"}</Botao>
        {r && <BotaoCancelar />}
      </div>
    </form>
  );
}

export function FormAcao({ reuniaoId, a, listaPessoas }: { reuniaoId: string; a?: Acao; listaPessoas: string }) {
  return (
    <form action={a ? alterarAcao.bind(null, a.id, reuniaoId) : criarAcao.bind(null, reuniaoId)} className="grid gap-3 md:grid-cols-12">
      <Campo rotulo="Ação *" className={a ? "md:col-span-12" : "md:col-span-6"}>
        {a ? <textarea name="descricao" required rows={3} defaultValue={a.descricao} className={inputCls} />
          : <input name="descricao" required placeholder="Ex.: Definir custos do orçamento e markup" className={inputCls} />}
      </Campo>
      <Campo rotulo="Responsável" className={a ? "md:col-span-5" : "md:col-span-3"}>
        <input name="responsavel" list={listaPessoas} defaultValue={a?.responsavel ?? ""} placeholder="Ex.: Douglas, Andreina" className={inputCls} />
      </Campo>
      <Campo rotulo="Prazo" className={a ? "md:col-span-3" : "md:col-span-2"}>
        <input name="prazo" type="date" defaultValue={a?.prazo ?? ""} className={inputCls} />
      </Campo>
      {a && (
        <Campo rotulo="Situação" className="md:col-span-4">
          <select name="situacao" defaultValue={a.situacao} className={inputCls}>
            {Object.entries(SITUACOES_ACAO).map(([k, [r]]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
      )}
      {a && <Campo rotulo="Observação" className="md:col-span-12"><input name="observacao" defaultValue={a.observacao ?? ""} placeholder="Ex.: Já enviado para a Andreina" className={inputCls} /></Campo>}
      <div className={`flex items-end gap-2 ${a ? "md:col-span-12" : "md:col-span-1"}`}>
        <Botao type="submit">{a ? "Salvar alterações" : "+"}</Botao>
        {a && <BotaoCancelar />}
      </div>
    </form>
  );
}

export function SeloSituacao({ a, hoje }: { a: Acao; hoje: string }) {
  const [rotulo, cor] = SITUACOES_ACAO[a.situacao];
  const atrasada = a.situacao !== "ok" && a.prazo && a.prazo < hoje;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Selo cor={cor}>{rotulo}</Selo>
      {atrasada && <Selo cor="red">atrasada {diasUteisEntre(a.prazo!, hoje) || 1} dia(s) útil(eis)</Selo>}
    </div>
  );
}

/** Tabela de ações com os botões OK / Reabrir, alterar e excluir. */
export function TabelaDeAcoes({
  acoes, hoje, reunioes, mostrarOrigem = false, vazio = "Nenhuma ação.",
}: {
  acoes: Acao[]; hoje: string; reunioes?: Map<string, Pick<Reuniao, "id" | "numero" | "data">>; mostrarOrigem?: boolean; vazio?: string;
}) {
  if (!acoes.length) return <p className="vidro rounded-2xl p-6 text-center text-sm text-stone-400">{vazio}</p>;
  return (
    <div className="vidro overflow-x-auto rounded-2xl">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50/60">
            {["Ação", "Responsável", "Prazo", "Situação", ...(mostrarOrigem ? ["Desde"] : []), ""].map((c, i) => (
              <th key={i} className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {acoes.map((a) => {
            const origem = reunioes?.get(a.reuniao_id);
            return (
              <tr key={a.id} className="align-top transition-colors hover:bg-stone-50">
                <td className="max-w-xl px-5 py-3">
                  <div className={`whitespace-pre-wrap ${a.situacao === "ok" ? "text-stone-400 line-through" : "text-stone-800"}`}>{a.descricao}</div>
                  {a.observacao && <div className="mt-1 text-xs text-stone-500">{a.observacao}</div>}
                </td>
                <td className="px-5 py-3">{a.responsavel ?? <span className="text-stone-400">—</span>}</td>
                <td className="whitespace-nowrap px-5 py-3">{a.prazo ? data(a.prazo) : <span className="text-stone-400">—</span>}</td>
                <td className="px-5 py-3">
                  <SeloSituacao a={a} hoje={hoje} />
                  {a.concluida_em && <div className="mt-1 text-xs text-stone-500">resolvida em {data(a.concluida_em)}</div>}
                </td>
                {mostrarOrigem && (
                  <td className="whitespace-nowrap px-5 py-3">
                    {origem ? <Link href={`/reunioes/${origem.id}`} className="text-madeira-700 hover:underline">{ordinal(origem.numero)} · {data(origem.data)}</Link> : "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-5 py-2">
                  <AcoesLinha>
                    <form action={mudarSituacaoAcao.bind(null, a.id, a.situacao === "ok" ? "pendente" : "ok", a.reuniao_id)}>
                      <button type="submit" className="inline-flex h-8 items-center rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition hover:border-madeira-300 hover:text-madeira-700">
                        {a.situacao === "ok" ? "Reabrir" : "OK"}
                      </button>
                    </form>
                    <LinkEditar id={a.id} param="acao" />
                    <BotaoExcluir acao={excluirAcao.bind(null, a.id, a.reuniao_id)} titulo="Excluir esta ação?" detalhe={a.descricao} aviso="Ação excluída" />
                  </AcoesLinha>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
