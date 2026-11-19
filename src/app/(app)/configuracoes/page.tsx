import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Titulo, estiloBotao, inputCls } from "@/components/ui";
import { dataHora } from "@/lib/format";
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
      <Cartao className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-semibold">Cópia de segurança</h2>
            <p className="mt-1 text-sm text-stone-600">
              Baixa uma planilha .xlsx com tudo o que está no sistema: clientes, fornecedores, orçamentos, pedidos, produção, estoque e financeiro.
              Cada assunto fica numa aba. Guarde no computador ou no pen drive.
            </p>
            <p className="mt-2 text-sm text-stone-500">
              {c?.ultima_copia_em
                ? <>Última cópia baixada: <strong>{dataHora(c.ultima_copia_em)}</strong>{c.ultima_copia_por ? `, por ${c.ultima_copia_por}` : ""}</>
                : "Nenhuma cópia baixada ainda."}
            </p>
          </div>
          {/* link comum (não o do Next): o navegador baixa o arquivo direto */}
          <a href="/configuracoes/copia" download className={`${estiloBotao.primario} shrink-0`}>Baixar cópia (.xlsx)</a>
        </div>
        <p className="mt-4 rounded-lg bg-bege/40 px-4 py-2.5 text-sm text-stone-700">Dica: o Painel avisa quando passar mais de 7 dias sem baixar uma cópia.</p>
      </Cartao>
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

        <Cartao>
          <h2 className="mb-1 font-semibold">Mensagens prontas de WhatsApp</h2>
          <p className="mb-4 text-sm text-stone-500">Use {"{cliente}"}, {"{empresa}"}, {"{valor}"}, {"{data}"}, {"{etapa}"}, {"{parcela}"} e {"{link}"}: o sistema troca pelos dados de cada cliente.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ["msg_orcamento", "Envio da proposta"],
              ["msg_agendamento", "Aviso de medição, entrega e montagem"],
              ["msg_cobranca", "Lembrete de parcela"],
              ["msg_cobranca_vencida", "Cobrança de parcela vencida"],
              ["msg_pos_venda", "Pós-venda"],
            ] as const).map(([k, r]) => (
              <Campo key={k} rotulo={r}>
                <textarea name={k} rows={4} defaultValue={String(v(k) ?? "")} className={`${inputCls} w-full`} />
              </Campo>
            ))}
          </div>
        </Cartao>

        <div><Botao type="submit">Salvar configurações</Botao></div>
      </form>
    </>
  );
}
