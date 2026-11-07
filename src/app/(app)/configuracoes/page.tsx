import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Titulo, inputCls } from "@/components/ui";
import { salvarConfiguracoes } from "./actions";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.from("configuracoes").select("*").single();
  const v = (k: string) => (c?.[k as keyof typeof c] ?? "") as string | number;

  const campo = (nome: string, rotulo: string, span = "md:col-span-2", extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Campo rotulo={rotulo} className={span}>
      <input name={nome} defaultValue={String(v(nome))} className={inputCls} {...extra} />
    </Campo>
  );

  return (
    <>
      <Titulo>Configurações</Titulo>
      <form action={salvarConfiguracoes} className="flex flex-col gap-6">
        <Cartao>
          <h2 className="mb-4 font-semibold">Dados da empresa</h2>
          <p className="mb-4 text-sm text-stone-500">Aparecem no orçamento e no contrato.</p>
          <div className="grid gap-4 md:grid-cols-6">
            {campo("nome_fantasia", "Nome fantasia", "md:col-span-3")}
            {campo("razao_social", "Razão social", "md:col-span-3")}
            {campo("cnpj", "CNPJ")}
            {campo("telefone", "Telefone")}
            {campo("email", "E-mail")}
            {campo("endereco", "Endereço", "md:col-span-3")}
            {campo("cidade", "Cidade", "md:col-span-2")}
            {campo("uf", "UF", "md:col-span-1")}
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-4 font-semibold">Preços, margem e comissões</h2>
          <p className="mb-4 text-sm text-stone-500">Valores em %, usados como padrão em cada novo orçamento. O markup multiplica o custo para sugerir o preço de venda.</p>
          <div className="grid gap-4 md:grid-cols-6">
            {campo("aliquota_imposto", "Imposto sobre venda (%)")}
            {campo("margem_minima", "Margem mínima (%)")}
            {campo("markup_padrao", "Markup padrão (×)")}
            {campo("taxa_credito", "Taxa cartão de crédito (%)")}
            {campo("taxa_debito", "Taxa cartão de débito (%)")}
            {campo("taxa_boleto", "Taxa de boleto (%)")}
            {campo("comissao_vendedor_padrao", "Comissão do vendedor (%)")}
            {campo("comissao_arquiteto_padrao", "Comissão do arquiteto / RT (%)")}
            {campo("validade_orcamento_dias", "Validade do orçamento (dias)")}
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-4 font-semibold">Cláusulas do contrato</h2>
          <textarea name="clausulas_contrato" rows={10} defaultValue={String(v("clausulas_contrato"))} className={`${inputCls} w-full`} />
        </Cartao>

        <div><Botao type="submit">Salvar configurações</Botao></div>
      </form>
    </>
  );
}
