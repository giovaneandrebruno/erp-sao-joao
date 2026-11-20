import Link from "next/link";
import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { brl } from "@/lib/format";
import { CATEGORIAS, CATEGORIA_CURTA, qtd, type Categoria } from "@/lib/estoque";

type Linha = {
  id: string; codigo: string | null; nome: string; tipo: string; unidade_medida: string; custo: number; preco_venda: number;
  estoque_atual: number; estoque_minimo: number; ativo: boolean; reservado: number; livre: number; categoria: Categoria; local: string | null; a_caminho: number;
};

/** Saldo do estoque: quanto tem, quanto está reservado para pedidos, quanto está livre e quanto já foi comprado. */
export default async function EstoquePage({ searchParams }: PageProps<"/estoque">) {
  const sp = await searchParams;
  const filtro = typeof sp.ver === "string" ? sp.ver : sp.baixo ? "baixo" : "todos";
  const categoria = typeof sp.categoria === "string" && sp.categoria in CATEGORIAS ? (sp.categoria as Categoria) : null;
  const busca = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const supabase = await createClient();
  const { data: produtos } = await supabase
    .from("produtos_saldo")
    .select("id, codigo, nome, tipo, unidade_medida, custo, preco_venda, estoque_atual, estoque_minimo, ativo, reservado, livre, categoria, local, a_caminho")
    .order("nome");
  const todos = (produtos ?? []) as Linha[];
  const fisicos = todos.filter((p) => p.tipo !== "servico" && p.ativo);
  const repor = (p: Linha) => p.tipo !== "servico" && p.ativo && Number(p.livre) <= Number(p.estoque_minimo) && (Number(p.estoque_minimo) > 0 || Number(p.livre) < 0);

  const lista = todos.filter((p) => {
    if (filtro === "baixo" && !repor(p)) return false;
    if (filtro === "reservado" && !(Number(p.reservado) > 0)) return false;
    if (filtro === "caminho" && !(Number(p.a_caminho) > 0)) return false;
    if (filtro === "inativos" ? p.ativo : !p.ativo && filtro !== "todos") return false;
    if (categoria && p.categoria !== categoria) return false;
    if (busca && !`${p.nome} ${p.codigo ?? ""} ${p.local ?? ""}`.toLowerCase().includes(busca)) return false;
    return true;
  });

  const valorEstoque = fisicos.reduce((s, p) => s + Math.max(0, Number(p.estoque_atual)) * Number(p.custo), 0);
  const valorReservado = fisicos.reduce((s, p) => s + Number(p.reservado) * Number(p.custo), 0);
  const abaixo = fisicos.filter(repor).length;

  const link = (ver: string) => {
    const q = new URLSearchParams();
    if (ver !== "todos") q.set("ver", ver);
    if (categoria) q.set("categoria", categoria);
    if (busca) q.set("q", busca);
    return `/estoque${q.size ? `?${q}` : ""}`;
  };
  const filtros: [string, string][] = [["todos", "Todos"], ["baixo", "Abaixo do mínimo"], ["reservado", "Com reserva"], ["caminho", "Com compra a caminho"], ["inativos", "Inativos"]];

  return (
    <>
      <Titulo
        sub="Quanto tem de cada material, quanto já está separado para pedidos e quanto está livre para usar."
        acao={<FerramentasImportacao area="estoque" extra={<BotaoLink href="/estoque/novo">Novo produto</BotaoLink>} />}
      >
        Saldo do estoque
      </Titulo>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Itens cadastrados" valor={fisicos.length} sub="Materiais e produtos ativos" />
        <Indicador rotulo="Valor em estoque" valor={brl(valorEstoque)} sub="Pelo custo médio" />
        <Indicador rotulo="Reservado para pedidos" valor={brl(valorReservado)} sub="Material já separado" />
        <Indicador rotulo="Abaixo do mínimo" valor={abaixo} cor={abaixo ? "vermelho" : undefined} sub={abaixo ? <Link href="/compras" className="underline">Ver o que comprar</Link> : "Tudo em dia"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {filtros.map(([k, r]) => (
          <Link key={k} href={link(k)} className={filtro === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
        ))}
        <form className="ml-auto flex flex-wrap gap-2">
          {filtro !== "todos" && <input type="hidden" name="ver" value={filtro} />}
          <select name="categoria" defaultValue={categoria ?? ""} className={inputCls}>
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORIAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          <input name="q" defaultValue={busca} placeholder="Procurar nome, código ou local" className={inputCls} />
          <button className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Filtrar</button>
        </form>
      </div>

      <Tabela cabecalho={["Código", "Nome", "Categoria", "Local", "Estoque", "Reservado", "Livre", "A caminho", "Mínimo", "Custo médio"]} vazio={!lista.length}>
        {lista.map((p) => {
          const servico = p.tipo === "servico";
          const alerta = repor(p);
          return (
            <tr key={p.id} className={`hover:bg-stone-50 ${p.ativo ? "" : "opacity-50"}`}>
              <td className="px-4 py-3">{p.codigo ?? "—"}</td>
              <td className="px-4 py-3"><Link href={`/estoque/${p.id}`} className="font-medium text-madeira-800 hover:underline">{p.nome}</Link></td>
              <td className="px-4 py-3">{servico ? "Serviço" : CATEGORIA_CURTA[p.categoria] ?? "—"}</td>
              <td className="px-4 py-3">{p.local ?? "—"}</td>
              <td className="px-4 py-3">{servico ? "—" : qtd(p.estoque_atual, p.unidade_medida)}</td>
              <td className="px-4 py-3">{servico || !Number(p.reservado) ? "—" : qtd(p.reservado)}</td>
              <td className="px-4 py-3">{servico ? "—" : <>{qtd(p.livre)} {alerta && <Selo cor="red">repor</Selo>}</>}</td>
              <td className="px-4 py-3">{servico || !Number(p.a_caminho) ? "—" : qtd(p.a_caminho)}</td>
              <td className="px-4 py-3">{servico ? "—" : qtd(p.estoque_minimo)}</td>
              <td className="px-4 py-3">{brl(p.custo)}</td>
            </tr>
          );
        })}
      </Tabela>
    </>
  );
}
