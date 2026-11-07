import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Titulo, inputCls } from "@/components/ui";
import { criarNegociacao } from "../actions";
import { CamposNegociacao } from "../campos";

export default async function NovaNegociacaoPage({ searchParams }: PageProps<"/crm/nova">) {
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const [{ data: clientes }, { data: parceiros }] = await Promise.all([
    supabase.from("clientes").select("id, nome").order("nome"),
    supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
  ]);

  return (
    <>
      <Titulo>Nova negociação</Titulo>
      <Cartao>
        <form action={criarNegociacao} className="grid gap-4 md:grid-cols-6">
          <Campo rotulo="Cliente já cadastrado" className="md:col-span-2">
            <select name="cliente_id" defaultValue={typeof cliente === "string" ? cliente : ""} className={inputCls}>
              <option value="">— novo contato —</option>
              {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="ou nome do novo contato" className="md:col-span-2"><input name="novo_nome" className={inputCls} /></Campo>
          <Campo rotulo="Telefone / WhatsApp" className="md:col-span-2"><input name="novo_telefone" className={inputCls} /></Campo>
          <Campo rotulo="O que o cliente quer *" className="md:col-span-4">
            <input name="titulo" required placeholder="Cozinha + área de serviço" className={inputCls} />
          </Campo>
          <Campo rotulo="Unidade" className="md:col-span-2">
            <select name="unidade" className={inputCls}><option value="marcenaria">Marcenaria</option><option value="loja">Loja</option></select>
          </Campo>
          <CamposNegociacao parceiros={parceiros ?? []} />
          <div className="md:col-span-6"><Botao type="submit">Criar negociação</Botao></div>
        </form>
      </Cartao>
    </>
  );
}
