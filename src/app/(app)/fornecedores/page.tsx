import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Tabela, Titulo, inputCls } from "@/components/ui";
import { excluirFornecedor, salvarFornecedor } from "./actions";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoCancelar, BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";

type Fornecedor = { nome?: string | null; cpf_cnpj?: string | null; contato?: string | null; telefone?: string | null; email?: string | null; observacoes?: string | null };

function FormFornecedor({ id = null, f = {} }: { id?: string | null; f?: Fornecedor }) {
  return (
    <form action={salvarFornecedor.bind(null, id)} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Nome *" className="md:col-span-3"><input name="nome" required defaultValue={f.nome ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="CNPJ" className="md:col-span-3"><input name="cpf_cnpj" defaultValue={f.cpf_cnpj ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Pessoa de contato" className="md:col-span-2"><input name="contato" defaultValue={f.contato ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Telefone" className="md:col-span-2"><input name="telefone" defaultValue={f.telefone ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="E-mail" className="md:col-span-2"><input name="email" type="email" defaultValue={f.email ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Observações" className="md:col-span-6"><textarea name="observacoes" rows={2} defaultValue={f.observacoes ?? ""} className={inputCls} /></Campo>
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{id ? "Salvar alterações" : "Salvar"}</Botao>
        {id && <BotaoCancelar />}
      </div>
    </form>
  );
}

export default async function FornecedoresPage({ searchParams }: PageProps<"/fornecedores">) {
  const { editar } = await searchParams;
  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("*").order("nome");
  const emEdicao = typeof editar === "string" ? fornecedores?.find((f) => f.id === editar) : undefined;

  return (
    <>
      <Titulo acao={<FerramentasImportacao area="fornecedores" />}>Fornecedores</Titulo>
      <div className="mb-8">
        <div className="mb-4 flex justify-end">
          <JanelaBotao rotulo="Novo fornecedor" titulo="Novo fornecedor" aviso="Fornecedor salvo">
            <FormFornecedor />
          </JanelaBotao>
        </div>
        <Tabela cabecalho={["Nome", "Contato", "Telefone", "E-mail", "CNPJ", ""]} vazio={!fornecedores?.length}>
          {fornecedores?.map((f) => (
            <tr key={f.id}>
              <td className="px-4 py-3 font-medium">{f.nome}</td>
              <td className="px-4 py-3">{f.contato ?? "—"}</td>
              <td className="px-4 py-3">{f.telefone ?? "—"}</td>
              <td className="px-4 py-3">{f.email ?? "—"}</td>
              <td className="px-4 py-3">{f.cpf_cnpj ?? "—"}</td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <LinkEditar id={f.id} />
                  <BotaoExcluir
                    acao={excluirFornecedor.bind(null, f.id)}
                    titulo="Excluir este fornecedor?"
                    detalhe={<><strong>{f.nome}</strong>. As compras e contas ligadas a ele continuam no sistema.</>}
                    aviso="Fornecedor excluído"
                  />
                </AcoesLinha>
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Alterar fornecedor" descricao={emEdicao.nome} aviso="Fornecedor salvo">
          <FormFornecedor id={emEdicao.id} f={emEdicao} />
        </JanelaEditar>
      )}
    </>
  );
}
