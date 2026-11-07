import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Tabela, Titulo, inputCls } from "@/components/ui";

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const { busca } = await searchParams;
  const termo = typeof busca === "string" ? busca.trim() : "";
  const supabase = await createClient();
  let consulta = supabase.from("clientes").select("id, nome, telefone, cidade, uf").order("nome").limit(200);
  const seguro = termo.replace(/[,()%*]/g, " ");
  if (seguro) consulta = consulta.or(`nome.ilike.%${seguro}%,telefone.ilike.%${seguro}%,cpf_cnpj.ilike.%${seguro}%`);
  const { data: clientes = [] } = await consulta;

  return (
    <>
      <Titulo acao={<BotaoLink href="/clientes/novo">Novo cliente</BotaoLink>}>Clientes</Titulo>
      <form className="mb-4">
        <input name="busca" defaultValue={termo} placeholder="Buscar por nome, telefone ou CPF/CNPJ" className={`${inputCls} w-full max-w-md`} />
      </form>
      <Tabela cabecalho={["Nome", "Telefone", "Cidade"]} vazio={!clientes?.length}>
        {clientes?.map((c) => (
          <tr key={c.id} className="hover:bg-stone-50">
            <td className="px-4 py-3"><Link href={`/clientes/${c.id}`} className="font-medium text-madeira-800 hover:underline">{c.nome}</Link></td>
            <td className="px-4 py-3">{c.telefone ?? "—"}</td>
            <td className="px-4 py-3">{c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "—"}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
