import Link from "next/link";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { Cartao, Titulo } from "@/components/ui";
import { BotaoExcluir } from "@/components/acoes";
import { formatar } from "@/components/graficos/formato";
import { Bloco, Insights, Kpi, type Insight } from "@/components/graficos/paineis";
import { conexaoAtual, conversas, dadosFacebook, dadosInstagram, type Conversa, type DadosFacebook, type DadosInstagram } from "@/lib/redes";
import { ContaLigada, EscolherPeriodo, SemConexao, diasDoPeriodo, lerDias, porDia, rotuloDia, soma, variacao } from "./comum";
import { carregarSite } from "./site/dados";
import { desligarRedes } from "./actions";

const REDES = [
  { chave: null, rotulo: "Todas as redes" },
  { chave: "instagram", rotulo: "Instagram" },
  { chave: "facebook", rotulo: "Facebook" },
  { chave: "site", rotulo: "Site" },
] as const;
type Rede = (typeof REDES)[number]["chave"];

const ERROS: Record<string, string> = {
  app: "O aplicativo da Meta ainda não foi cadastrado no sistema.",
  cancelado: "A ligação foi cancelada no Facebook.",
  estado: "A ligação demorou demais ou veio de outro lugar. Tente de novo.",
  "sem-pagina": "Essa conta do Facebook não administra nenhuma página. Entre com a conta que administra a página da loja.",
  meta: "A Meta recusou a ligação.",
};

