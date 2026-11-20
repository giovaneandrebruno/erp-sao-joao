import { createClient } from "@/lib/supabase/server";
import { Titulo } from "@/components/ui";
import { Calculadora } from "./calculadora";

/** Calcula chapas, fita de borda e ferragens a partir das peças do projeto e reserva no pedido. */
export default async function CalcularPage({ searchParams }: PageProps<"/estoque/calcular">) {
  const { pedido } = await searchParams;
  const supabase = await createClient();
  const [{ data: pedidos }, { data: produtos }] = await Promise.all([
    supabase.from("pedidos").select("id, numero, status, cliente:cliente_id(nome)").in("status", ["aberto", "em_producao"]).order("numero", { ascending: false }).limit(300),
    supabase.from("produtos_saldo").select("id, codigo, nome, unidade_medida, categoria, livre, custo").eq("ativo", true).neq("tipo", "servico").order("nome"),
  ]);
  const { data: medidas } = await supabase.from("produtos").select("id, chapa_largura_mm, chapa_altura_mm").eq("categoria", "chapa");
  const medida = new Map((medidas ?? []).map((m) => [m.id, m]));

  return (
    <>
      <Titulo sub="Informe as peças do projeto (medida, quantidade, chapa e lados com fita). O sistema calcula quantas chapas, quantos metros de fita e quais ferragens o pedido precisa, e reserva no estoque.">
        Calcular material do pedido
      </Titulo>
      <Calculadora
        pedidoInicial={typeof pedido === "string" ? pedido : ""}
        pedidos={((pedidos ?? []) as unknown as { id: string; numero: number; cliente: { nome: string } | null }[]).map((p) => ({ id: p.id, rotulo: `#${p.numero} · ${p.cliente?.nome ?? ""}` }))}
        produtos={(produtos ?? []).map((p) => ({
          id: p.id as string,
          nome: `${p.nome}${p.codigo ? ` (${p.codigo})` : ""}`,
          un: p.unidade_medida as string,
          categoria: p.categoria as string,
          livre: Number(p.livre),
          custo: Number(p.custo),
          largura: medida.get(p.id)?.chapa_largura_mm ?? null,
          altura: medida.get(p.id)?.chapa_altura_mm ?? null,
        }))}
      />
    </>
  );
}
