"use client";

import { useState } from "react";
import { Botao, Campo, inputCls } from "@/components/ui";
import { ESTADOS_CIVIS, SITUACOES, UFS, erroDocumento, erroEmail, formatarCEP, formatarDocumento, formatarTelefone } from "@/lib/cliente";
import { ORIGENS } from "../crm/campos";
import { documentoEmUso, salvarCliente } from "./actions";

type Cliente = Record<string, string | null>;
type Pessoa = { id: string; nome: string; tipo: string };

const secaoCls = "md:col-span-6 mt-2 border-t border-stone-100 pt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400 first:mt-0 first:border-0 first:pt-0";

/** Formata o campo quando a pessoa sai dele (ex.: 11999998888 → (11) 99999-8888). */
const ao = (f: (v: string) => string) => (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.value = f(e.currentTarget.value); };

export function FormCliente({ cliente, parceiros = [], naLista = false }: { cliente?: Cliente; parceiros?: Pessoa[]; naLista?: boolean }) {
  const v = (k: string) => cliente?.[k] ?? "";
  const [tipo, setTipo] = useState(v("tipo_pessoa") || "fisica");
  const [avisoDoc, setAvisoDoc] = useState<string | null>(null);
  const [avisoEmail, setAvisoEmail] = useState<string | null>(null);
  const pj = tipo === "juridica";

  async function conferirDocumento(e: React.FocusEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    campo.value = formatarDocumento(campo.value);
    let erro = erroDocumento(campo.value);
    if (!erro && campo.value) {
      const outro = await documentoEmUso(campo.value, cliente?.id ?? null);
      if (outro) erro = `Este CPF/CNPJ já está no cadastro de ${outro}.`;
    }
    campo.setCustomValidity(erro ?? "");
    setAvisoDoc(erro);
  }

  function conferirEmail(e: React.FocusEvent<HTMLInputElement>) {
    const erro = erroEmail(e.currentTarget.value);
    e.currentTarget.setCustomValidity(erro ?? "");
    setAvisoEmail(erro);
  }

  return (
    <form action={salvarCliente.bind(null, cliente?.id ?? null)} className="grid gap-4 md:grid-cols-6">
      {naLista && <input type="hidden" name="ficar_na_lista" value="1" />}
      <p className={secaoCls}>Situação</p>
      <Campo rotulo="Situação" className="md:col-span-2">
        <select name="situacao" defaultValue={v("situacao") || "lead"} className={inputCls}>
          {Object.entries(SITUACOES).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Tipo" className="md:col-span-2">
        <select name="tipo_pessoa" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
          <option value="fisica">Pessoa física</option>
          <option value="juridica">Empresa (pessoa jurídica)</option>
        </select>
      </Campo>
      <Campo rotulo="Origem (como chegou)" className="md:col-span-2">
        <input name="origem" list="origens-cliente" defaultValue={v("origem")} className={inputCls} />
        <datalist id="origens-cliente">{ORIGENS.map((o) => <option key={o} value={o} />)}</datalist>
      </Campo>

      <p className={secaoCls}>{pj ? "Dados da empresa" : "Dados pessoais"}</p>
      <Campo rotulo={pj ? "Razão social *" : "Nome completo *"} className="md:col-span-4">
        <input name="nome" required defaultValue={v("nome")} className={inputCls} />
      </Campo>
      <Campo rotulo={pj ? "CNPJ" : "CPF"} className="md:col-span-2">
        <input
          name="cpf_cnpj"
          inputMode="numeric"
          defaultValue={v("cpf_cnpj")}
          onBlur={conferirDocumento}
          onInput={(e) => { e.currentTarget.setCustomValidity(""); setAvisoDoc(null); }}
          placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"}
          className={inputCls}
        />
        {avisoDoc && <span className="text-xs text-rosa">{avisoDoc}</span>}
      </Campo>
      {pj ? (
        <>
          <Campo rotulo="Nome fantasia" className="md:col-span-2"><input name="nome_fantasia" defaultValue={v("nome_fantasia")} className={inputCls} /></Campo>
          <Campo rotulo="Inscrição estadual" className="md:col-span-2"><input name="inscricao_estadual" defaultValue={v("inscricao_estadual")} className={inputCls} /></Campo>
          <Campo rotulo="Pessoa de contato" className="md:col-span-2"><input name="contato_nome" defaultValue={v("contato_nome")} className={inputCls} /></Campo>
        </>
      ) : (
        <>
          <Campo rotulo="RG" className="md:col-span-2"><input name="rg" defaultValue={v("rg")} className={inputCls} /></Campo>
          <Campo rotulo="Data de nascimento" className="md:col-span-2"><input name="data_nascimento" type="date" defaultValue={v("data_nascimento")} className={inputCls} /></Campo>
          <Campo rotulo="Estado civil" className="md:col-span-2">
            <select name="estado_civil" defaultValue={v("estado_civil")} className={inputCls}>
              <option value="">—</option>
              {ESTADOS_CIVIS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Profissão" className="md:col-span-3"><input name="profissao" defaultValue={v("profissao")} className={inputCls} /></Campo>
          <Campo rotulo="Cônjuge / outra pessoa de contato" className="md:col-span-3"><input name="contato_nome" defaultValue={v("contato_nome")} className={inputCls} /></Campo>
        </>
      )}

      <p className={secaoCls}>Contato</p>
      <Campo rotulo="Celular / WhatsApp" className="md:col-span-2">
        <input name="telefone" type="tel" defaultValue={v("telefone")} onBlur={ao(formatarTelefone)} placeholder="(00) 00000-0000" className={inputCls} />
      </Campo>
      <Campo rotulo="Outro telefone" className="md:col-span-2">
        <input name="telefone2" type="tel" defaultValue={v("telefone2")} onBlur={ao(formatarTelefone)} className={inputCls} />
      </Campo>
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

      <p className={secaoCls}>Endereço</p>
      <Campo rotulo="CEP" className="md:col-span-2">
        <input name="cep" inputMode="numeric" defaultValue={v("cep")} onBlur={ao(formatarCEP)} placeholder="00000-000" className={inputCls} />
      </Campo>
      <Campo rotulo="Rua / avenida" className="md:col-span-4"><input name="endereco" defaultValue={v("endereco")} className={inputCls} /></Campo>
      <Campo rotulo="Número" className="md:col-span-1"><input name="numero" defaultValue={v("numero")} className={inputCls} /></Campo>
      <Campo rotulo="Complemento" className="md:col-span-2"><input name="complemento" defaultValue={v("complemento")} placeholder="Apto, bloco, casa…" className={inputCls} /></Campo>
      <Campo rotulo="Bairro" className="md:col-span-3"><input name="bairro" defaultValue={v("bairro")} className={inputCls} /></Campo>
      <Campo rotulo="Cidade" className="md:col-span-4"><input name="cidade" defaultValue={v("cidade")} className={inputCls} /></Campo>
      <Campo rotulo="UF" className="md:col-span-2">
        <input name="uf" maxLength={2} list="ufs" defaultValue={v("uf")} className={`${inputCls} uppercase`} />
        <datalist id="ufs">{UFS.map((u) => <option key={u} value={u} />)}</datalist>
      </Campo>
      <Campo rotulo="Endereço da obra / entrega (se for outro)" className="md:col-span-6">
        <input name="endereco_obra" defaultValue={v("endereco_obra")} placeholder="Deixe em branco se for o mesmo endereço" className={inputCls} />
      </Campo>

      <p className={secaoCls}>Atendimento</p>
      <Campo rotulo="Vendedor responsável" className="md:col-span-2">
        <select name="vendedor_id" defaultValue={v("vendedor_id")} className={inputCls}>
          <option value="">—</option>
          {parceiros.filter((p) => p.tipo === "vendedor").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Arquiteto / designer" className="md:col-span-2">
        <select name="arquiteto_id" defaultValue={v("arquiteto_id")} className={inputCls}>
          <option value="">—</option>
          {parceiros.filter((p) => p.tipo === "arquiteto").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Indicado por" className="md:col-span-2"><input name="indicado_por" defaultValue={v("indicado_por")} className={inputCls} /></Campo>
      <Campo rotulo="Observações" className="md:col-span-6">
        <textarea name="observacoes" rows={3} defaultValue={v("observacoes")} className={inputCls} />
      </Campo>
      <div className="md:col-span-6">
        <Botao type="submit">Salvar</Botao>
      </div>
    </form>
  );
}
