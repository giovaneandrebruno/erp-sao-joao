import Link from "next/link";
import { connection } from "next/server";
import { Selo, Tabela, Titulo } from "@/components/ui";
import { dataHora } from "@/lib/format";
import { conexaoAtual, conversas, type Conversa } from "@/lib/redes";
import { ContaLigada, ErroDaMeta, SemConexao, haQuanto } from "../comum";

const FILTROS = [
  { chave: null, rotulo: "Todas" },
  { chave: "esperando", rotulo: "Esperando resposta" },
  { chave: "instagram", rotulo: "Instagram" },
  { chave: "messenger", rotulo: "Facebook" },
] as const;

export default async function MensagensPage({ searchParams }: PageProps<"/redes/mensagens">) {
  await connection();
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.chave === sp.filtro)?.chave ?? null;
  const conexao = await conexaoAtual();
  if (!conexao?.token) {
    return (
      <>
        <Titulo>Mensagens</Titulo>
        <SemConexao conexao={conexao} />
      </>
    );
  }
  const { lista, erros } = await conversas(conexao);
  const esperando = lista.filter((c) => c.deles).length;
  const mostrar = lista.filter((c: Conversa) => (filtro === "esperando" ? c.deles : filtro ? c.rede === filtro : true));
  const pilula = (ativo: boolean) => `rounded-full px-3 py-1.5 transition ${ativo ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-white"}`;

  return (
    <>
      <Titulo sub={esperando ? `${esperando} ${esperando === 1 ? "conversa esperando" : "conversas esperando"} resposta` : "Todas as conversas foram respondidas"}>Mensagens</Titulo>
      <ContaLigada conexao={conexao} />
      {erros.map((e) => <ErroDaMeta key={e} mensagem={e} />)}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {FILTROS.map((f) => (
          <Link key={f.rotulo} href={f.chave ? `/redes/mensagens?filtro=${f.chave}` : "/redes/mensagens"} className={pilula(filtro === f.chave)}>
            {f.rotulo}{f.chave === "esperando" && esperando ? ` (${esperando})` : ""}
          </Link>
        ))}
      </div>
      <Tabela cabecalho={["Quando", "Rede", "Pessoa", "Última mensagem", "Situação"]} vazio={!mostrar.length}>
        {mostrar.map((c) => (
          <tr key={c.id}>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="text-stone-800">{dataHora(c.em)}</div>
              <div className="text-xs text-stone-500">{haQuanto(c.em)}</div>
            </td>
            <td className="px-4 py-3">{c.rede === "instagram" ? "Instagram" : "Facebook"}</td>
            <td className="px-4 py-3">
              <Link href={`/redes/mensagens/${encodeURIComponent(c.id)}`} className="font-medium text-madeira-800 hover:underline">{c.nome}</Link>
            </td>
            <td className="max-w-md px-4 py-3">
              <div className="truncate text-stone-700">{c.deles ? "" : "Você: "}{c.ultima}</div>
            </td>
            <td className="px-4 py-3">{c.deles ? <Selo cor="amber">Esperando resposta</Selo> : <Selo cor="green">Respondida</Selo>}</td>
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 text-xs text-stone-500">Para responder, abra a conversa e use o botão que leva ao Instagram ou ao Facebook. As mensagens que chegam aparecem aqui ao abrir a tela.</p>
    </>
  );
}
