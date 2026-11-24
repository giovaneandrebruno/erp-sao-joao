import { createClient } from "@/lib/supabase/server";
import { Cartao, Indicador, Titulo, estiloBotao, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BUCKET_FUNCIONARIOS, hojeSP, limitesDoMes, mesValido, diasNoPeriodo } from "@/lib/funcionarios";
import { FormAtestado } from "../arquivos-form";
import { ListaDeAtestados, TrocarMes, rotuloAtestado, type AtestadoComLink } from "../componentes";

/** Todos os atestados do mês, de todos os funcionários. */
export default async function AtestadosPage({ searchParams }: PageProps<"/funcionarios/atestados">) {
  const sp = await searchParams;
  const supabase = await createClient(); // antes de ler a data de hoje
  const mes = mesValido(sp.mes) ? sp.mes : hojeSP().slice(0, 7);
  const quem = typeof sp.funcionario === "string" ? sp.funcionario : "";
  const { inicio, fim } = limitesDoMes(mes);
  let consulta = supabase
    .from("funcionario_atestados")
    .select("*, funcionarios(nome)")
    .lte("data_inicio", fim)
    .gte("data_fim", inicio)
    .order("data_inicio", { ascending: false });
  if (/^[0-9a-f-]{36}$/i.test(quem)) consulta = consulta.eq("funcionario_id", quem);
  const [{ data: atestados }, { data: funcionarios }] = await Promise.all([
    consulta,
    supabase.from("funcionarios").select("id, nome, situacao").order("nome"),
  ]);
  const caminhos = (atestados ?? []).map((a) => a.caminho).filter(Boolean) as string[];
  const { data: links } = caminhos.length ? await supabase.storage.from(BUCKET_FUNCIONARIOS).createSignedUrls(caminhos, 3600) : { data: [] };
  const lista: AtestadoComLink[] = (atestados ?? []).map((a) => ({
    ...a,
    funcionario_nome: (a.funcionarios as unknown as { nome: string } | null)?.nome,
    url: a.caminho ? links?.find((l) => l.path === a.caminho)?.signedUrl ?? null : null,
  }));
  const diasNoMes = lista.reduce((t, a) => t + diasNoPeriodo(a.data_inicio, a.data_fim, inicio, fim), 0);
  const pessoas = new Set(lista.map((a) => a.funcionario_id)).size;
  const porTipo = Object.entries(lista.reduce<Record<string, number>>((m, a) => ({ ...m, [a.tipo]: (m[a.tipo] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const naEmpresa = (funcionarios ?? []).filter((f) => f.situacao !== "desligado");

  return (
    <>
      <Titulo
        sub="Atestados e afastamentos que caem dentro do mês escolhido."
        acao={
          <JanelaBotao rotulo="Lançar atestado" titulo="Lançar atestado" largura="md" aviso={null}>
            <FormAtestado funcionarios={naEmpresa} />
          </JanelaBotao>
        }
      >
        Atestados
      </Titulo>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TrocarMes mes={mes} base="/funcionarios/atestados" extra={quem ? `&funcionario=${quem}` : ""} />
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="mes" value={mes} />
          <select name="funcionario" defaultValue={quem} className={`${inputCls} w-auto`}>
            <option value="">Todos os funcionários</option>
            {(funcionarios ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className={estiloBotao.secundario}>Filtrar</button>
        </form>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Atestados no mês" valor={lista.length} sub={`${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}`} />
        <Indicador rotulo="Dias fora no mês" valor={diasNoMes} />
        <Indicador rotulo="Mais comum" valor={porTipo[0] ? porTipo[0][1] : 0} sub={porTipo[0] ? rotuloAtestado(porTipo[0][0]) : "nenhum"} />
      </div>
      <Cartao><ListaDeAtestados atestados={lista} mostrarNome /></Cartao>
    </>
  );
}
