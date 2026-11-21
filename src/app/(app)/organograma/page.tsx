import Link from "next/link";
import { Suspense } from "react";
import { Erro, Titulo } from "@/components/ui";
import { calcularOrganograma } from "@/lib/organograma";
import { lerOrganograma } from "./dados";
import { QuadroOrganograma } from "./quadro";

/** Organograma em tela quadriculada, com a carga de trabalho de cada quadro. */
export default async function OrganogramaPage() {
  const { pessoas, funcoes, atribuicoes, erro } = await lerOrganograma();
  const calc = calcularOrganograma(pessoas, funcoes, atribuicoes);
  const gente = pessoas.length - calc.vagas.length;

  return (
    <>
      <Titulo sub="Monte o organograma, defina as funções de cada um e veja quem está sobrecarregado e onde falta gente.">Organograma</Titulo>
      <Erro mensagem={erro} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Resumo rotulo="Pessoas" valor={gente} href="/organograma/carga" />
        <Resumo rotulo="Vagas em aberto" valor={calc.vagas.length} href="/organograma/carga?ver=vagas" destaque={calc.vagas.length > 0} />
        <Resumo rotulo="Sobrecarregadas" valor={calc.sobrecarregadas.length} href="/organograma/carga?ver=sobrecarregadas" perigo={calc.sobrecarregadas.length > 0} />
        <Resumo rotulo="Funções sem ninguém" valor={calc.semNinguem.length} href="/organograma/funcoes?ver=sem" perigo={calc.semNinguem.length > 0} />
      </div>
      <Suspense>
        <QuadroOrganograma pessoas={pessoas} funcoes={funcoes} atribuicoes={atribuicoes} />
      </Suspense>
    </>
  );
}

function Resumo({ rotulo, valor, href, perigo, destaque }: { rotulo: string; valor: number; href: string; perigo?: boolean; destaque?: boolean }) {
  const cor = perigo ? "text-rosa" : destaque ? "text-madeira-700" : "text-stone-900";
  return (
    <Link href={href} className="vidro flex items-center gap-2.5 rounded-xl px-4 py-2 transition hover:bg-stone-50">
      <span className={`font-mono text-lg font-semibold ${cor}`}>{valor}</span>
      <span className="text-stone-600">{rotulo}</span>
    </Link>
  );
}