export default async function RedesPage({ searchParams }: PageProps<"/redes">) {
  await connection();
  const sp = await searchParams;
  const dias = lerDias(sp.dias);
  const rede: Rede = REDES.find((r) => r.chave === sp.rede)?.chave ?? null;
  const ver = (r: Exclude<Rede, null>) => rede === null || rede === r;
  const conexao = await conexaoAtual();
  const ligado = Boolean(conexao?.token);
  const contra = `vs. ${dias} dias anteriores`;

  const [ig, fb, msgs, site] = await Promise.all([
    ligado && conexao!.ig_id && ver("instagram") ? dadosInstagram(conexao!, dias).catch(() => null) : null,
    ligado && ver("facebook") ? dadosFacebook(conexao!, dias).catch(() => null) : null,
    ligado && rede !== "site" ? conversas(conexao!).then((r) => r.lista.filter((c) => (rede === "facebook" ? c.rede === "messenger" : rede === "instagram" ? c.rede === "instagram" : true))).catch(() => null) : null,
    carregarSite(dias),
  ]);

  const lista = diasDoPeriodo(dias);
  const rot = lista.map(rotuloDia);
  const insights = gerarInsights(ig, fb, msgs, rede === null || rede === "site" ? site : null, dias);
  const esperando = msgs?.filter((c) => c.deles).length ?? 0;
  const igSerie = ig ? porDia(ig.alcancePorDia, lista) : undefined;
  const fbAlcance = fb?.alcancePorDia ? porDia(fb.alcancePorDia, lista) : undefined;
  const fbEngaj = fb?.engajamentoPorDia ? porDia(fb.engajamentoPorDia, lista) : undefined;
  const listaHoje = diasDoPeriodo(dias, true);
  const k = {
    igSeguidores: <Kpi key="igs" rotulo="Seguidores no Instagram" valor={ig ? formatar(ig.seguidores, "num") : "—"} sub={ig?.seguidoresPorDia ? `+${formatar(soma(Object.values(ig.seguidoresPorDia)), "num")} nos últimos ${Math.min(dias, 30)} dias` : ligado ? undefined : "ligue o Instagram"} href="/redes/instagram" />,
    igAlcance: <Kpi key="iga" rotulo="Alcance no Instagram" valor={ig ? formatar(ig.totais.reach ?? 0, "num") : "—"} formato="num" variacao={ig ? variacao(ig.totais.reach, ig.totaisAntes.reach) : undefined} contra={contra} serie={igSerie} rotulos={rot} href="/redes/instagram" />,
    igViews: <Kpi key="igv" rotulo="Visualizações no Instagram" valor={ig ? formatar(ig.totais.views, "num") : "—"} variacao={ig ? variacao(ig.totais.views, ig.totaisAntes.views) : undefined} contra={contra} href="/redes/instagram" />,
    igInter: <Kpi key="igi" rotulo="Interações no Instagram" valor={ig ? formatar(ig.totais.total_interactions, "num") : "—"} variacao={ig ? variacao(ig.totais.total_interactions, ig.totaisAntes.total_interactions) : undefined} contra={contra} href="/redes/instagram" />,
    igPerfil: <Kpi key="igp" rotulo="Visitas ao perfil" valor={ig ? formatar(ig.totais.profile_views, "num") : "—"} variacao={ig ? variacao(ig.totais.profile_views, ig.totaisAntes.profile_views) : undefined} contra={contra} href="/redes/instagram" />,
    fbSeguidores: <Kpi key="fbs" rotulo="Seguidores no Facebook" valor={fb ? formatar(fb.seguidores, "num") : "—"} sub={fbAlcance && rede === null ? `${formatar(soma(fbAlcance), "num")} pessoas alcançadas no período` : ligado ? undefined : "ligue o Facebook"} href="/redes/facebook" />,
    fbAlcance: <Kpi key="fba" rotulo="Alcance no Facebook" valor={fbAlcance ? formatar(soma(fbAlcance), "num") : "—"} formato="num" serie={fbAlcance} rotulos={rot} href="/redes/facebook" />,
    fbEngaj: <Kpi key="fbe" rotulo="Engajamento no Facebook" valor={fbEngaj ? formatar(soma(fbEngaj), "num") : "—"} formato="num" serie={fbEngaj} rotulos={rot} href="/redes/facebook" />,
    fbVisitas: <Kpi key="fbv" rotulo="Visitas à página" valor={fb?.visitasPorDia ? formatar(soma(porDia(fb.visitasPorDia, lista)), "num") : "—"} href="/redes/facebook" />,
    msgs: <Kpi key="msg" rotulo="Mensagens esperando resposta" valor={msgs ? formatar(esperando, "num") : "—"} sub={msgs ? `${msgs.length} conversas recentes` : ligado ? "sem permissão de mensagens" : "ligue as contas"} href={`/redes/mensagens?filtro=${rede === "instagram" ? "instagram" : rede === "facebook" ? "messenger" : "esperando"}`} />,
    posts: <Kpi key="pst" rotulo="Posts publicados" valor={ig || fb ? formatar(postsNoPeriodo(ig, fb, dias), "num") : "—"} sub={rede === "instagram" ? "no Instagram, no período" : rede === "facebook" ? "no Facebook, no período" : "Instagram e Facebook, no período"} />,
    telas: <Kpi key="tel" rotulo="Telas abertas pela equipe" valor={formatar(site.total, "num")} formato="num" variacao={variacao(site.total, site.totalAntes)} contra={contra} serie={porDia(site.acessosPorDia, listaHoje)} rotulos={listaHoje.map(rotuloDia)} href="/redes/site" />,
    pessoas: <Kpi key="pes" rotulo="Pessoas que usaram o site" valor={formatar(site.pessoas, "num")} href="/redes/site" />,
    propostas: <Kpi key="pro" rotulo="Propostas abertas pelos clientes" valor={formatar(site.propostas.length, "num")} href="/redes/site" />,
    dias: <Kpi key="dia" rotulo="Dias com uso do site" valor={`${Object.keys(site.acessosPorDia).length} de ${dias}`} href="/redes/site" />,
  };
  const cartoes: ReactNode[] =
    rede === "instagram" ? [k.igSeguidores, k.igAlcance, k.igViews, k.igInter, k.igPerfil, k.msgs, k.posts]
    : rede === "facebook" ? [k.fbSeguidores, k.fbAlcance, k.fbEngaj, k.fbVisitas, k.msgs, k.posts]
    : rede === "site" ? [k.telas, k.pessoas, k.dias, k.propostas]
    : [k.igSeguidores, k.igAlcance, k.fbSeguidores, k.msgs, k.telas, k.pessoas, k.propostas, k.posts];
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] ?? "Não deu para ligar." : null;

  return (
    <>
      <Titulo sub="Instagram, Facebook e o uso do site num lugar só">Redes sociais</Titulo>
      {erro && (
        <p className="mb-4 rounded-lg bg-rosa/10 px-3 py-2 text-sm text-rosa">
          {erro}
          {typeof sp.detalhe === "string" && <span className="ml-1 text-xs opacity-80">({sp.detalhe})</span>}
        </p>
      )}
      {sp.ligado && <p className="mb-4 rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">Pronto: Instagram e Facebook ligados ao sistema.{sp["sem-instagram"] ? " A página não tem Instagram comercial ligado, então só o Facebook aparece." : ""}</p>}
      {ligado ? <ContaLigada conexao={conexao!} /> : <SemConexao conexao={conexao} />}
      <div className="flex flex-wrap items-start gap-x-2">
        <EscolherPeriodo dias={dias} base="/redes" extra={rede ? { rede } : {}} />
        <span className="mx-1 mt-1.5 hidden h-5 w-px bg-stone-200 sm:block" />
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          {REDES.map((r) => {
            const p = new URLSearchParams();
            if (dias !== 30) p.set("dias", String(dias));
            if (r.chave) p.set("rede", r.chave);
            const q = p.toString();
            return <Link key={r.rotulo} href={q ? `/redes?${q}` : "/redes"} className={`rounded-full px-3 py-1.5 transition ${rede === r.chave ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-white"}`}>{r.rotulo}</Link>;
          })}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cartoes}</div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Bloco titulo="O que merece atenção" sub="Gerado automaticamente a partir dos números das redes e do site">
          <Insights itens={insights} />
        </Bloco>
        {ligado && (
          <Cartao>
            <h2 className="text-[15px] font-semibold text-stone-900">Contas ligadas</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
              <li>Facebook: <b className="font-medium">{conexao!.page_nome}</b></li>
              <li>Instagram: <b className="font-medium">{conexao!.ig_usuario ? `@${conexao!.ig_usuario}` : "não ligado à página"}</b></li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a href="/redes/conectar" className="text-sm font-medium text-violeta hover:underline">Ligar de novo ou trocar de página</a>
              <span className="text-stone-300">·</span>
              <BotaoExcluir acao={desligarRedes} titulo="Desligar o Instagram e o Facebook?" detalhe="Os números e as mensagens param de aparecer até ligar de novo." rotulo="Desligar" aviso="Desligado" />
            </div>
          </Cartao>
        )}
      </div>
    </>
  );
}

