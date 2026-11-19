import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Titulo, estiloBotao, inputCls } from "@/components/ui";
import { dataHora } from "@/lib/format";
import { salvarConfiguracoes } from "./actions";
import { BotaoCopiaAgora } from "./botao-copia";
import { nomeDoAssunto } from "@/lib/copia";

type CopiaGuardada = { gaveta: number; feita_em: string; origem: "automatica" | "manual"; registros: number; tamanho_bytes: number };
type Tamanho = { total_bytes: number; copias_bytes: number; tabelas: { tabela: string; linhas: number; bytes: number }[] };

/** Limite de espaço do plano gratuito do banco. */
const LIMITE_BANCO = 500 * 1024 * 1024;
const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.from("configuracoes").select("*").single();
  const [{ data: copiasBrutas }, { data: tamanhoBruto }] = await Promise.all([supabase.rpc("copias_lista"), supabase.rpc("tamanho_banco")]);
  const copias = (copiasBrutas ?? []) as CopiaGuardada[];
  const tamanho = tamanhoBruto as Tamanho | null;
  const usoPct = tamanho ? Math.min(100, (tamanho.total_bytes / LIMITE_BANCO) * 100) : 0;
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
      <Cartao className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-semibold">Cópias automáticas</h2>
            <p className="mt-1 text-sm text-stone-600">
              Todo dia, às 3h da manhã, o sistema guarda sozinho uma cópia de tudo. Ficam as dos últimos 30 dias.
              Se algo for apagado ou alterado por engano, dá para baixar a cópia de um dia anterior e recuperar.
            </p>
          </div>
          <BotaoCopiaAgora />
        </div>
        {copias.length ? (
          <ul className="mt-4 divide-y divide-stone-100 text-sm">
            {copias.slice(0, 10).map((c) => (
              <li key={c.gaveta} className="flex items-center justify-between gap-4 py-2.5">
                <span>
                  <strong>{dataHora(c.feita_em)}</strong>
                  <span className="text-stone-500"> · {c.origem === "manual" ? "feita na hora" : "automática"} · {c.registros.toLocaleString("pt-BR")} registros · {mb(c.tamanho_bytes)}</span>
                </span>
                <a href={`/configuracoes/copia/${c.gaveta}`} download className="shrink-0 font-semibold text-laranja hover:underline">Baixar .xlsx</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-500">A primeira cópia automática sai hoje de madrugada.</p>
        )}
        {copias.length > 10 && <p className="mt-2 text-xs text-stone-400">Mostrando as 10 mais recentes de {copias.length} guardadas.</p>}
        <p className="mt-4 rounded-lg bg-bege/40 px-4 py-2.5 text-sm text-stone-700">As cópias automáticas ficam dentro do próprio banco. Baixe uma de vez em quando e guarde fora (computador, pen drive ou Google Drive).</p>
      </Cartao>
      {tamanho && (
        <Cartao className="mb-6">
          <h2 className="font-semibold">Espaço do banco</h2>
          <p className="mt-1 text-sm text-stone-600">
            Usando <strong>{mb(tamanho.total_bytes)}</strong> de {mb(LIMITE_BANCO)} do plano gratuito ({usoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%). As cópias automáticas ocupam {mb(tamanho.copias_bytes)}.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className={`h-full rounded-full ${usoPct > 80 ? "bg-rosa" : "bg-laranja"}`} style={{ width: `${Math.max(usoPct, 1)}%` }} />
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-stone-500 hover:text-stone-800">Ver o que ocupa mais espaço</summary>
            <ul className="mt-2 divide-y divide-stone-100">
              {tamanho.tabelas.slice(0, 12).map((t) => (
                <li key={t.tabela} className="flex justify-between gap-4 py-1.5">
                  <span>{nomeDoAssunto(t.tabela)}</span>
                  <span className="font-mono text-xs text-stone-500">{Number(t.linhas).toLocaleString("pt-BR")} registros · {mb(t.bytes)}</span>
                </li>
              ))}
            </ul>
          </details>
        </Cartao>
      )}
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
