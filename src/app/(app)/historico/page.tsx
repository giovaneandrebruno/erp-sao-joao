import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Selo, Titulo, VerMais, inputCls, quantidadeDaLista } from "@/components/ui";
import { dataHora } from "@/lib/format";
import { nomeDoAssunto } from "@/lib/copia";

type Registro = {
  id: number;
  em: string;
  usuario_nome: string | null;
  tabela: string;
  registro_id: string | null;
  acao: "criou" | "alterou" | "excluiu";
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

const COR = { criou: "green", alterou: "blue", excluiu: "red" } as const;
const OCULTOS = new Set(["id", "criado_em", "atualizado_em", "importacao_id", "chave_importacao", "token", "extras"]);

/** Nome que identifica o registro (cliente, pedido nº, produto...). */
function identificar(r: Registro) {
  const d = { ...(r.antes ?? {}), ...(r.depois ?? {}) };
  for (const k of ["nome", "titulo", "descricao", "cliente", "os"]) if (d[k]) return String(d[k]);
  if (d.numero) return `nº ${d.numero}`;
  return r.registro_id ? `registro ${r.registro_id.slice(0, 8)}` : "";
}

const rotuloCampo = (k: string) => k.replace(/_id$/, "").replace(/_/g, " ");
function valor(v: unknown) {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  const t = typeof v === "object" ? JSON.stringify(v) : String(v);
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

export default async function HistoricoPage({ searchParams }: PageProps<"/historico">) {
  await connection();
  const sp = await searchParams;
  const qtd = quantidadeDaLista(sp.qtd);
  const tabela = typeof sp.assunto === "string" && sp.assunto ? sp.assunto : null;
  const acao = typeof sp.acao === "string" && ["criou", "alterou", "excluiu"].includes(sp.acao) ? sp.acao : null;

  const supabase = await createClient();
  let consulta = supabase.from("auditoria").select("*", { count: "exact" }).order("em", { ascending: false }).limit(qtd);
  if (tabela) consulta = consulta.eq("tabela", tabela);
  if (acao) consulta = consulta.eq("acao", acao);
  const { data, count } = await consulta;
  const registros = (data ?? []) as Registro[];

  const assuntos = ["clientes", "fornecedores", "parceiros", "negociacoes", "orcamentos", "orcamento_itens", "pedidos", "pedido_itens", "pedido_marcos", "ordens_producao", "produtos", "lancamentos", "chamados", "configuracoes", "perfis"];

  return (
    <>
      <Titulo sub="Quem criou, mudou ou excluiu cada coisa no sistema">Histórico de alterações</Titulo>
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <select name="assunto" defaultValue={tabela ?? ""} className={inputCls}>
          <option value="">Todos os assuntos</option>
          {assuntos.map((a) => <option key={a} value={a}>{nomeDoAssunto(a)}</option>)}
        </select>
        <select name="acao" defaultValue={acao ?? ""} className={inputCls}>
          <option value="">Todas as ações</option>
          <option value="criou">Criou</option>
          <option value="alterou">Alterou</option>
          <option value="excluiu">Excluiu</option>
        </select>
        <button type="submit" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50">Filtrar</button>
      </form>

      <Cartao>
        {registros.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {registros.map((r) => {
              const campos = Object.keys(r.acao === "excluiu" ? r.antes ?? {} : r.depois ?? {}).filter((k) => !OCULTOS.has(k));
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-xs text-stone-500">{dataHora(r.em)}</span>
                    <strong>{r.usuario_nome ?? "—"}</strong>
                    <Selo cor={COR[r.acao]}>{r.acao}</Selo>
                    <span className="text-stone-600">{nomeDoAssunto(r.tabela)}</span>
                    <span className="text-stone-900">{identificar(r)}</span>
                  </div>
                  {r.acao === "alterou" && campos.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 pl-1 text-xs text-stone-600">
                      {campos.slice(0, 8).map((k) => (
                        <li key={k}>
                          <span className="font-medium text-stone-800">{rotuloCampo(k)}:</span>{" "}
                          <span className="line-through decoration-stone-300">{valor(r.antes?.[k])}</span> → <span>{valor(r.depois?.[k])}</span>
                        </li>
                      ))}
                      {campos.length > 8 && <li className="text-stone-400">e mais {campos.length - 8} campos</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-stone-400">Nenhuma alteração registrada ainda. A partir de agora, tudo o que for criado, mudado ou excluído aparece aqui.</p>
        )}
      </Cartao>
      <VerMais mostrando={registros.length} total={count} rotulo="alterações" parametros={sp} />
    </>
  );
}
