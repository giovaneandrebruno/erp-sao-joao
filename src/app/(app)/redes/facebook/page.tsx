import { connection } from "next/server";
import { Titulo } from "@/components/ui";
import { Colunas } from "@/components/graficos/graficos";
import { formatar } from "@/components/graficos/formato";
import { Bloco, Kpi, Legenda } from "@/components/graficos/paineis";
import { conexaoAtual, dadosFacebook, guardarDia, type DadosFacebook } from "@/lib/redes";
import { ContaLigada, ErroDaMeta, EscolherPeriodo, SemConexao, diasDoPeriodo, lerDias, porDia, recentes, rotuloDia, soma } from "../comum";
import { Publicacoes } from "../publicacoes";

export default async function FacebookPage({ searchParams }: PageProps<"/redes/facebook">) {
  await connection();
  const dias = lerDias((await searchParams).dias);
  const conexao = await conexaoAtual();
  if (!conexao?.token) {
    return (
      <>
        <Titulo>Facebook</Titulo>
        <SemConexao conexao={conexao} />
      </>
    );
  }
  let d: DadosFacebook;
  try {
    d = await dadosFacebook(conexao, dias);
  } catch (e) {
    return (
      <>
        <Titulo>Facebook</Titulo>
        <ErroDaMeta mensagem={(e as Error).message} />
      </>
    );
  }
  const lista = diasDoPeriodo(dias);
  const rot = lista.map(rotuloDia);
  const alcance = porDia(d.alcancePorDia, lista);
  const engaj = porDia(d.engajamentoPorDia, lista);
  const novos = porDia(d.novosSeguidoresPorDia, lista);
  const visitas = porDia(d.visitasPorDia, lista);
  await guardarDia("facebook", { seguidores: d.seguidores, alcance: alcance.at(-1) ?? null, interacoes: engaj.at(-1) ?? null });
  const noPeriodo = recentes(d.publicacoes, dias);
  const melhores = [...d.publicacoes].sort((x, y) => y.reacoes + y.comentarios + y.compartilhamentos - (x.reacoes + x.comentarios + x.compartilhamentos)).slice(0, 6);

  return (
    <>
      <Titulo sub={d.link ? <a href={d.link} target="_blank" rel="noreferrer" className="hover:text-violeta">{d.nome}</a> : d.nome}>Facebook</Titulo>
      <ContaLigada conexao={conexao} />
      <EscolherPeriodo dias={dias} base="/redes/facebook" />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Seguidores da página" valor={formatar(d.seguidores, "num")} sub={d.novosSeguidoresPorDia ? `+${formatar(soma(novos), "num")} novos no período` : undefined} />
        <Kpi rotulo="Pessoas alcançadas" valor={d.alcancePorDia ? formatar(soma(alcance), "num") : "—"} formato="num" serie={d.alcancePorDia ? alcance : undefined} rotulos={rot} sub="soma das pessoas alcançadas por dia" />
        <Kpi rotulo="Engajamento nos posts" valor={d.engajamentoPorDia ? formatar(soma(engaj), "num") : "—"} formato="num" serie={d.engajamentoPorDia ? engaj : undefined} rotulos={rot} sub="reações, comentários, cliques e compartilhamentos" />
        <Kpi rotulo="Visitas à página" valor={d.visitasPorDia ? formatar(soma(visitas), "num") : "—"} sub={`${noPeriodo.length} ${noPeriodo.length === 1 ? "post publicado" : "posts publicados"} no período`} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Pessoas alcançadas por dia" legenda={<Legenda itens={[{ nome: "Alcance" }]} />} tabela={{ cabecalho: ["Dia", "Alcance", "Engajamento"], linhas: lista.map((x, i) => [rot[i], alcance[i], engaj[i]]) }}>
          {d.alcancePorDia ? <Colunas rotulos={rot} series={[{ nome: "Alcance", valores: alcance }]} formato="num" rotular="maior" /> : <p className="py-6 text-center text-sm text-stone-400">A Meta não entregou o alcance da página.</p>}
        </Bloco>
        <Bloco titulo="Engajamento por dia" legenda={<Legenda itens={[{ nome: "Engajamento", cor: "#4a4a4a" }]} />}>
          {d.engajamentoPorDia ? <Colunas rotulos={rot} series={[{ nome: "Engajamento", valores: engaj, cor: "#4a4a4a" }]} formato="num" rotular="maior" /> : <p className="py-6 text-center text-sm text-stone-400">A Meta não entregou o engajamento da página.</p>}
        </Bloco>
      </div>
      <Bloco titulo="Posts que mais deram resultado" sub="Entre os últimos 15, pela soma de reações, comentários e compartilhamentos">
        <Publicacoes itens={melhores.map((p) => ({ ...p, tipo: "Post", numeros: [{ rotulo: "Reações", valor: p.reacoes }, { rotulo: "Coment.", valor: p.comentarios }, { rotulo: "Compart.", valor: p.compartilhamentos }] }))} />
      </Bloco>
    </>
  );
}
