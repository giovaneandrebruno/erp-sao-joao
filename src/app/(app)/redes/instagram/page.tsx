import { connection } from "next/server";
import { Titulo } from "@/components/ui";
import { Colunas } from "@/components/graficos/graficos";
import { formatar } from "@/components/graficos/formato";
import { BarrasH, Bloco, Kpi, Legenda } from "@/components/graficos/paineis";
import { conexaoAtual, dadosInstagram, guardarDia, type DadosInstagram } from "@/lib/redes";
import { ContaLigada, DIAS_SEMANA, ErroDaMeta, EscolherPeriodo, SemConexao, diaDaSemana, diasDoPeriodo, lerDias, porDia, recentes, rotuloDia, soma, variacao } from "../comum";
import { Publicacoes } from "../publicacoes";

const kpis = "mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

export default async function InstagramPage({ searchParams }: PageProps<"/redes/instagram">) {
  await connection();
  const dias = lerDias((await searchParams).dias);
  const conexao = await conexaoAtual();
  if (!conexao?.token || !conexao.ig_id) {
    return (
      <>
        <Titulo>Instagram</Titulo>
        {conexao?.token && !conexao.ig_id ? <ErroDaMeta mensagem="A página do Facebook ligada não tem um Instagram comercial ligado a ela." /> : <SemConexao conexao={conexao} />}
      </>
    );
  }
  let d: DadosInstagram;
  try {
    d = await dadosInstagram(conexao, dias);
  } catch (e) {
    return (
      <>
        <Titulo>Instagram</Titulo>
        <ErroDaMeta mensagem={(e as Error).message} />
      </>
    );
  }
  const lista = diasDoPeriodo(dias);
  const alcance = porDia(d.alcancePorDia, lista);
  const novos = d.seguidoresPorDia ? porDia(d.seguidoresPorDia, lista) : null;
  await guardarDia("instagram", { seguidores: d.seguidores, alcance: alcance.at(-1) ?? null, interacoes: d.totais.total_interactions ?? null });

  const t = d.totais;
  const a = d.totaisAntes;
  const contra = `vs. ${dias} dias anteriores`;
  const noPeriodo = recentes(d.publicacoes, dias);
  const melhores = [...d.publicacoes].sort((x, y) => y.interacoes - x.interacoes).slice(0, 6);

  const porTipo = Object.entries(
    d.publicacoes.reduce<Record<string, { soma: number; n: number }>>((acc, p) => {
      const g = (acc[p.tipo] ??= { soma: 0, n: 0 });
      g.soma += p.interacoes;
      g.n++;
      return acc;
    }, {}),
  ).map(([nome, g]) => ({ nome, valor: Math.round(g.soma / g.n), detalhe: `${g.n} ${g.n === 1 ? "post" : "posts"}` })).sort((x, y) => y.valor - x.valor);

  const porDiaSemana = DIAS_SEMANA.map((nome, i) => {
    const ps = d.publicacoes.filter((p) => diaDaSemana(p.em) === i);
    return { nome, valor: ps.length ? Math.round(soma(ps.map((p) => p.interacoes)) / ps.length) : 0, detalhe: `${ps.length} ${ps.length === 1 ? "post" : "posts"}` };
  }).filter((x) => x.detalhe !== "0 posts").sort((x, y) => y.valor - x.valor);

  return (
    <>
      <Titulo sub={`@${d.usuario} · ${formatar(d.posts, "num")} publicações no perfil`}>Instagram</Titulo>
      <ContaLigada conexao={conexao} />
      <EscolherPeriodo dias={dias} base="/redes/instagram" />
      <div className={kpis}>
        <Kpi rotulo="Seguidores" valor={formatar(d.seguidores, "num")} sub={novos ? `+${formatar(soma(novos), "num")} novos nos últimos ${Math.min(dias, 30)} dias` : undefined} />
        <Kpi rotulo="Contas alcançadas" valor={formatar(t.reach ?? soma(alcance), "num")} formato="num" variacao={variacao(t.reach, a.reach)} contra={contra} serie={alcance} rotulos={lista.map(rotuloDia)} />
        <Kpi rotulo="Visualizações" valor={formatar(t.views, "num")} variacao={variacao(t.views, a.views)} contra={contra} />
        <Kpi rotulo="Interações" valor={formatar(t.total_interactions, "num")} variacao={variacao(t.total_interactions, a.total_interactions)} contra={contra} sub="curtidas, comentários, salvos e compartilhamentos" />
      </div>
      <div className={kpis}>
        <Kpi rotulo="Visitas ao perfil" valor={formatar(t.profile_views, "num")} variacao={variacao(t.profile_views, a.profile_views)} contra={contra} />
        <Kpi rotulo="Contas que interagiram" valor={formatar(t.accounts_engaged, "num")} variacao={variacao(t.accounts_engaged, a.accounts_engaged)} contra={contra} />
        <Kpi rotulo="Cliques no link do perfil" valor={formatar(t.website_clicks, "num")} variacao={variacao(t.website_clicks, a.website_clicks)} contra={contra} />
        <Kpi rotulo="Publicações no período" valor={formatar(noPeriodo.length, "num")} sub={noPeriodo.length ? `média de ${formatar(Math.round(soma(noPeriodo.map((p) => p.interacoes)) / noPeriodo.length), "num")} interações cada` : "nenhum post novo"} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Contas alcançadas por dia" sub="Pessoas diferentes que viram algum conteúdo seu" legenda={<Legenda itens={[{ nome: "Alcance" }]} />} tabela={{ cabecalho: ["Dia", "Alcance"], linhas: lista.map((x, i) => [rotuloDia(x), alcance[i]]) }}>
          <Colunas rotulos={lista.map(rotuloDia)} series={[{ nome: "Alcance", valores: alcance }]} formato="num" rotular="maior" />
        </Bloco>
        <Bloco titulo="Novos seguidores por dia" sub={novos ? "A Meta mostra só os últimos 30 dias" : "Aparece quando a conta tiver mais de 100 seguidores"} legenda={<Legenda itens={[{ nome: "Novos seguidores", cor: "#4a4a4a" }]} />}>
          {novos ? <Colunas rotulos={lista.map(rotuloDia)} series={[{ nome: "Novos seguidores", valores: novos, cor: "#4a4a4a" }]} formato="num" rotular="maior" /> : <p className="py-6 text-center text-sm text-stone-400">Sem dados de seguidores por dia.</p>}
        </Bloco>
      </div>
      <Bloco className="mb-4" titulo="Publicações que mais deram resultado" sub="Entre as últimas 18, pela soma de curtidas, comentários, salvos e compartilhamentos">
        <Publicacoes itens={melhores.map((p) => ({ ...p, texto: p.legenda, numeros: [{ rotulo: "Alcance", valor: p.alcance }, { rotulo: "Interações", valor: p.interacoes }, { rotulo: "Curtidas", valor: p.curtidas }, { rotulo: "Salvos", valor: p.salvos }] }))} />
      </Bloco>
      <div className="grid gap-4 lg:grid-cols-3">
        <Bloco titulo="Que tipo de post funciona melhor" sub="Média de interações por post">
          <BarrasH itens={porTipo} formato="num" />
        </Bloco>
        <Bloco titulo="Melhor dia para postar" sub="Média de interações dos posts de cada dia">
          <BarrasH itens={porDiaSemana} formato="num" />
        </Bloco>
        <Bloco titulo="De onde são os seguidores" sub="Cidades com mais seguidores">
          <BarrasH itens={d.cidades} formato="num" vazio="Aparece quando a conta tiver mais de 100 seguidores." />
        </Bloco>
      </div>
    </>
  );
}
