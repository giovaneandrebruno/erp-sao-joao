import Link from "next/link";
import { Campo, Selo, estiloBotao, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoExcluir } from "@/components/acoes";
import { data } from "@/lib/format";
import { DIAS_SEMANA, TIPOS_ATESTADO, diaDaSemana, diasDoAtestado, hojeSP, limitesDoMes, nomeDoMes, somarMes, type TipoAtestado } from "@/lib/funcionarios";
import { horasLegiveis } from "@/lib/ponto";
import { FormAtestado, type Atestado } from "./arquivos-form";
import { excluirAtestado, excluirDiaDePonto, salvarDiaDePonto } from "./actions";

export type DiaGravado = { id: string; dia: string; marcacoes: string[]; minutos_trabalhados: number | null; observacao: string | null; origem: string };
export type AtestadoComLink = Atestado & { url: string | null; funcionario_nome?: string };

export const rotuloAtestado = (t: string) => TIPOS_ATESTADO[t as TipoAtestado] ?? "Outro";

/** Setas "‹ mês anterior · mês · próximo ›" que trocam ?mes= na tela. */
export function TrocarMes({ mes, base, extra = "", ancora = "" }: { mes: string; base: string; extra?: string; ancora?: string }) {
  const link = (m: string) => `${base}?mes=${m}${extra}${ancora}`;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link href={link(somarMes(mes, -1))} className={`${estiloBotao.secundario} !px-2.5 !py-1`} aria-label="Mês anterior">‹</Link>
      <span className="min-w-36 text-center font-medium text-stone-800">{nomeDoMes(mes)}</span>
      <Link href={link(somarMes(mes, 1))} className={`${estiloBotao.secundario} !px-2.5 !py-1`} aria-label="Próximo mês">›</Link>
    </div>
  );
}

/** Formulário de um dia de ponto lançado ou corrigido à mão. */
export function FormDiaDePonto({ funcionarioId, dia }: { funcionarioId: string; dia?: Partial<DiaGravado> & { dia: string } }) {
  return (
    <form action={salvarDiaDePonto.bind(null, funcionarioId)} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Dia *"><input name="dia" type="date" required defaultValue={dia?.dia ?? hojeSP()} className={inputCls} /></Campo>
        <Campo rotulo="Horas batidas" className="sm:col-span-2">
          <input name="marcacoes" defaultValue={dia?.marcacoes?.join(" ") ?? ""} placeholder="Ex.: 07:30 11:30 13:00 17:18" className={inputCls} />
        </Campo>
      </div>
      <Campo rotulo="Observação">
        <input name="observacao" defaultValue={dia?.observacao ?? ""} placeholder="Ex.: esqueceu de bater a saída, folga combinada" className={inputCls} />
      </Campo>
      <p className="-mt-2 text-xs text-stone-500">As horas são somadas de duas em duas: entrada → saída, volta do almoço → saída.</p>
      <button className={`${estiloBotao.primario} justify-self-end`}>Salvar</button>
    </form>
  );
}

