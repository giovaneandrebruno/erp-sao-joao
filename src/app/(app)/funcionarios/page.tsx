import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Indicador, Selo, Tabela, Titulo, VerMais, estiloBotao, inputCls, quantidadeDaLista } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoExcluir } from "@/components/acoes";
import { data } from "@/lib/format";
import {
  COR_SITUACAO_FUNCIONARIO, ROTULO_CURTO_FUNCIONARIO, SITUACOES_FUNCIONARIO, diasAteAniversario, hojeSP, somarDias, tempoDeCasa, type SituacaoFuncionario,
} from "@/lib/funcionarios";
import { FormFuncionario } from "./form";
import { excluirFuncionario } from "./actions";

/** Lista dos funcionários. Começa mostrando quem está na empresa (os desligados ficam no filtro). */
export default async function FuncionariosPage({ searchParams }: PageProps<"/funcionarios">) {
  const sp = await searchParams;
  const termo = typeof sp.busca === "string" ? sp.busca.trim() : "";
  const filtro = typeof sp.situacao === "string" ? sp.situacao : "na_empresa";
  const qtd = quantidadeDaLista(sp.qtd);
  const supabase = await createClient();
  let consulta = supabase
    .from("funcionarios")
    .select("id, nome, apelido, situacao, cargo, setor, telefone, data_admissao, data_demissao, data_nascimento, proximo_exame", { count: "exact" })
    .order("nome")
    .limit(qtd);
  if (filtro === "na_empresa") consulta = consulta.neq("situacao", "desligado");
  else if (Object.hasOwn(SITUACOES_FUNCIONARIO, filtro)) consulta = consulta.eq("situacao", filtro);
  const seguro = termo.replace(/[,()%*"\\]/g, " ").trim();
  if (seguro) consulta = consulta.or(["nome", "apelido", "cargo", "setor", "telefone", "cpf", "matricula"].map((c) => `${c}.ilike.%${seguro}%`).join(","));

  const [{ data: funcionarios, count }, { data: todos }] = await Promise.all([
    consulta,
    supabase.from("funcionarios").select("situacao, cargo, setor, data_nascimento, proximo_exame"),
  ]);
  const hoje = hojeSP();
  const naEmpresa = (todos ?? []).filter((f) => f.situacao !== "desligado");
  const aniversariantes = naEmpresa.filter((f) => f.data_nascimento?.slice(5, 7) === hoje.slice(5, 7)).length;
  const exameVencendo = naEmpresa.filter((f) => f.proximo_exame && f.proximo_exame <= somarDias(hoje, 30)).length;
  const unicos = (k: "cargo" | "setor") => [...new Set((todos ?? []).map((f) => f[k]).filter(Boolean) as string[])].sort();

  return (
    <>
      <Titulo
        sub="Dados pessoais, arquivos, atestados, relógio ponto e anotações de cada pessoa. Só o administrador vê esta aba."
        acao={
          <JanelaBotao rotulo="Cadastrar funcionário" titulo="Cadastrar funcionário" descricao="Só o nome é obrigatório. O resto pode ser preenchido aos poucos." largura="xl" abrirAoCarregar={sp.novo === "1"} aviso={null}>
            <FormFuncionario cargos={unicos("cargo")} setores={unicos("setor")} />
          </JanelaBotao>
        }
      >
        Funcionários
      </Titulo>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Na empresa" valor={naEmpresa.length} sub={`${naEmpresa.filter((f) => f.situacao === "ativo").length} trabalhando agora`} />
        <Indicador rotulo="Férias ou afastados" valor={naEmpresa.filter((f) => f.situacao === "ferias" || f.situacao === "afastado").length} />
        <Indicador rotulo="Aniversariantes do mês" valor={aniversariantes} />
        <Indicador rotulo="Exame médico vencendo" valor={exameVencendo} sub="nos próximos 30 dias ou já vencido" cor={exameVencendo ? "vermelho" : undefined} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="busca" defaultValue={termo} placeholder="Buscar por nome, cargo, setor, telefone, CPF ou matrícula" className={`${inputCls} w-full max-w-md`} />
        <select name="situacao" defaultValue={filtro} className={`${inputCls} w-auto`}>
          <option value="na_empresa">Na empresa (sem os desligados)</option>
          {Object.entries(ROTULO_CURTO_FUNCIONARIO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          <option value="todos">Todos</option>
        </select>
        <button className={estiloBotao.secundario}>Filtrar</button>
      </form>

      <Tabela cabecalho={["Nome", "Cargo / setor", "Situação", "Celular", "Na empresa desde", "Aniversário", ""]} vazio={!funcionarios?.length}>
        {funcionarios?.map((f) => {
          const sit = (f.situacao ?? "ativo") as SituacaoFuncionario;
          const niver = diasAteAniversario(f.data_nascimento, hoje);
          const exame = f.situacao !== "desligado" && f.proximo_exame && f.proximo_exame <= somarDias(hoje, 30);
          return (
            <tr key={f.id}>
              <td className="px-4 py-3">
                <Link href={`/funcionarios/${f.id}`} className="font-medium text-madeira-800 hover:underline">{f.nome}</Link>
                {f.apelido && <div className="mt-0.5 text-xs text-stone-500">{f.apelido}</div>}
                {exame && <div className="mt-1"><Selo cor="red">Exame {f.proximo_exame! < hoje ? "vencido" : "vencendo"}</Selo></div>}
              </td>
              <td className="px-4 py-3">
                <div>{f.cargo ?? "—"}</div>
                {f.setor && <div className="mt-0.5 text-xs text-stone-500">{f.setor}</div>}
              </td>
              <td className="px-4 py-3"><Selo cor={COR_SITUACAO_FUNCIONARIO[sit]}>{ROTULO_CURTO_FUNCIONARIO[sit]}</Selo></td>
              <td className="px-4 py-3">{f.telefone ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3">
                {f.data_admissao ? (
                  <>
                    <div>{data(f.data_admissao)}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{tempoDeCasa(f.data_admissao, f.situacao === "desligado" ? f.data_demissao : null)}</div>
                  </>
                ) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {f.data_nascimento ? (
                  <>
                    <div>{data(f.data_nascimento).slice(0, 5)}</div>
                    {niver !== null && niver <= 30 && f.situacao !== "desligado" && <div className="mt-1"><Selo cor={niver === 0 ? "green" : "blue"}>{niver === 0 ? "Hoje!" : niver === 1 ? "Amanhã" : `Em ${niver} dias`}</Selo></div>}
                  </>
                ) : "—"}
              </td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <Link href={`/funcionarios/${f.id}`} className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Abrir ficha</Link>
                  <BotaoExcluir
                    acao={excluirFuncionario.bind(null, f.id)}
                    titulo="Excluir este funcionário?"
                    detalhe={<><strong>{f.nome}</strong>. Os arquivos, atestados, ponto e anotações também são apagados. Se a pessoa saiu da empresa, prefira mudar a situação para &quot;Desligado&quot;.</>}
                    aviso="Funcionário excluído"
                  />
                </AcoesLinha>
              </td>
            </tr>
          );
        })}
      </Tabela>
      <VerMais mostrando={funcionarios?.length ?? 0} total={count} rotulo="funcionários" parametros={sp} />
    </>
  );
}

