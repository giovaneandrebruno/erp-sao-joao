import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Titulo } from "@/components/ui";
import { JanelaEditar } from "@/components/acoes";
import { hojeISO } from "@/lib/format";
import { pessoasDoTexto, type Acao } from "@/lib/reunioes";
import { FormAcao, ListaDePessoas, TabelaDeAcoes } from "../componentes";
import { nomesDaEquipe } from "../dados";

/** Todas as ações em aberto, de todas as reuniões, com filtro por responsável e só atrasadas. */
export default async function AcoesEmAbertoPage({ searchParams }: PageProps<"/reunioes/acoes">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ data: brutas }, { data: reunioes }, nomes] = await Promise.all([
    supabase.from("reuniao_acoes").select("*").neq("situacao", "ok").order("prazo", { ascending: true, nullsFirst: false }).limit(5000),
    supabase.from("reunioes").select("id, numero, data").limit(2000),
    nomesDaEquipe(),
  ]);
  const todas = (brutas ?? []) as Acao[];
  const mapa = new Map((reunioes ?? []).map((r) => [r.id, r]));
  const pessoas = [...new Set(todas.flatMap((a) => pessoasDoTexto(a.responsavel)).map((p) => p.toUpperCase()))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const quem = typeof sp.responsavel === "string" ? sp.responsavel : "";
  const soAtrasadas = sp.ver === "atrasadas";
  const lista = todas
    .filter((a) => !quem || pessoasDoTexto(a.responsavel).some((p) => p.toUpperCase() === quem))
    .filter((a) => !soAtrasadas || (a.prazo && a.prazo < hoje));
  const emEdicao = typeof sp.acao === "string" ? todas.find((a) => a.id === sp.acao) : undefined;

  const filtro = (rotulo: string, params: Record<string, string>, ativo: boolean) => (
    <Link
      key={rotulo}
      href={`/reunioes/acoes${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`}
      className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset transition ${ativo ? "bg-marinho text-white ring-marinho" : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300"}`}
    >
      {rotulo}
    </Link>
  );
  const base: Record<string, string> = soAtrasadas ? { ver: "atrasadas" } : {};

  return (
    <>
      <Titulo sub="Tudo que ainda não foi resolvido, de todas as reuniões. As com prazo mais perto aparecem primeiro.">Ações em aberto</Titulo>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filtro("Todas", quem ? { responsavel: quem } : {}, !soAtrasadas)}
        {filtro("Só atrasadas", { ...(quem ? { responsavel: quem } : {}), ver: "atrasadas" }, soAtrasadas)}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-stone-500">Responsável:</span>
        {filtro("Todos", base, !quem)}
        {pessoas.map((p) => filtro(p.charAt(0) + p.slice(1).toLowerCase(), { ...base, responsavel: p }, quem === p))}
      </div>
      <ListaDePessoas id="pessoas-reuniao" nomes={[...nomes, ...todas.map((a) => a.responsavel ?? "")].filter(Boolean)} />
      <TabelaDeAcoes acoes={lista} hoje={hoje} reunioes={mapa} mostrarOrigem vazio="Nenhuma ação em aberto." />
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} param="acao" titulo="Alterar ação" aviso="Ação salva">
          <FormAcao reuniaoId={emEdicao.reuniao_id} a={emEdicao} listaPessoas="pessoas-reuniao" />
        </JanelaEditar>
      )}
    </>
  );
}
