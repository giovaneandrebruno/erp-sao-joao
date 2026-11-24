import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { BotaoCancelar, JanelaEditar, LinkEditar } from "@/components/acoes";
import { data } from "@/lib/format";
import { hojeSP, limitesDoMes, mesValido } from "@/lib/funcionarios";
import { horasLegiveis } from "@/lib/ponto";
import { saldoDoPeriodo } from "@/lib/banco-horas";
import { TrocarMes } from "../componentes";
import { salvarBancoHoras } from "./actions";

const corSaldo = (min: number) => (min > 0 ? "text-neon" : min < 0 ? "text-rosa" : "text-stone-500");
const comSinal = (min: number) => (min > 0 ? `+${horasLegiveis(min)}` : horasLegiveis(min));

/** Banco de horas: saldo do mês e saldo acumulado de cada pessoa, a partir do relógio ponto. */
export default async function BancoDeHorasPage({ searchParams }: PageProps<"/funcionarios/banco-horas">) {
  const sp = await searchParams;
  const supabase = await createClient(); // antes de ler a data de hoje
  const hoje = hojeSP();
  const mes = mesValido(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);

  const { data: funcionarios } = await supabase
    .from("funcionarios")
    .select("id, nome, cargo, situacao, horas_semana, data_admissao, banco_horas_inicio, banco_horas_saldo_inicial")
    .order("nome");
  const [{ data: ponto }, { data: atestados }] = await Promise.all([
    supabase.from("funcionario_ponto").select("funcionario_id, dia, minutos_trabalhados").lte("dia", fim).order("dia").limit(50000),
    supabase.from("funcionario_atestados").select("funcionario_id, data_inicio, data_fim").lte("data_inicio", fim),
  ]);

  const linhas = (funcionarios ?? [])
    .map((f) => {
      const dias = (ponto ?? []).filter((p) => p.funcionario_id === f.id);
      const ats = (atestados ?? []).filter((a) => a.funcionario_id === f.id);
      const ultimo = dias.at(-1)?.dia ?? null; // última marcação importada até o fim do mês
      const comeco = f.banco_horas_inicio ?? f.data_admissao ?? dias[0]?.dia ?? null;
      const horas = Number(f.horas_semana ?? 0);
      if (!horas || !comeco || !ultimo) return { f, horas, comeco, ultimo, mesSaldo: null, acumulado: null };
      const ate = [fim, ultimo, hoje].sort()[0];
      const mesSaldo = saldoDoPeriodo({ de: [inicio, comeco].sort().at(-1)!, ate, horasSemana: horas, dias, atestados: ats });
      const total = saldoDoPeriodo({ de: comeco, ate, horasSemana: horas, dias, atestados: ats });
      return { f, horas, comeco, ultimo, mesSaldo, acumulado: total.saldo + Number(f.banco_horas_saldo_inicial ?? 0) };
    })
    .filter((l) => l.f.situacao !== "desligado" || l.mesSaldo);

  const emEdicao = typeof sp.editar === "string" ? (funcionarios ?? []).find((f) => f.id === sp.editar) : undefined;

  return (
    <>
      <Titulo sub="Horas batidas no relógio ponto menos a jornada de cada pessoa (horas por semana ÷ 5, de segunda a sexta, sem feriados). Atestado não conta como falta.">
        Banco de horas
      </Titulo>
      <div className="mb-4"><TrocarMes mes={mes} base="/funcionarios/banco-horas" /></div>
      <Tabela cabecalho={["Funcionário", "Jornada", "Previsto no mês", "Trabalhado no mês", "Saldo do mês", "Saldo acumulado", ""]} vazio={!linhas.length}>
        {linhas.map(({ f, horas, comeco, ultimo, mesSaldo, acumulado }) => (
          <tr key={f.id}>
            <td className="px-4 py-3">
              <Link href={`/funcionarios/${f.id}?mes=${mes}#ponto`} className="font-medium text-madeira-800 hover:underline">{f.nome}</Link>
              <div className="mt-0.5 text-xs text-stone-500">{[f.cargo, comeco && `desde ${data(comeco)}`, ultimo && `ponto até ${data(ultimo)}`].filter(Boolean).join(" · ") || "—"}</div>
            </td>
            <td className="px-4 py-3">{horas ? `${horas.toLocaleString("pt-BR")}h/semana` : <Link href={`/funcionarios/${f.id}`} className="text-xs text-madeira-700 hover:underline">informar horas por semana na ficha</Link>}</td>
            {mesSaldo ? (
              <>
                <td className="px-4 py-3 font-mono">{horasLegiveis(mesSaldo.previsto)}<div className="font-sans text-xs text-stone-500">{mesSaldo.diasPrevistos} dia(s) útil(eis)</div></td>
                <td className="px-4 py-3 font-mono">{horasLegiveis(mesSaldo.trabalhado)}{mesSaldo.faltas > 0 && <div className="mt-1 font-sans"><Selo cor="amber">{mesSaldo.faltas} dia(s) sem ponto</Selo></div>}</td>
                <td className={`px-4 py-3 font-mono font-semibold ${corSaldo(mesSaldo.saldo)}`}>{comSinal(mesSaldo.saldo)}</td>
                <td className={`px-4 py-3 font-mono font-semibold ${corSaldo(acumulado!)}`}>{comSinal(acumulado!)}</td>
              </>
            ) : (
              <td colSpan={4} className="px-4 py-3 text-sm text-stone-400">{!horas ? "Sem jornada cadastrada" : "Sem ponto importado até este mês"}</td>
            )}
            <td className="px-4 py-2 text-right"><LinkEditar id={f.id} /></td>
          </tr>
        ))}
      </Tabela>
      <Cartao className="mt-6">
        <p className="text-sm text-stone-600">
          Os dias depois da última marcação importada ainda não contam. No lápis de cada pessoa dá para escolher a data em que o banco de horas começou e o saldo que ela já tinha antes.
        </p>
      </Cartao>

      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Banco de horas" descricao={emEdicao.nome} aviso="Banco de horas salvo" largura="sm">
          <form action={salvarBancoHoras.bind(null, emEdicao.id)} className="grid gap-3">
            <Campo rotulo="Começou a contar em">
              <input name="banco_horas_inicio" type="date" defaultValue={emEdicao.banco_horas_inicio ?? ""} className={inputCls} />
            </Campo>
            <p className="-mt-1 text-xs text-stone-500">Em branco = desde a admissão (ou desde o primeiro ponto importado).</p>
            <Campo rotulo="Saldo que já tinha antes">
              <input name="saldo_inicial" defaultValue={emEdicao.banco_horas_saldo_inicial ? horasLegiveis(emEdicao.banco_horas_saldo_inicial).replace("−", "-") : ""} placeholder="Ex.: 5h30 ou -2h15" className={inputCls} />
            </Campo>
            <div className="flex gap-2">
              <Botao type="submit">Salvar</Botao>
              <BotaoCancelar />
            </div>
          </form>
        </JanelaEditar>
      )}
    </>
  );
}
