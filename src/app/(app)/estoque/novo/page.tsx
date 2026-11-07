import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { FormProduto } from "../form";

export default async function NovoProdutoPage() {
  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("id, nome").order("nome");
  return (
    <>
      <Titulo>Novo produto</Titulo>
      <Cartao><FormProduto fornecedores={fornecedores ?? []} /></Cartao>
    </>
  );
}
