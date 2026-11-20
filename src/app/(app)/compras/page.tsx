import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Cartao, Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { brl, linkWhats } from "@/lib/format";
import { Copiar } from "@/components/copiar";
import { arred, qtd } from "@/lib/estoque";
import { compraDaLista, cotacaoDaLista } from "./actions";

type Linha = {
  id: string; codigo: string | null; nome: string; unidade_medida: string; custo: number;
  estoque_atual: number; estoque_minimo: number; reservado: number; livre: number; a_caminho: number; fornecedor_id: string | null;
};

/**
 * O que comprar: o que falta para os pedidos em aberto (reservado maior que o estoque) e o que
 * ficou abaixo do mínimo, descontando o que já foi comprado e está a caminho. Separado por fornecedor.
 */
export default async function ComprasPage() {
  await connection();
  const supabase = await createClient();
  const [{ data: produtos }, { data: fornecedores }, { data: cfg }, { count: requisicoes }] = await Promise.all([
    supabase.from("produtos_saldo").select("id, codigo, nome, unidade_medida, custo, estoque_atual, estoque_minimo, reservado, livre, a_caminho, fornecedor_id").eq("ativo", true).neq("tipo", "servico").order("nome"),
    supabase.from("fornecedores").select("id, nome, telefone, contato").order("nome"),
    supabase.from("configuracoes").select("nome_fantasia").single(),
    supabase.from("requisicoes_compra").select("id", { count: "exact", head: true }).eq("status", "aberta"),
  ]);

  const comprar = ((produtos ?? []) as Linha[])
    .map((p) => {
      const caminho = Number(p.a_caminho);
      const previsto = Number(p.livre) + caminho;
      const paraPedidos = Math.max(0, -previsto);
      const paraMinimo = Math.max(0, Number(p.estoque_minimo) - Math.max(0, previsto));
      return { ...p, paraPedidos: arred(paraPedidos), quantidade: arred(paraPedidos + paraMinimo) };
    })
    .filter((p) => p.quantidade > 0);

  const grupos = new Map<string, typeof comprar>();
  for (const p of comprar) {
    const chave = p.fornecedor_id ?? "";
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }
  const ordenados = [...grupos.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
  const total = comprar.reduce((s, p) => s + p.quantidade * Number(p.custo), 0);
  const urgentes = comprar.filter((p) => p.paraPedidos > 0).length;

  return (
    <>
      <Titulo sub="O que falta para os pedidos em aberto e o que ficou abaixo do estoque mínimo, já descontando o que foi comprado e está a caminho. Marque os itens e gere o pedido de compra ou peça cotação.">
        O que comprar
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Itens para comprar" valor={comprar.length} />
        <Indicador rotulo="Faltam para pedidos" valor={urgentes} cor={urgentes ? "vermelho" : undefined} sub="Pedidos esperando material" />
        <Indicador rotulo="Valor estimado" valor={brl(total)} sub="Pelo custo médio" />
        <Indicador rotulo="Requisições abertas" valor={requisicoes ?? 0} sub={<Link href="/compras/requisicoes" className="underline">Ver requisições</Link>} />
      </div>

      {!comprar.length && <Cartao><p className="text-center text-sm text-stone-400">Nada para comprar agora. O estoque e as compras a caminho cobrem os pedidos em aberto e o mínimo de cada item.</p></Cartao>}

      <div className="flex flex-col gap-8">
        {ordenados.map(([fid, itens]) => {
          const f = fornecedores?.find((x) => x.id === fid);
          const texto = [
            `Olá${f?.contato ? `, ${f.contato.split(" ")[0]}` : ""}! Aqui é da ${cfg?.nome_fantasia ?? "marcenaria"}. Gostaria de um orçamento para:`,
            ...itens.map((p) => `• ${qtd(p.quantidade, p.unidade_medida)} de ${p.nome}${p.codigo ? ` (${p.codigo})` : ""}`),
            "Obrigado!",
          ].join("\n");
          const whats = linkWhats(f?.telefone, texto);
          return (
            <form key={fid || "sem"} action={fid ? compraDaLista.bind(null, fid) : cotacaoDaLista}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{f?.nome ?? "Sem fornecedor no cadastro"}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Copiar texto={texto} rotulo="Copiar lista" />
                  {whats && <a href={whats} target="_blank" rel="noreferrer" className="rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white">Pedir no WhatsApp</a>}
                  <Botao type="submit" variante="secundario" formAction={cotacaoDaLista}>Pedir cotação</Botao>
                  {fid && <Botao type="submit">Gerar pedido de compra</Botao>}
                </div>
              </div>
              <Tabela cabecalho={["", "Material", "Em estoque", "Reservado", "A caminho", "Mínimo", "Comprar", "Custo estimado"]}>
                {itens.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3"><input type="checkbox" name={`m:${p.id}`} defaultChecked aria-label={`Incluir ${p.nome}`} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/estoque/${p.id}`} className="font-medium text-madeira-800 hover:underline">{p.nome}</Link>
                      {p.paraPedidos > 0 && <span className="ml-2"><Selo cor="red">falta para pedidos</Selo></span>}
                    </td>
                    <td className="px-4 py-3">{qtd(p.estoque_atual, p.unidade_medida)}</td>
                    <td className="px-4 py-3">{Number(p.reservado) ? qtd(p.reservado) : "—"}</td>
                    <td className="px-4 py-3">{Number(p.a_caminho) ? qtd(p.a_caminho) : "—"}</td>
                    <td className="px-4 py-3">{qtd(p.estoque_minimo)}</td>
                    <td className="px-4 py-2"><input name={`q:${p.id}`} defaultValue={String(p.quantidade).replace(".", ",")} inputMode="decimal" className={`${inputCls} w-24`} /> <span className="text-xs text-stone-500">{p.unidade_medida}</span></td>
                    <td className="px-4 py-3">{brl(p.quantidade * Number(p.custo))}</td>
                  </tr>
                ))}
              </Tabela>
              {!fid && <p className="mt-2 text-xs text-stone-500">Escolha o fornecedor principal no cadastro de cada produto para ele aparecer no grupo certo. Estes itens podem ir para uma cotação.</p>}
            </form>
          );
        })}
      </div>
    </>
  );
}
