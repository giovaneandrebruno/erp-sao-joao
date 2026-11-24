import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoCancelar, BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";
import { brl, decimal, pct } from "@/lib/format";
import type { Faixa, Regra } from "@/lib/comissoes";
import { excluirFaixa, excluirRegra, novaRegraEquipe, salvarFaixa, salvarRegra } from "../actions";

const ROTULO_TIPO = { rt: "Por pedido", comercial: "Por vendedor, pela faixa", equipe: "Sobre as vendas do mês" } as const;

function FormRegra({ r }: { r?: Regra }) {
  const comercial = r?.tipo === "comercial";
  return (
    <form action={r ? salvarRegra.bind(null, r.id) : novaRegraEquipe} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Nome *" className="md:col-span-4"><input name="nome" required defaultValue={r?.nome ?? ""} placeholder="Ex.: Conferente" className={inputCls} /></Campo>
      {!comercial && <Campo rotulo="Comissão (%)" className="md:col-span-2"><input name="percentual" inputMode="decimal" defaultValue={r ? decimal(r.percentual) : ""} className={inputCls} /></Campo>}
      {comercial && <input type="hidden" name="percentual" value="0" />}
      {r?.tipo !== "rt" && !comercial && (
        <Campo rotulo="Só a partir de vendas no mês de (R$)" className="md:col-span-3"><input name="minimo_mes" inputMode="decimal" defaultValue={r && Number(r.minimo_mes) ? decimal(r.minimo_mes) : ""} placeholder="0 = sempre" className={inputCls} /></Campo>
      )}
      {(r?.tipo === "rt" || comercial) && <input type="hidden" name="minimo_mes" value={String(r?.minimo_mes ?? 0)} />}
      {r?.tipo !== "rt" && !comercial && (
        <Campo rotulo="Quem recebe" className="md:col-span-3"><input name="pessoa" defaultValue={r?.pessoa ?? ""} placeholder="Ex.: João" className={inputCls} /></Campo>
      )}
      <Campo rotulo="Observação" className="md:col-span-6"><input name="observacao" defaultValue={r?.observacao ?? ""} className={inputCls} /></Campo>
      {r && (
        <label className="flex items-center gap-2 text-sm md:col-span-6">
          <input type="checkbox" name="ativo" defaultChecked={r.ativo} /> Ligada (desmarque para não calcular)
        </label>
      )}
      {!r && <input type="hidden" name="ativo" value="on" />}
      {comercial && <p className="text-xs text-stone-500 md:col-span-6">As porcentagens do comercial ficam nas faixas, logo abaixo na tela.</p>}
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{r ? "Salvar alterações" : "Cadastrar comissão"}</Botao>
        {r && <BotaoCancelar />}
      </div>
    </form>
  );
}

function FormFaixa({ f }: { f?: Faixa }) {
  return (
    <form action={salvarFaixa.bind(null, f?.id ?? null)} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Vendido no mês a partir de (R$) *" className="md:col-span-3"><input name="a_partir_de" required inputMode="decimal" defaultValue={f ? decimal(f.a_partir_de) : ""} placeholder="Ex.: 100000" className={inputCls} /></Campo>
      <Campo rotulo="Comissão (%) *" className="md:col-span-3"><input name="percentual" required inputMode="decimal" defaultValue={f ? decimal(f.percentual) : ""} className={inputCls} /></Campo>
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{f ? "Salvar alterações" : "Cadastrar faixa"}</Botao>
        {f && <BotaoCancelar />}
      </div>
    </form>
  );
}

