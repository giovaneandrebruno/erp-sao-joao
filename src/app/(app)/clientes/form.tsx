import { Botao, Campo, inputCls } from "@/components/ui";
import { salvarCliente } from "./actions";

type Cliente = Record<string, string | null>;

export function FormCliente({ cliente }: { cliente?: Cliente }) {
  const v = (k: string) => cliente?.[k] ?? "";
  return (
    <form action={salvarCliente.bind(null, cliente?.id ?? null)} className="grid gap-4 md:grid-cols-6">
      <Campo rotulo="Nome *" className="md:col-span-4">
        <input name="nome" required defaultValue={v("nome")} className={inputCls} />
      </Campo>
      <Campo rotulo="CPF / CNPJ" className="md:col-span-2">
        <input name="cpf_cnpj" defaultValue={v("cpf_cnpj")} className={inputCls} />
      </Campo>
      <Campo rotulo="Telefone / WhatsApp" className="md:col-span-3">
        <input name="telefone" defaultValue={v("telefone")} className={inputCls} />
      </Campo>
      <Campo rotulo="E-mail" className="md:col-span-3">
        <input name="email" type="email" defaultValue={v("email")} className={inputCls} />
      </Campo>
      <Campo rotulo="Endereço" className="md:col-span-6">
        <input name="endereco" defaultValue={v("endereco")} className={inputCls} />
      </Campo>
      <Campo rotulo="Cidade" className="md:col-span-3">
        <input name="cidade" defaultValue={v("cidade")} className={inputCls} />
      </Campo>
      <Campo rotulo="UF" className="md:col-span-1">
        <input name="uf" maxLength={2} defaultValue={v("uf")} className={inputCls} />
      </Campo>
      <Campo rotulo="CEP" className="md:col-span-2">
        <input name="cep" defaultValue={v("cep")} className={inputCls} />
      </Campo>
      <Campo rotulo="Observações" className="md:col-span-6">
        <textarea name="observacoes" rows={3} defaultValue={v("observacoes")} className={inputCls} />
      </Campo>
      <div className="md:col-span-6">
        <Botao type="submit">Salvar</Botao>
      </div>
    </form>
  );
}
