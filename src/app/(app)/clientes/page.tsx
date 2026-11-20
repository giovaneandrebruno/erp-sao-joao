import Link from "next/link";
import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Tabela, Titulo, VerMais, estiloBotao, inputCls, quantidadeDaLista } from "@/components/ui";
import { SITUACOES, digitos, type Situacao } from "@/lib/cliente";
import { SeletorSituacao } from "./situacao";
import { FormCliente } from "./form";
import { excluirCliente } from "./actions";
import { AcoesLinha, BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const sp = await searchParams;
  const { busca } = sp;
  const situacao = typeof sp.situacao === "string" && Object.hasOwn(SITUACOES, sp.situacao) ? (sp.situacao as Situacao) : null;
  const qtd = quantidadeDaLista(sp.qtd);
  const termo = typeof busca === "string" ? busca.trim() : "";
  const supabase = await createClient();
  let consulta = supabase
    .from("clientes")
    .select("id, nome, telefone, endereco, numero, complemento, bairro, cidade, uf, situacao", { count: "exact" })
    .order("nome")
    .limit(qtd);
  const seguro = termo.replace(/[,()%*"\\]/g, " ").trim();
  if (seguro) {
    const filtros = [`nome.ilike.%${seguro}%`, `nome_fantasia.ilike.%${seguro}%`, `telefone.ilike.%${seguro}%`, `email.ilike.%${seguro}%`, `cpf_cnpj.ilike.%${seguro}%`, `endereco.ilike.%${seguro}%`, `bairro.ilike.%${seguro}%`, `cidade.ilike.%${seguro}%`];
    // CPF/CNPJ digitado só com números também acha o cadastro escrito com pontos
    const doc = digitos(seguro);
    if (doc.length >= 3 && /^[\d\s./-]+$/.test(seguro)) filtros.push(`cpf_cnpj.ilike.%${doc.split("").join("%")}%`);
    consulta = consulta.or(filtros.join(","));
  }
  if (situacao) consulta = consulta.eq("situacao", situacao);
  const { data: clientes = [], count } = await consulta;
  const editar = typeof sp.editar === "string" ? sp.editar : null;
  const [{ data: emEdicao }, { data: parceiros }] = editar
    ? await Promise.all([
        supabase.from("clientes").select("*").eq("id", editar).maybeSingle(),
        supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
      ])
    : [{ data: null }, { data: null }];

  return (
    <>
      <Titulo acao={<FerramentasImportacao area="clientes" extra={<BotaoLink href="/clientes/novo">Novo cliente</BotaoLink>} />}>Clientes</Titulo>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="busca" defaultValue={termo} placeholder="Buscar por nome, telefone, e-mail, CPF/CNPJ ou endereço" className={`${inputCls} w-full max-w-md`} />
        <select name="situacao" defaultValue={situacao ?? ""} className={inputCls}>
          <option value="">Todas as situações</option>
          {(Object.keys(SITUACOES) as Situacao[]).map((k) => <option key={k} value={k}>Só {SITUACOES[k].charAt(0).toLowerCase()}{SITUACOES[k].slice(1)}</option>)}
        </select>
        <button className={estiloBotao.secundario}>Filtrar</button>
      </form>
      <Tabela cabecalho={["Nome", "Situação", "Telefone", "Endereço", "Cidade", ""]} vazio={!clientes?.length}>
        {clientes?.map((c) => {
          const s = (c.situacao ?? "lead") as Situacao;
          return (
            <tr key={c.id} className="hover:bg-stone-50">
              <td className="px-4 py-3"><Link href={`/clientes/${c.id}`} className="font-medium text-madeira-800 hover:underline">{c.nome}</Link></td>
              <td className="px-4 py-3"><SeletorSituacao id={c.id} situacao={s} /></td>
              <td className="px-4 py-3">{c.telefone ?? "—"}</td>
              <td className="px-4 py-3">{[[c.endereco, c.numero, c.complemento].filter(Boolean).join(", "), c.bairro].filter(Boolean).join(" - ") || "—"}</td>
              <td className="px-4 py-3">{c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "—"}</td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <LinkEditar id={c.id} />
                  <BotaoExcluir
                    acao={excluirCliente.bind(null, c.id)}
                    titulo="Excluir este cliente?"
                    detalhe={<strong>{c.nome}</strong>}
                    aviso="Cliente excluído"
                  />
                </AcoesLinha>
              </td>
            </tr>
          );
        })}
      </Tabela>
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Editar cliente" descricao={emEdicao.nome} aviso="Cliente salvo" largura="xl">
          <FormCliente cliente={emEdicao} parceiros={parceiros ?? []} naLista />
        </JanelaEditar>
      )}
      <VerMais mostrando={clientes?.length ?? 0} total={count} rotulo="clientes" parametros={sp} />
    </>
  );
}
