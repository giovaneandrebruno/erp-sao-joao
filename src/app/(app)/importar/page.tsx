import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { Cartao, Selo, Tabela, Titulo } from "@/components/ui";
import { Importador, LimparConteudo } from "@/components/importador";
import { LISTA_AREAS, AREAS, type Area } from "@/lib/importacao";
import { BaixarArquivo } from "./baixar";

export const maxDuration = 60;

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function ImportarPage() {
  const perfil = await perfilAtual();
  const supabase = await createClient();
  const areas = LISTA_AREAS.filter((a) => a.area !== "financeiro" || perfil?.papel === "admin");

  const [contagens, { data: historico }] = await Promise.all([
    Promise.all(areas.map(async (a) => {
      const { count } = await supabase.from(a.tabela).select("id", { count: "exact", head: true }).not("importacao_id", "is", null);
      return count ?? 0;
    })),
    supabase.from("importacoes").select("id, area, arquivo_nome, arquivo_caminho, modo, linhas_lidas, inseridos, atualizados, removidos, avisos, criado_em").order("criado_em", { ascending: false }).limit(60),
  ]);

  return (
    <>
      <Titulo sub="Envie planilhas, PDFs, fotos de documentos ou qualquer arquivo de referência. O sistema lê, mostra como vai ficar e só grava depois que você confirmar.">
        Importar arquivos
      </Titulo>

      <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((a, i) => (
          <Cartao key={a.area} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={a.caminho} className="font-semibold text-stone-900 hover:text-violeta">{a.titulo}</Link>
                <p className="mt-1 text-xs text-stone-500">{a.explicacao}</p>
              </div>
              <span className="whitespace-nowrap font-mono text-2xl font-semibold texto-gradiente">{contagens[i]}</span>
            </div>
            <p className="text-xs text-stone-400">registro(s) vindos de arquivos</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Importador area={a.area} rotulo="Enviar arquivo" />
              <LimparConteudo area={a.area} />
            </div>
          </Cartao>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-stone-900">Arquivos enviados</h2>
      <Tabela cabecalho={["Quando", "Área", "Arquivo", "Resultado"]} vazio={!historico?.length}>
        {historico?.filter((h) => areas.some((a) => a.area === h.area)).map((h) => (
          <tr key={h.id}>
            <td className="whitespace-nowrap py-3 text-stone-500">{quando(h.criado_em)}</td>
            <td className="py-3">{AREAS[h.area as Area]?.titulo ?? h.area}</td>
            <td className="py-3">{h.arquivo_caminho ? <BaixarArquivo caminho={h.arquivo_caminho} nome={h.arquivo_nome} /> : h.arquivo_nome}</td>
            <td className="py-3">
              {h.modo === "arquivo" ? (
                <Selo>guardado como referência</Selo>
              ) : (
                <span className="flex flex-wrap gap-1.5">
                  <Selo cor="green">{h.inseridos} novos</Selo>
                  <Selo cor="amber">{h.atualizados} atualizados</Selo>
                  {h.removidos > 0 && <Selo cor="red">{h.removidos} removidos</Selo>}
                  {h.avisos?.length > 0 && <span className="text-xs text-stone-400" title={h.avisos.join("\n")}>{h.avisos.length} aviso(s)</span>}
                </span>
              )}
            </td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
