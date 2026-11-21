import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { FormCliente } from "../form";

export default async function NovoClientePage({ searchParams }: PageProps<"/clientes/novo">) {
  const sp = await searchParams;
  // vindo de uma mensagem das redes sociais: já preenche o nome e a origem
  const inicial = typeof sp.nome === "string" ? { nome: sp.nome.slice(0, 120), origem: typeof sp.origem === "string" ? sp.origem.slice(0, 40) : null } : undefined;
  const supabase = await createClient();
  const { data: parceiros } = await supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome");
  return (
    <>
      <Titulo>Novo cliente</Titulo>
      <Cartao><FormCliente cliente={inicial} parceiros={parceiros ?? []} /></Cartao>
    </>
  );
}
