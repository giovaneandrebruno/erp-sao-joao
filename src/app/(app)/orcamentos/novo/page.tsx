import { createClient } from "@/lib/supabase/server";
import { Botao, BotaoLink, Campo, Cartao, Titulo, inputCls } from "@/components/ui";
import { criarOrcamento } from "../actions";
import { CamposOrcamento } from "../campos";

export default async function NovoOrcamentoPage({ searchParams }: PageProps<"/orcamentos/novo">) {
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const { data: clientes } = await supabase.from("clientes").select("id, nome").order("nome");

  if (!clientes?.length) {
    return (
      <>
        <Titulo>Novo orçamento</Titulo>
        <Cartao>
          <p className="mb-4 text-sm">Cadastre um cliente antes de fazer o orçamento.</p>
          <BotaoLink href="/clientes/novo">Cadastrar cliente</BotaoLink>
        </Cartao>
      </>
    );
  }

  return (
    <>
      <Titulo>Novo orçamento</Titulo>
      <Cartao>
        <form action={criarOrcamento} className="grid gap-4 md:grid-cols-6">
          <Campo rotulo="Cliente *" className="md:col-span-6">
            <select name="cliente_id" required defaultValue={typeof cliente === "string" ? cliente : ""} className={inputCls}>
              <option value="" disabled>Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <CamposOrcamento />
          <div className="md:col-span-6"><Botao type="submit">Criar e adicionar itens</Botao></div>
        </form>
      </Cartao>
    </>
  );
}
