import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Tabela, Titulo, inputCls } from "@/components/ui";
import { salvarFornecedor } from "./actions";
import { JanelaBotao } from "@/components/janela";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("*").order("nome");

  return (
    <>
      <Titulo>Fornecedores</Titulo>
      <div className="mb-8">
        <div className="mb-4 flex justify-end">
          <JanelaBotao rotulo="Novo fornecedor" titulo="Novo fornecedor">
            <form action={salvarFornecedor.bind(null, null)} className="grid gap-3 md:grid-cols-6">
              <Campo rotulo="Nome *" className="md:col-span-3"><input name="nome" required className={inputCls} /></Campo>
              <Campo rotulo="CNPJ" className="md:col-span-3"><input name="cpf_cnpj" className={inputCls} /></Campo>
              <Campo rotulo="Pessoa de contato" className="md:col-span-2"><input name="contato" className={inputCls} /></Campo>
              <Campo rotulo="Telefone" className="md:col-span-2"><input name="telefone" className={inputCls} /></Campo>
              <Campo rotulo="E-mail" className="md:col-span-2"><input name="email" type="email" className={inputCls} /></Campo>
              <Campo rotulo="Observações" className="md:col-span-6"><textarea name="observacoes" rows={2} className={inputCls} /></Campo>
              <div className="md:col-span-6"><Botao type="submit">Salvar</Botao></div>
            </form>
          </JanelaBotao>
        </div>
        <Tabela cabecalho={["Nome", "Contato", "Telefone", "E-mail", "CNPJ"]} vazio={!fornecedores?.length}>
          {fornecedores?.map((f) => (
            <tr key={f.id}>
              <td className="px-4 py-3 font-medium">{f.nome}</td>
              <td className="px-4 py-3">{f.contato ?? "—"}</td>
              <td className="px-4 py-3">{f.telefone ?? "—"}</td>
              <td className="px-4 py-3">{f.email ?? "—"}</td>
              <td className="px-4 py-3">{f.cpf_cnpj ?? "—"}</td>
            </tr>
          ))}
        </Tabela>
      </div>
    </>
  );
}
