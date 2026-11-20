import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { FormCliente } from "../form";

export default async function NovoClientePage() {
  const supabase = await createClient();
  const { data: parceiros } = await supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome");
  return (
    <>
      <Titulo>Novo cliente</Titulo>
      <Cartao><FormCliente parceiros={parceiros ?? []} /></Cartao>
    </>
  );
}
