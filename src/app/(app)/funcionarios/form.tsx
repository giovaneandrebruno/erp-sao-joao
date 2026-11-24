"use client";

import { useState } from "react";
import { Botao, Campo, inputCls } from "@/components/ui";
import { ESTADOS_CIVIS, UFS, erroDocumento, erroEmail, formatarCEP, formatarDocumento, formatarTelefone } from "@/lib/cliente";
import { ESCOLARIDADES, PARENTESCOS, SITUACOES_FUNCIONARIO, TIPOS_CONTRATO, TIPOS_SANGUINEOS } from "@/lib/funcionarios";
import { cpfEmUso, salvarFuncionario } from "./actions";

type Funcionario = Record<string, string | number | null>;

const secaoCls = "md:col-span-6 mt-2 border-t border-stone-100 pt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400 first:mt-0 first:border-0 first:pt-0";

/** Formata o campo quando a pessoa sai dele (ex.: 11999998888 → (11) 99999-8888). */
const SPAN: Record<number, string> = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4", 6: "md:col-span-6" };

const ao = (f: (v: string) => string) => (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.value = f(e.currentTarget.value); };

function Lista({ id, opcoes }: { id: string; opcoes: string[] }) {
  return <datalist id={id}>{opcoes.map((o) => <option key={o} value={o} />)}</datalist>;
}

