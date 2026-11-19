import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { hojeISO } from "@/lib/format";
import { FormOrdem } from "../form";

export default async function NovaOrdemPage({ searchParams }: PageProps<"/producao/nova">) {
  await connection(); // a data de hoje muda: a tela é sempre montada na hora
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const { data: clientes } = await supabase.from("clientes").select("id, nome").order("nome");
  const inicial = typeof cliente === "string" ? { id: "", cliente_id: cliente, status_pcp: "VR", posicao: "AGUARDANDO" } : undefined;
  return (
    <>
      <Titulo sub="Preencha o que já souber. As outras colunas podem ser completadas depois, conforme a OS avança.">Nova ordem de serviço</Titulo>
      <Cartao>
        <FormOrdem ordem={inicial && { ...inicial, id: "" }} clientes={clientes ?? []} hoje={hojeISO()} />
      </Cartao>
    </>
  );
}