function postsNoPeriodo(ig: DadosInstagram | null, fb: DadosFacebook | null, dias: number) {
  const desde = Date.now() - dias * 86400000;
  return (ig?.publicacoes.filter((p) => Date.parse(p.em) >= desde).length ?? 0) + (fb?.publicacoes.filter((p) => Date.parse(p.em) >= desde).length ?? 0);
}

function gerarInsights(ig: DadosInstagram | null, fb: DadosFacebook | null, msgs: Conversa[] | null, site: Awaited<ReturnType<typeof carregarSite>> | null, dias: number): Insight[] {
  const lista: Insight[] = [];
  const esperando = msgs?.filter((c) => c.deles) ?? [];
  const antigas = esperando.filter((c) => Date.now() - Date.parse(c.em) > 86400000);
  if (antigas.length) lista.push({ nivel: "risco", titulo: `${antigas.length} ${antigas.length === 1 ? "pessoa espera" : "pessoas esperam"} resposta há mais de 1 dia`, detalhe: "Cliente que pergunta pelo direct costuma desistir rápido. Responda pelo Instagram ou Facebook.", href: "/redes/mensagens?filtro=esperando" });
  else if (esperando.length) lista.push({ nivel: "atencao", titulo: `${esperando.length} ${esperando.length === 1 ? "mensagem nova esperando" : "mensagens novas esperando"} resposta`, href: "/redes/mensagens?filtro=esperando" });

  if (ig) {
    const v = variacao(ig.totais.reach, ig.totaisAntes.reach);
    if (v !== null && v <= -20) lista.push({ nivel: "risco", titulo: `O alcance do Instagram caiu ${formatar(Math.abs(v), "pct")}`, detalhe: `Comparado com os ${dias} dias anteriores. Postar com mais frequência costuma ajudar.`, href: "/redes/instagram" });
    if (v !== null && v >= 20) lista.push({ nivel: "bom", titulo: `O alcance do Instagram subiu ${formatar(v, "pct")}`, detalhe: `Comparado com os ${dias} dias anteriores.`, href: "/redes/instagram" });
    const melhor = [...ig.publicacoes].sort((a, b) => b.interacoes - a.interacoes)[0];
    if (melhor) lista.push({ nivel: "info", titulo: `Post que mais rendeu: ${melhor.tipo.toLowerCase()} de ${new Date(melhor.em).toLocaleDateString("pt-BR")}`, detalhe: `${formatar(melhor.interacoes, "num")} interações${melhor.alcance ? ` e ${formatar(melhor.alcance, "num")} contas alcançadas` : ""}. ${melhor.legenda.slice(0, 80)}`, href: "/redes/instagram" });
    const tipos = ig.publicacoes.reduce<Record<string, number[]>>((acc, p) => ((acc[p.tipo] ??= []).push(p.interacoes), acc), {});
    const medias = Object.entries(tipos).filter(([, v2]) => v2.length >= 2).map(([t, v2]) => ({ t, m: soma(v2) / v2.length })).sort((a, b) => b.m - a.m);
    if (medias.length >= 2 && medias[0].m >= medias[1].m * 1.5) lista.push({ nivel: "bom", titulo: `${medias[0].t} rende ${formatar(medias[0].m / medias[1].m, "num")}x mais que ${medias[1].t.toLowerCase()}`, detalhe: "Pela média de interações das últimas publicações.", href: "/redes/instagram" });
    const ultimo = ig.publicacoes[0];
    const parado = ultimo ? Math.floor((Date.now() - Date.parse(ultimo.em)) / 86400000) : null;
    if (parado !== null && parado >= 7) lista.push({ nivel: "atencao", titulo: `${parado} dias sem post novo no Instagram`, detalhe: "Contas que postam toda semana aparecem mais para quem não segue." });
  }
  if (fb && !fb.publicacoes.some((p) => Date.parse(p.em) >= Date.now() - dias * 86400000)) lista.push({ nivel: "atencao", titulo: "Nenhum post no Facebook no período", href: "/redes/facebook" });

  if (!site) return lista;
  const diasComUso = Object.keys(site.acessosPorDia).length;
  if (diasComUso < dias / 3) lista.push({ nivel: "atencao", titulo: `O sistema foi usado em só ${diasComUso} de ${dias} dias`, detalhe: "Quanto mais a equipe lança no sistema, mais as análises ficam certas.", href: "/redes/site" });
  const quentes = site.propostas.filter((p) => p.aberturas >= 3);
  if (quentes.length) lista.push({ nivel: "bom", titulo: `${quentes.length} ${quentes.length === 1 ? "cliente abriu" : "clientes abriram"} a proposta 3 vezes ou mais`, detalhe: `Bom momento para ligar: ${quentes.slice(0, 3).map((p) => p.cliente).join(", ")}.`, href: "/redes/site" });
  return lista;
}