/** Cadastro completo do funcionário. Só o nome é obrigatório; o resto pode ser preenchido aos poucos. */
export function FormFuncionario({ funcionario, cargos = [], setores = [] }: { funcionario?: Funcionario; cargos?: string[]; setores?: string[] }) {
  const v = (k: string) => (funcionario?.[k] ?? "") as string;
  const [avisoCpf, setAvisoCpf] = useState<string | null>(null);
  const [avisoEmail, setAvisoEmail] = useState<string | null>(null);
  const [situacao, setSituacao] = useState(v("situacao") || "ativo");

  async function conferirCpf(e: React.FocusEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    campo.value = formatarDocumento(campo.value);
    let erro = campo.value && campo.value.replace(/\D/g, "").length !== 11 ? "O CPF tem 11 números." : erroDocumento(campo.value);
    if (!erro && campo.value) {
      const outro = await cpfEmUso(campo.value, (funcionario?.id as string) ?? null);
      if (outro) erro = `Este CPF já está no cadastro de ${outro}.`;
    }
    campo.setCustomValidity(erro ?? "");
    setAvisoCpf(erro);
  }

  function conferirEmail(e: React.FocusEvent<HTMLInputElement>) {
    const erro = erroEmail(e.currentTarget.value);
    e.currentTarget.setCustomValidity(erro ?? "");
    setAvisoEmail(erro);
  }

  const campo = (nome: string, rotulo: string, span = 2, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Campo rotulo={rotulo} className={SPAN[span]}>
      <input name={nome} defaultValue={v(nome)} className={inputCls} {...extra} />
    </Campo>
  );

  return (
    <form action={salvarFuncionario.bind(null, (funcionario?.id as string) ?? null)} className="grid gap-4 md:grid-cols-6">
      <p className={secaoCls}>Dados pessoais</p>
      {campo("nome", "Nome completo *", 4, { required: true })}
      {campo("apelido", "Apelido (como é chamado)", 2)}
      <Campo rotulo="CPF" className="md:col-span-2">
        <input
          name="cpf"
          inputMode="numeric"
          defaultValue={v("cpf")}
          onBlur={conferirCpf}
          onInput={(e) => { e.currentTarget.setCustomValidity(""); setAvisoCpf(null); }}
          placeholder="000.000.000-00"
          className={inputCls}
        />
        {avisoCpf && <span className="text-xs text-rosa">{avisoCpf}</span>}
      </Campo>
      {campo("rg", "RG", 2)}
      {campo("rg_orgao", "Órgão emissor do RG", 2, { placeholder: "Ex.: SSP/SP" })}
      {campo("data_nascimento", "Data de nascimento", 2, { type: "date" })}
      <Campo rotulo="Estado civil" className="md:col-span-2">
        <select name="estado_civil" defaultValue={v("estado_civil")} className={inputCls}>
          <option value="">—</option>
          {ESTADOS_CIVIS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Escolaridade" className="md:col-span-2">
        <select name="escolaridade" defaultValue={v("escolaridade")} className={inputCls}>
          <option value="">—</option>
          {ESCOLARIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </Campo>
      {campo("nome_mae", "Nome da mãe", 3)}
      {campo("nome_pai", "Nome do pai", 3)}

      <p className={secaoCls}>Documentos de trabalho</p>
      {campo("pis", "PIS / NIS", 2)}
      {campo("ctps", "Carteira de trabalho (número e série)", 2)}
      {campo("titulo_eleitor", "Título de eleitor", 2)}
      {campo("cnh", "CNH (número)", 2)}
      {campo("cnh_categoria", "Categoria da CNH", 2, { placeholder: "Ex.: AB" })}
      {campo("cnh_validade", "Validade da CNH", 2, { type: "date" })}

      <p className={secaoCls}>Contato e endereço</p>
      {campo("telefone", "Celular", 2, { type: "tel", onBlur: ao(formatarTelefone), placeholder: "(00) 00000-0000" })}
      {campo("telefone2", "Outro telefone", 2, { type: "tel", onBlur: ao(formatarTelefone) })}
      <Campo rotulo="E-mail" className="md:col-span-2">
        <input
          name="email"
          type="email"
          defaultValue={v("email")}
          onBlur={conferirEmail}
          onInput={(e) => { e.currentTarget.setCustomValidity(""); setAvisoEmail(null); }}
          className={inputCls}
        />
        {avisoEmail && <span className="text-xs text-rosa">{avisoEmail}</span>}
      </Campo>
      {campo("cep", "CEP", 2, { inputMode: "numeric", onBlur: ao(formatarCEP), placeholder: "00000-000" })}
      {campo("endereco", "Rua / avenida", 4)}
      {campo("numero", "Número", 1)}
      {campo("complemento", "Complemento", 2)}
      {campo("bairro", "Bairro", 3)}
      {campo("cidade", "Cidade", 4)}
      <Campo rotulo="UF" className="md:col-span-2">
        <input name="uf" maxLength={2} list="ufs-func" defaultValue={v("uf")} className={`${inputCls} uppercase`} />
        <Lista id="ufs-func" opcoes={UFS} />
      </Campo>

      <p className={secaoCls}>Em caso de emergência, avisar</p>
      {campo("contato_emergencia_nome", "Nome", 2)}
      <Campo rotulo="Parentesco" className="md:col-span-2">
        <input name="contato_emergencia_parentesco" list="parentescos" defaultValue={v("contato_emergencia_parentesco")} className={inputCls} />
        <Lista id="parentescos" opcoes={PARENTESCOS} />
      </Campo>
      {campo("contato_emergencia_telefone", "Telefone", 2, { type: "tel", onBlur: ao(formatarTelefone) })}

      <p className={secaoCls}>Trabalho</p>
      <Campo rotulo="Situação" className="md:col-span-2">
        <select name="situacao" value={situacao} onChange={(e) => setSituacao(e.target.value)} className={inputCls}>
          {Object.entries(SITUACOES_FUNCIONARIO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Cargo / função" className="md:col-span-2">
        <input name="cargo" list="cargos" defaultValue={v("cargo")} placeholder="Ex.: marceneiro, montador, vendedora" className={inputCls} />
        <Lista id="cargos" opcoes={cargos} />
      </Campo>
      <Campo rotulo="Setor" className="md:col-span-2">
        <input name="setor" list="setores" defaultValue={v("setor")} placeholder="Ex.: fábrica, montagem, loja, escritório" className={inputCls} />
        <Lista id="setores" opcoes={setores} />
      </Campo>
      <Campo rotulo="Tipo de contrato" className="md:col-span-2">
        <input name="tipo_contrato" list="contratos" defaultValue={v("tipo_contrato")} className={inputCls} />
        <Lista id="contratos" opcoes={TIPOS_CONTRATO} />
      </Campo>
      {campo("matricula", "Matrícula / código no relógio ponto", 2, { placeholder: "Usado para ler a planilha do ponto" })}
      {campo("data_admissao", "Data de admissão", 2, { type: "date" })}
      {campo("salario", "Salário (R$)", 2, { inputMode: "decimal", placeholder: "0,00" })}
      {campo("horas_semana", "Horas por semana", 2, { inputMode: "decimal", placeholder: "Ex.: 44" })}
      {campo("horario", "Horário de trabalho", 2, { placeholder: "Ex.: seg a sex 7h30–17h18" })}
      {situacao === "desligado" && (
        <>
          {campo("data_demissao", "Data de saída", 2, { type: "date" })}
          {campo("motivo_demissao", "Motivo da saída", 4, { placeholder: "Ex.: pediu demissão, fim do contrato de experiência" })}
        </>
      )}

      <p className={secaoCls}>Banco (para pagamento)</p>
      {campo("banco", "Banco", 2)}
      {campo("agencia", "Agência", 1)}
      {campo("conta", "Conta", 1)}
      {campo("pix", "Chave Pix", 2)}

      <p className={secaoCls}>Saúde e uniforme</p>
      <Campo rotulo="Tipo sanguíneo" className="md:col-span-1">
        <select name="tipo_sanguineo" defaultValue={v("tipo_sanguineo")} className={inputCls}>
          <option value="">—</option>
          {TIPOS_SANGUINEOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Campo>
      {campo("alergias", "Alergias / cuidados de saúde", 3)}
      {campo("ultimo_exame", "Último exame médico (ASO)", 1, { type: "date" })}
      {campo("proximo_exame", "Próximo exame", 1, { type: "date" })}
      {campo("tamanho_camisa", "Camisa", 2, { placeholder: "Ex.: G" })}
      {campo("tamanho_calca", "Calça", 2, { placeholder: "Ex.: 42" })}
      {campo("tamanho_calcado", "Calçado / botina", 2, { placeholder: "Ex.: 40" })}

      <p className={secaoCls}>Observações</p>
      <Campo rotulo="Observações" className="md:col-span-6">
        <textarea name="observacoes" rows={3} defaultValue={v("observacoes")} className={inputCls} />
      </Campo>
      <div className="md:col-span-6">
        <Botao type="submit">Salvar</Botao>
      </div>
    </form>
  );
}
