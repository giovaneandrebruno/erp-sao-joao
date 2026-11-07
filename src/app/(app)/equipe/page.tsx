import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { ROTULOS2, pct } from "@/lib/format";
import { alternarAtivo, criarParceiro } from "./actions";

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: parceiros } = await supabase.from("parceiros").select("*").order("tipo").order("nome");

  return (
    <>
      <Titulo>Equipe e parceiros</Titulo>
      <p className="mb-4 text-sm text-stone-500">Vendedores e arquitetos recebem comissão sobre os pedidos. Montadores aparecem nos prazos e na assistência técnica.</p>
      <div className="mb-8">
        <Tabela cabecalho={["Nome", "Tipo", "Comissão padrão", "Telefone", "Pix", ""]} vazio={!parceiros?.length}>
          {parceiros?.map((p) => (
            <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
              <td className="px-4 py-3 font-medium">{p.nome}</td>
              <td className="px-4 py-3"><Selo cor={p.tipo === "vendedor" ? "blue" : p.tipo === "arquiteto" ? "amber" : "stone"}>{ROTULOS2.tipoParceiro[p.tipo as keyof typeof ROTULOS2.tipoParceiro]}</Selo></td>
              <td className="px-4 py-3">{p.comissao_padrao != null ? pct(p.comissao_padrao) : "—"}</td>
              <td className="px-4 py-3">{p.telefone ?? "—"}</td>
              <td className="px-4 py-3">{p.chave_pix ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                <form action={alternarAtivo.bind(null, p.id, !p.ativo)}><button className="text-xs text-stone-500 hover:underline">{p.ativo ? "desativar" : "reativar"}</button></form>
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
      <Cartao>
        <h2 className="mb-3 font-semibold">Adicionar pessoa</h2>
        <form action={criarParceiro} className="grid gap-3 md:grid-cols-6">
          <Campo rotulo="Nome *" className="md:col-span-2"><input name="nome" required className={inputCls} /></Campo>
          <Campo rotulo="Tipo" className="md:col-span-2">
            <select name="tipo" className={inputCls}>
              {Object.entries(ROTULOS2.tipoParceiro).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Comissão padrão (%)" className="md:col-span-2"><input name="comissao_padrao" inputMode="decimal" placeholder="usa a da configuração" className={inputCls} /></Campo>
          <Campo rotulo="Telefone" className="md:col-span-2"><input name="telefone" className={inputCls} /></Campo>
          <Campo rotulo="E-mail" className="md:col-span-2"><input name="email" type="email" className={inputCls} /></Campo>
          <Campo rotulo="Chave Pix" className="md:col-span-2"><input name="chave_pix" className={inputCls} /></Campo>
          <div className="md:col-span-6"><Botao type="submit">Adicionar</Botao></div>
        </form>
      </Cartao>
    </>
  );
}
