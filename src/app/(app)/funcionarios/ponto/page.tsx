import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Selo, Tabela, Titulo } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { diasNoPeriodo, hojeSP, limitesDoMes, mesValido } from "@/lib/funcionarios";
import { horasLegiveis } from "@/lib/ponto";
import { ImportarPonto } from "../importar-ponto";
import { TrocarMes } from "../componentes";

/** Resumo do relógio ponto do mês: horas de cada funcionário, dias com ponto, marcações faltando e atestados. */
export default async function PontoPage({ searchParams }: PageProps<"/funcionarios/ponto">) {
  const sp = await searchParams;
  const supabase = await createClient(); // antes de ler a data de hoje
  const mes = mesValido(sp.mes) ? sp.mes : hojeSP().slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);
  const [{ data: funcionarios }, { data: ponto }, { data: atestados }] = await Promise.all([
    supabase.from("funcionarios").select("id, nome, apelido, matricula, cpf, pis, cargo, situacao, horas_semana").order("nome"),
    supabase.from("funcionario_ponto").select("funcionario_id, marcacoes, minutos_trabalhados, atualizado_em").gte("dia", inicio).lte("dia", fim).limit(20000),
    supabase.from("funcionario_atestados").select("funcionario_id, data_inicio, data_fim").lte("data_inicio", fim).gte("data_fim", inicio),
  ]);

  const linhas = (funcionarios ?? [])
    .map((f) => {
      const dias = (ponto ?? []).filter((p) => p.funcionario_id === f.id);
      const minutos = dias.reduce((t, d) => t + (d.minutos_trabalhados ?? 0), 0);
      const comPonto = dias.filter((d) => d.marcacoes?.length).length;
      const impares = dias.filter((d) => (d.marcacoes?.length ?? 0) % 2 === 1).length;
      const diasAtestado = (atestados ?? []).filter((a) => a.funcionario_id === f.id).reduce((t, a) => t + diasNoPeriodo(a.data_inicio, a.data_fim, inicio, fim), 0);
      const ultima = dias.map((d) => d.atualizado_em).sort().at(-1) ?? null;
      return { f, minutos, comPonto, impares, diasAtestado, ultima };
    })
    .filter((l) => l.f.situacao !== "desligado" || l.comPonto > 0);
  const total = linhas.reduce((t, l) => t + l.minutos, 0);
  const funcsParaPonto = (funcionarios ?? []).map(({ id, nome, apelido, matricula, cpf, pis }) => ({ id, nome, apelido, matricula, cpf, pis }));

  return (
    <>
      <Titulo
        sub="Horas batidas no relógio ponto em cada mês. Importe a planilha .xlsx do relógio: o sistema reconhece cada pessoa pela matrícula, CPF, PIS ou nome."
        acao={
          <JanelaBotao rotulo="Importar planilha do ponto" titulo="Importar planilha do relógio ponto" icone="importar" largura="lg" aviso={null} abrirAoCarregar={sp.importar === "1"}>
            <ImportarPonto funcionarios={funcsParaPonto} />
          </JanelaBotao>
        }
      >
        Relógio ponto
      </Titulo>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TrocarMes mes={mes} base="/funcionarios/ponto" />
        <span className="text-sm text-stone-500">Total da equipe no mês: <strong className="font-mono text-stone-800">{horasLegiveis(total)}</strong></span>
      </div>
      <Tabela cabecalho={["Funcionário", "Dias com ponto", "Horas no mês", "Média por dia", "Marcação faltando", "Atestado", ""]} vazio={!linhas.length}>
        {linhas.map(({ f, minutos, comPonto, impares, diasAtestado }) => (
          <tr key={f.id}>
            <td className="px-4 py-3">
              <Link href={`/funcionarios/${f.id}?mes=${mes}`} className="font-medium text-madeira-800 hover:underline">{f.nome}</Link>
              <div className="mt-0.5 text-xs text-stone-500">{[f.cargo, f.matricula && `matrícula ${f.matricula}`].filter(Boolean).join(" · ") || "—"}</div>
            </td>
            <td className="px-4 py-3">{comPonto || <span className="text-stone-400">nenhum</span>}</td>
            <td className="px-4 py-3 font-mono">{comPonto ? horasLegiveis(minutos) : "—"}</td>
            <td className="px-4 py-3 font-mono">{comPonto ? horasLegiveis(minutos / comPonto) : "—"}</td>
            <td className="px-4 py-3">{impares ? <Selo cor="red">{impares} {impares === 1 ? "dia" : "dias"}</Selo> : <span className="text-stone-400">—</span>}</td>
            <td className="px-4 py-3">{diasAtestado ? <Selo cor="amber">{diasAtestado} {diasAtestado === 1 ? "dia" : "dias"}</Selo> : <span className="text-stone-400">—</span>}</td>
            <td className="px-4 py-2 text-right"><Link href={`/funcionarios/${f.id}?mes=${mes}#ponto`} className="text-sm font-medium text-madeira-700 hover:underline">Ver dia a dia</Link></td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
