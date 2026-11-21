import Link from "next/link";
import { connection } from "next/server";
import { Titulo } from "@/components/ui";
import { Colunas } from "@/components/graficos/graficos";
import { formatar } from "@/components/graficos/formato";
import { BarrasH, Bloco, Kpi, Legenda } from "@/components/graficos/paineis";
import { dataHora } from "@/lib/format";
import { EscolherPeriodo, diasDoPeriodo, lerDias, porDia, rotuloDia, variacao } from "../comum";
import { carregarSite } from "./dados";

export default async function SitePage({ searchParams }: PageProps<"/redes/site">) {
  await connection();
  const dias = lerDias((await searchParams).dias);
  const s = await carregarSite(dias);
  const lista = diasDoPeriodo(dias, true);
  const acessos = porDia(s.acessosPorDia, lista);
  const diasComUso = acessos.filter((x) => x > 0).length;
  const aberturas = s.propostas.reduce((a, p) => a + p.aberturas, 0);

  return (
    <>
      <Titulo sub="Quanto a equipe usa o sistema e quantas propostas online os clientes abriram">Uso do site</Titulo>
      <EscolherPeriodo dias={dias} base="/redes/site" />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Telas abertas pela equipe" valor={formatar(s.total, "num")} formato="num" variacao={variacao(s.total, s.totalAntes)} contra={`vs. ${dias} dias anteriores`} serie={acessos} rotulos={lista.map(rotuloDia)} />
        <Kpi rotulo="Pessoas que usaram" valor={formatar(s.pessoas, "num")} sub="com login no sistema" />
        <Kpi rotulo="Dias com uso" valor={`${diasComUso} de ${dias}`} sub={diasComUso < dias / 2 ? "o sistema ficou parado em muitos dias" : "uso frequente"} />
        <Kpi rotulo="Propostas abertas pelos clientes" valor={formatar(s.propostas.length, "num")} sub={`${aberturas} ${aberturas === 1 ? "abertura" : "aberturas"} no total`} />
      </div>
      <Bloco
        className="mb-4"
        titulo="Telas abertas por dia"
        sub="Cada vez que alguém da equipe abre uma tela do sistema"
        legenda={<Legenda itens={[{ nome: "Telas abertas" }]} />}
        tabela={{ cabecalho: ["Dia", "Telas abertas", "Pessoas"], linhas: lista.map((d, i) => [rotuloDia(d), acessos[i], s.pessoasPorDia[d] ?? 0]) }}
      >
        <Colunas rotulos={lista.map(rotuloDia)} series={[{ nome: "Telas abertas", valores: acessos }]} formato="num" rotular="maior" altura={220} />
      </Bloco>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Telas mais usadas" sub={`Últimos ${dias} dias`} tabela={{ cabecalho: ["Tela", "Vezes"], linhas: s.porTela.map((t) => [t.nome, t.valor]) }}>
          <BarrasH itens={s.porTela} formato="num" vazio="Ninguém abriu o sistema neste período." />
        </Bloco>
        <Bloco titulo="Quem mais usa" sub={`Últimos ${dias} dias`} tabela={{ cabecalho: ["Pessoa", "Telas"], linhas: s.porPessoa.map((p) => [p.nome, p.valor]) }}>
          <BarrasH itens={s.porPessoa} formato="num" vazio="Ninguém abriu o sistema neste período." />
        </Bloco>
      </div>
      <Bloco titulo="Propostas online abertas pelos clientes" sub="Pela última vez que o cliente abriu o link da proposta">
        {s.propostas.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {s.propostas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link href={`/orcamentos/${p.id}`} className="font-medium text-stone-900 hover:text-violeta">Orçamento {p.numero ?? ""} · {p.cliente}</Link>
                <span className="text-xs text-stone-500">abriu {p.aberturas} {p.aberturas === 1 ? "vez" : "vezes"} · última em {dataHora(p.ultima)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-stone-400">Nenhum cliente abriu proposta neste período.</p>
        )}
      </Bloco>
    </>
  );
}
