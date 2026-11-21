import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Selo, Tabela, Titulo, VerMais, estiloBotao, inputCls, quantidadeDaLista } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoExcluir } from "@/components/acoes";
import { dataHora } from "@/lib/format";
import { corDaIdade, haQuantoTempo } from "@/lib/curriculos";
import { FormCurriculo } from "./form";
import { excluirCurriculo } from "./actions";

/** Currículos recebidos, do mais novo para o mais antigo (pela data em que o arquivo foi salvo). */
export default async function CurriculosPage({ searchParams }: PageProps<"/curriculos">) {
  const sp = await searchParams;
  const termo = typeof sp.busca === "string" ? sp.busca.trim() : "";
  const qtd = quantidadeDaLista(sp.qtd);
  const supabase = await createClient();
  let consulta = supabase
    .from("curriculos")
    .select("id, nome, vaga, telefone, email, nome_arquivo, enviado_por_nome, criado_em, curriculo_anotacoes(count)", { count: "exact" })
    .order("criado_em", { ascending: false })
    .limit(qtd);
  const seguro = termo.replace(/[,()%*"\\]/g, " ").trim();
  if (seguro) consulta = consulta.or([`nome.ilike.%${seguro}%`, `vaga.ilike.%${seguro}%`, `telefone.ilike.%${seguro}%`, `email.ilike.%${seguro}%`].join(","));
  const { data: curriculos, count } = await consulta;

  return (
    <>
      <Titulo
        sub="Do mais novo para o mais antigo, pela data em que o arquivo foi salvo."
        acao={
          <JanelaBotao rotulo="Receber currículo" titulo="Receber currículo" largura="md" aviso={null}>
            <FormCurriculo />
          </JanelaBotao>
        }
      >
        Currículos
      </Titulo>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="busca" defaultValue={termo} placeholder="Buscar por nome, vaga, telefone ou e-mail" className={`${inputCls} w-full max-w-md`} />
        <button className={estiloBotao.secundario}>Filtrar</button>
      </form>
      <Tabela cabecalho={["Recebido em", "Nome", "Vaga / função", "Telefone", "Anotações", ""]} vazio={!curriculos?.length}>
        {curriculos?.map((c) => {
          const notas = (c.curriculo_anotacoes as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
          return (
            <tr key={c.id}>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="text-stone-800">{dataHora(c.criado_em)}</div>
                <div className="mt-1"><Selo cor={corDaIdade(c.criado_em)}>{haQuantoTempo(c.criado_em)}</Selo></div>
              </td>
              <td className="px-4 py-3">
                <Link href={`/curriculos/${c.id}`} className="font-medium text-madeira-800 hover:underline">{c.nome}</Link>
                <div className="mt-0.5 truncate text-xs text-stone-500">{c.nome_arquivo}</div>
              </td>
              <td className="px-4 py-3">{c.vaga ?? "—"}</td>
              <td className="px-4 py-3">{c.telefone ?? "—"}</td>
              <td className="px-4 py-3">{notas ? `${notas} anotaç${notas === 1 ? "ão" : "ões"}` : <span className="text-stone-400">Nenhuma</span>}</td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <Link href={`/curriculos/${c.id}`} className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Ver</Link>
                  <BotaoExcluir
                    acao={excluirCurriculo.bind(null, c.id)}
                    titulo="Excluir este currículo?"
                    detalhe={<><strong>{c.nome}</strong>. O arquivo e as anotações também são apagados.</>}
                    aviso="Currículo excluído"
                  />
                </AcoesLinha>
              </td>
            </tr>
          );
        })}
      </Tabela>
      <VerMais mostrando={curriculos?.length ?? 0} total={count} rotulo="currículos" parametros={sp} />
    </>
  );
}
