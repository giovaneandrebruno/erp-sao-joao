import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Indicador, Selo, Tabela, Titulo } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { data, hojeISO } from "@/lib/format";
import { TIPOS_REUNIAO, ordinal, type Reuniao } from "@/lib/reunioes";
import { FormReuniao } from "./componentes";

/** Lista das reuniões (atas), da mais nova para a mais antiga. */
export default async function ReunioesPage({ searchParams }: PageProps<"/reunioes">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ data: brutas }, { data: acoes }] = await Promise.all([
    supabase.from("reunioes").select("*").order("data", { ascending: false }).order("numero", { ascending: false }).limit(500),
    supabase.from("reuniao_acoes").select("reuniao_id, situacao, prazo").limit(20000),
  ]);
  const reunioes = (brutas ?? []) as Reuniao[];
  const lista = acoes ?? [];
  const abertas = lista.filter((a) => a.situacao !== "ok");
  const atrasadas = abertas.filter((a) => a.prazo && a.prazo < hoje);
  const pendentes = abertas.filter((a) => a.situacao === "pendente");

  return (
    <>
      <Titulo
        sub="Cada reunião guarda o que foi combinado, com responsável, prazo e situação. O que não for resolvido passa sozinho para a reunião seguinte."
        acao={
          <JanelaBotao rotulo="Nova reunião" titulo="Nova reunião" largura="lg" aviso="Reunião criada" abrirAoCarregar={sp.novo === "1"}>
            <FormReuniao />
          </JanelaBotao>
        }
      >
        Reuniões
      </Titulo>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Link href="/reunioes/acoes"><Indicador rotulo="Ações em aberto" valor={abertas.length} sub="de todas as reuniões" /></Link>
        <Link href="/reunioes/acoes?ver=atrasadas"><Indicador rotulo="Atrasadas" valor={atrasadas.length} cor={atrasadas.length ? "vermelho" : undefined} sub="passaram do prazo" /></Link>
        <Link href="/reunioes/acoes"><Indicador rotulo="Pendentes" valor={pendentes.length} sub="vieram de reuniões anteriores" /></Link>
      </div>

      <Tabela cabecalho={["Nº", "Data", "Tipo", "Assunto", "Participantes", "Ações", ""]} vazio={!reunioes.length}>
        {reunioes.map((r) => {
          const minhas = lista.filter((a) => a.reuniao_id === r.id);
          const ok = minhas.filter((a) => a.situacao === "ok").length;
          return (
            <tr key={r.id}>
              <td className="px-4 py-3 font-mono font-medium">{ordinal(r.numero)}</td>
              <td className="whitespace-nowrap px-4 py-3">{data(r.data)}</td>
              <td className="px-4 py-3"><Selo cor={r.tipo === "pre" ? "blue" : r.tipo === "pos" ? "green" : "stone"}>{TIPOS_REUNIAO[r.tipo]}</Selo></td>
              <td className="px-4 py-3">
                <Link href={`/reunioes/${r.id}`} className="font-medium text-madeira-800 hover:underline">{r.assunto || "Reunião da diretoria"}</Link>
              </td>
              <td className="px-4 py-3 text-stone-600">{r.participantes ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3">{minhas.length ? <>{minhas.length} nova(s) · {ok} ok</> : <span className="text-stone-400">nenhuma</span>}</td>
              <td className="px-4 py-2 text-right"><Link href={`/reunioes/${r.id}`} className="text-sm font-medium text-madeira-700 hover:underline">Abrir ata</Link></td>
            </tr>
          );
        })}
      </Tabela>
    </>
  );
}