/** Regras das comissões. Ainda estão em discussão na diretoria, por isso tudo pode ser alterado aqui. */
export default async function RegrasComissaoPage({ searchParams }: PageProps<"/comissoes/regras">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: rb }, { data: fb }] = await Promise.all([
    supabase.from("comissao_regras").select("*").order("ordem"),
    supabase.from("comissao_faixas").select("*").order("a_partir_de"),
  ]);
  const regras = (rb ?? []) as Regra[];
  const faixas = (fb ?? []) as Faixa[];
  const regraEdit = typeof sp.editar === "string" ? regras.find((r) => r.id === sp.editar) : undefined;
  const faixaEdit = typeof sp.faixa === "string" ? faixas.find((f) => f.id === sp.faixa) : undefined;

  return (
    <>
      <Titulo
        sub="As porcentagens usadas na tela Comissões do mês. Mudou a regra? Altere aqui e o cálculo muda na hora."
        acao={
          <JanelaBotao rotulo="Nova comissão de equipe" titulo="Nova comissão de equipe" descricao="Porcentagem sobre as vendas gerais do mês" aviso="Comissão cadastrada">
            <FormRegra />
          </JanelaBotao>
        }
      >
        Regras de comissão
      </Titulo>

      <div className="mb-8">
        <Tabela cabecalho={["Comissão", "Como calcula", "%", "Mínimo no mês", "Quem recebe", ""]} vazio={!regras.length}>
          {regras.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{r.nome} {!r.ativo && <Selo>desligada</Selo>}</div>
                {r.observacao && <div className="mt-0.5 text-xs text-stone-500">{r.observacao}</div>}
              </td>
              <td className="px-4 py-3 text-stone-600">{ROTULO_TIPO[r.tipo]}</td>
              <td className="px-4 py-3 font-mono">{r.tipo === "comercial" ? "pelas faixas" : pct(r.percentual)}</td>
              <td className="px-4 py-3 font-mono">{r.tipo === "comercial" ? (faixas[0] ? brl(faixas[0].a_partir_de) : "—") : Number(r.minimo_mes) ? brl(r.minimo_mes) : "—"}</td>
              <td className="px-4 py-3">{r.tipo === "equipe" ? r.pessoa || <span className="text-stone-400">a definir</span> : <span className="text-stone-500">{r.tipo === "rt" ? "cada arquiteto" : "cada vendedor"}</span>}</td>
              <td className="whitespace-nowrap px-4 py-2">
                <AcoesLinha>
                  <LinkEditar id={r.id} />
                  {r.tipo === "equipe" && <BotaoExcluir acao={excluirRegra.bind(null, r.id)} titulo="Excluir esta comissão?" detalhe={r.nome} aviso="Comissão excluída" />}
                </AcoesLinha>
              </td>
            </tr>
          ))}
        </Tabela>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Faixas do comercial</h2>
          <p className="text-sm text-stone-500">Vale a porcentagem da maior faixa que o vendedor atingiu no mês, sobre tudo que ele vendeu. Abaixo da primeira faixa, não tem comissão.</p>
        </div>
        <JanelaBotao rotulo="Nova faixa" titulo="Nova faixa do comercial" variante="secundario" aviso="Faixa cadastrada" largura="sm">
          <FormFaixa />
        </JanelaBotao>
      </div>
      <Tabela cabecalho={["Vendido no mês", "Comissão", ""]} vazio={!faixas.length}>
        {faixas.map((f, i) => (
          <tr key={f.id}>
            <td className="px-4 py-3 font-mono">{faixas[i + 1] ? <>de {brl(f.a_partir_de)} até {brl(Number(faixas[i + 1].a_partir_de) - 0.01)}</> : <>a partir de {brl(f.a_partir_de)}</>}</td>
            <td className="px-4 py-3 font-mono font-semibold">{pct(f.percentual)}</td>
            <td className="whitespace-nowrap px-4 py-2">
              <AcoesLinha>
                <LinkEditar id={f.id} param="faixa" />
                <BotaoExcluir acao={excluirFaixa.bind(null, f.id)} titulo="Excluir esta faixa?" detalhe={`${pct(f.percentual)} a partir de ${brl(f.a_partir_de)}`} aviso="Faixa excluída" />
              </AcoesLinha>
            </td>
          </tr>
        ))}
      </Tabela>

      <Cartao className="mt-8">
        <p className="text-sm text-stone-600">
          A comissão do vendedor e a RT que aparecem no orçamento e na previsão de lucro continuam vindo de cada orçamento (Configurações traz o padrão). Esta tela calcula o que cada pessoa recebe no fim do mês.
        </p>
      </Cartao>

      {regraEdit && (
        <JanelaEditar key={regraEdit.id} titulo="Alterar comissão" descricao={ROTULO_TIPO[regraEdit.tipo]} aviso="Comissão salva">
          <FormRegra r={regraEdit} />
        </JanelaEditar>
      )}
      {faixaEdit && (
        <JanelaEditar key={faixaEdit.id} param="faixa" titulo="Alterar faixa" aviso="Faixa salva" largura="sm">
          <FormFaixa f={faixaEdit} />
        </JanelaEditar>
      )}
    </>
  );
}