/** Ponto do mês de um funcionário, dia a dia, com os atestados no meio. */
export function PontoDoMes({ funcionarioId, mes, dias, atestados }: { funcionarioId: string; mes: string; dias: DiaGravado[]; atestados: AtestadoComLink[] }) {
  const { inicio, dias: qtdDias } = limitesDoMes(mes);
  const hoje = hojeSP();
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const atestadoDo = (iso: string) => atestados.find((a) => a.data_inicio <= iso && a.data_fim >= iso);
  const linhas = Array.from({ length: qtdDias }, (_, i) => `${inicio.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
  const total = dias.reduce((t, d) => t + (d.minutos_trabalhados ?? 0), 0);
  const trabalhados = dias.filter((d) => d.marcacoes.length).length;
  const impares = dias.filter((d) => d.marcacoes.length % 2 === 1).length;
  const diasAtestado = linhas.filter((d) => atestadoDo(d)).length;
  const temAlgo = dias.length > 0;

  return (
    <>
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-4">
        <Resumo rotulo="Horas no mês" valor={horasLegiveis(total)} />
        <Resumo rotulo="Dias com ponto" valor={String(trabalhados)} sub={trabalhados ? `média de ${horasLegiveis(total / trabalhados)} por dia` : undefined} />
        <Resumo rotulo="Dias de atestado" valor={String(diasAtestado)} />
        <Resumo rotulo="Marcação faltando" valor={String(impares)} sub="dias com número ímpar de batidas" alerta={impares > 0} />
      </div>
      {!temAlgo && !diasAtestado ? (
        <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
          Nenhuma marcação de ponto neste mês. Importe a planilha do relógio (.xlsx) ou lance os dias à mão.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-stone-500">
              <tr className="border-b border-stone-200"><th className="px-3 py-2">Dia</th><th className="px-3 py-2">Marcações</th><th className="px-3 py-2">Horas</th><th className="px-3 py-2">Observação</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {linhas.map((iso) => {
                const d = porDia.get(iso);
                const at = atestadoDo(iso);
                const sem = diaDaSemana(iso);
                const fimDeSemana = sem === 0 || sem === 6;
                if (!d && !at && (fimDeSemana || iso > hoje)) return null;
                return (
                  <tr key={iso} className={!d && !at ? "text-stone-400" : ""}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{data(iso).slice(0, 5)} <span className="text-stone-400">{DIAS_SEMANA[sem]}</span></td>
                    <td className="px-3 py-2">
                      {d?.marcacoes.length ? (
                        <span className="flex flex-wrap gap-1">
                          {d.marcacoes.map((m, i) => <span key={i} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">{m}</span>)}
                        </span>
                      ) : at ? null : "Sem marcação"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{d?.marcacoes.length ? horasLegiveis(d.minutos_trabalhados) : ""}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {at && <Selo cor="amber">{rotuloAtestado(at.tipo)}</Selo>}
                        {d && d.marcacoes.length % 2 === 1 && <Selo cor="red">Falta uma marcação</Selo>}
                        {d?.origem === "manual" && <Selo>Lançado à mão</Selo>}
                        {d?.observacao && <span className="text-stone-600">{d.observacao}</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <JanelaBotao rotulo={d ? "Corrigir" : "Lançar"} titulo={d ? "Corrigir o dia" : "Lançar o dia"} descricao={data(iso)} variante="link" icone={null} largura="md" aviso="Dia salvo" className="!text-xs">
                          <FormDiaDePonto funcionarioId={funcionarioId} dia={d ?? { dia: iso }} />
                        </JanelaBotao>
                        {d && <BotaoExcluir acao={excluirDiaDePonto.bind(null, d.id, funcionarioId)} titulo="Apagar as marcações deste dia?" detalhe={data(iso)} aviso="Dia apagado" />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Resumo({ rotulo, valor, sub, alerta }: { rotulo: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{rotulo}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${alerta ? "text-rosa" : "text-stone-900"}`}>{valor}</div>
      {sub && <div className="text-[11px] text-stone-500">{sub}</div>}
    </div>
  );
}

/** Lista de atestados (na ficha do funcionário ou na tela de todos). */
export function ListaDeAtestados({ atestados, mostrarNome = false }: { atestados: AtestadoComLink[]; mostrarNome?: boolean }) {
  if (!atestados.length) return <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">Nenhum atestado lançado.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {atestados.map((a) => {
        const dias = diasDoAtestado(a.data_inicio, a.data_fim);
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {mostrarNome && a.funcionario_nome && <Link href={`/funcionarios/${a.funcionario_id}`} className="font-medium text-madeira-800 hover:underline">{a.funcionario_nome}</Link>}
                <span className="font-medium text-stone-800">{rotuloAtestado(a.tipo)}</span>
                <Selo cor="amber">{a.horas ? `${String(a.horas).replace(".", ",")} h` : `${dias} ${dias === 1 ? "dia" : "dias"}`}</Selo>
              </div>
              <div className="mt-0.5 text-xs text-stone-500">
                {a.data_inicio === a.data_fim ? data(a.data_inicio) : `${data(a.data_inicio)} a ${data(a.data_fim)}`}
                {a.cid && <> · CID {a.cid}</>}
                {a.profissional && <> · {a.profissional}</>}
                {a.observacao && <> · {a.observacao}</>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Ver atestado</a>}
              <JanelaBotao rotulo="Alterar" titulo="Alterar atestado" descricao={a.funcionario_nome} variante="secundario" icone={null} largura="md" aviso={null} className="!px-3 !py-1.5">
                <FormAtestado atestado={a} />
              </JanelaBotao>
              <BotaoExcluir acao={excluirAtestado.bind(null, a.id)} titulo="Excluir este atestado?" detalhe={<>{rotuloAtestado(a.tipo)} de {data(a.data_inicio)}. A foto ou o PDF também é apagado.</>} aviso="Atestado excluído" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
