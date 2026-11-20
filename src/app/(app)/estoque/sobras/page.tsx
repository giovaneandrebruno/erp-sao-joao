import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Indicador, Tabela, Titulo, inputCls } from "@/components/ui";
import { data } from "@/lib/format";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoExcluir } from "@/components/acoes";
import { excluirSobra, salvarSobra, usarSobra } from "./actions";

/** Sobras de chapa (retalhos) com medida, para reaproveitar em pedidos pequenos. */
export default async function SobrasPage({ searchParams }: PageProps<"/estoque/sobras">) {
  const sp = await searchParams;
  const usadas = sp.ver === "usadas";
  const termo = typeof sp.busca === "string" ? sp.busca.trim() : "";
  const minL = Number(typeof sp.largura === "string" ? sp.largura : 0) || 0;
  const minA = Number(typeof sp.altura === "string" ? sp.altura : 0) || 0;
  const supabase = await createClient();
  let consulta = supabase.from("retalhos").select("*, usado:usado_pedido_id(numero)").order("criado_em", { ascending: false }).limit(500);
  consulta = usadas ? consulta.not("usado_em", "is", null) : consulta.is("usado_em", null);
  if (termo) consulta = consulta.ilike("material", `%${termo}%`);
  const [{ data: sobras }, { data: chapas }, { data: pedidos }] = await Promise.all([
    consulta,
    supabase.from("produtos").select("id, nome").eq("ativo", true).eq("tipo", "materia_prima").order("nome"),
    supabase.from("pedidos").select("id, numero, clientes(nome)").in("status", ["aberto", "em_producao", "pronto"]).order("numero", { ascending: false }).limit(200),
  ]);
  // serve se couber nas medidas pedidas, de pé ou deitada
  const lista = (sobras ?? []).filter((r) => (!minL && !minA) || (r.largura_mm >= minL && r.altura_mm >= minA) || (r.largura_mm >= minA && r.altura_mm >= minL));
  const pecas = lista.reduce((s, r) => s + Number(r.quantidade), 0);
  const area = lista.reduce((s, r) => s + (r.largura_mm * r.altura_mm * r.quantidade) / 1_000_000, 0);

  return (
    <>
      <Titulo
        sub="Sobras de chapa com medida. Antes de cortar uma chapa nova para uma peça pequena, procure aqui."
        acao={
          <JanelaBotao rotulo="Nova sobra" titulo="Guardar sobra de chapa" largura="xl">
            <form action={salvarSobra.bind(null, null)} className="grid gap-3 md:grid-cols-12">
              <Campo rotulo="Chapa do estoque" className="md:col-span-4">
                <select name="produto_id" defaultValue="" className={inputCls}>
                  <option value="">— escolha ou escreva ao lado —</option>
                  {chapas?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Material / cor" className="md:col-span-4">
                <input name="material" placeholder="MDF branco TX 18 mm" className={inputCls} />
              </Campo>
              <Campo rotulo="Largura (mm) *" className="md:col-span-2"><input name="largura_mm" required inputMode="numeric" className={inputCls} /></Campo>
              <Campo rotulo="Altura (mm) *" className="md:col-span-2"><input name="altura_mm" required inputMode="numeric" className={inputCls} /></Campo>
              <Campo rotulo="Quantidade" className="md:col-span-2"><input name="quantidade" type="number" min={1} defaultValue={1} className={inputCls} /></Campo>
              <Campo rotulo="Onde está" className="md:col-span-3"><input name="local" placeholder="Prateleira 2, fundo da fábrica" className={inputCls} /></Campo>
              <Campo rotulo="Observação" className="md:col-span-5"><input name="observacoes" className={inputCls} /></Campo>
              <div className="flex items-end md:col-span-2"><Botao type="submit">Guardar</Botao></div>
            </form>
          </JanelaBotao>
        }
      >
        Sobras de chapa
      </Titulo>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Indicador rotulo={usadas ? "Sobras usadas" : "Peças guardadas"} valor={pecas} />
        <Indicador rotulo="Área somada" valor={`${area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`} />
      </div>

      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/estoque/sobras" className={!usadas ? "font-semibold text-madeira-800" : "text-stone-500"}>Disponíveis</Link>
        <Link href="/estoque/sobras?ver=usadas" className={usadas ? "font-semibold text-madeira-800" : "text-stone-500"}>Já usadas</Link>
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        {usadas && <input type="hidden" name="ver" value="usadas" />}
        <input name="busca" defaultValue={termo} placeholder="Material ou cor" className={`${inputCls} w-full max-w-xs`} />
        <input name="largura" defaultValue={minL || ""} placeholder="Peça: largura mm" inputMode="numeric" className={`${inputCls} w-40`} />
        <input name="altura" defaultValue={minA || ""} placeholder="Peça: altura mm" inputMode="numeric" className={`${inputCls} w-40`} />
        <button className="rounded-lg bg-marinho px-3 py-2 text-sm font-semibold text-white hover:bg-marinho-claro">Procurar</button>
      </form>

      <Tabela cabecalho={["Material", "Medida (mm)", "Qtd", "Onde está", usadas ? "Usada em" : "Guardada em", ""]} vazio={!lista.length}>
        {lista.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3">
              <span className="font-medium">{r.material}</span>
              {r.observacoes && <span className="block text-xs text-stone-500">{r.observacoes}</span>}
            </td>
            <td className="px-4 py-3 font-mono">{r.largura_mm} × {r.altura_mm}</td>
            <td className="px-4 py-3">{r.quantidade}</td>
            <td className="px-4 py-3">{r.local ?? "—"}</td>
            <td className="px-4 py-3">
              {usadas ? <>{data(r.usado_em)}{(r.usado as { numero: number } | null)?.numero ? ` · pedido #${(r.usado as { numero: number }).numero}` : ""}</> : data(r.criado_em)}
            </td>
            <td className="px-4 py-3">
              <AcoesLinha>
                {!usadas && (
                  <JanelaBotao rotulo="Usar" titulo="Usar esta sobra" descricao={`${r.material} · ${r.largura_mm} × ${r.altura_mm} mm`} variante="link" icone={null} largura="sm" aviso="Sobra marcada como usada">
                    <form action={usarSobra.bind(null, r.id)} className="flex flex-col gap-3">
                      <Campo rotulo="Para qual pedido (opcional)">
                        <select name="usado_pedido_id" defaultValue="" className={inputCls}>
                          <option value="">—</option>
                          {pedidos?.map((p) => <option key={p.id} value={p.id}>#{p.numero} {(p.clientes as unknown as { nome: string } | null)?.nome ?? ""}</option>)}
                        </select>
                      </Campo>
                      <div><Botao type="submit">Marcar como usada</Botao></div>
                    </form>
                  </JanelaBotao>
                )}
                <BotaoExcluir acao={excluirSobra.bind(null, r.id)} titulo="Excluir esta sobra?" detalhe={<strong>{r.material} · {r.largura_mm} × {r.altura_mm} mm</strong>} aviso="Sobra excluída" />
              </AcoesLinha>
            </td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
