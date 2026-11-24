import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Indicador, Selo, Titulo, estiloBotao, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoExcluir } from "@/components/acoes";
import { Icone } from "@/components/icones";
import { brl, data, dataHora } from "@/lib/format";
import { enderecoCompleto, idade } from "@/lib/cliente";
import { ehUuid } from "@/lib/curriculos";
import {
  ARQUIVOS_ESSENCIAIS, BUCKET_FUNCIONARIOS, TIPOS_ARQUIVO_FUNCIONARIO, diasAteAniversario, diasDoAtestado, diasNoPeriodo, hojeSP,
  limitesDoMes, mesValido, somarDias, tamanhoLegivel, tempoDeCasa, type SituacaoFuncionario, type TipoArquivoFuncionario,
} from "@/lib/funcionarios";
import { horasLegiveis } from "@/lib/ponto";
import { FormFuncionario } from "../form";
import { FormArquivo, FormAtestado } from "../arquivos-form";
import { ImportarPonto } from "../importar-ponto";
import { SeletorSituacaoFuncionario } from "../situacao";
import { FormDiaDePonto, ListaDeAtestados, PontoDoMes, TrocarMes, type AtestadoComLink } from "../componentes";
import {
  adicionarAnotacaoFuncionario, editarAnotacaoFuncionario, excluirAnotacaoFuncionario, excluirArquivo, excluirFuncionario,
} from "../actions";

const rotuloArquivo = (t: string) => TIPOS_ARQUIVO_FUNCIONARIO[t as TipoArquivoFuncionario] ?? "Outro";

/** Ficha completa do funcionário: dados, arquivos, anotações, atestados e relógio ponto. */
export default async function FuncionarioPage({ params, searchParams }: PageProps<"/funcionarios/[id]">) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const sp = await searchParams;
  const supabase = await createClient(); // antes de ler a data de hoje
  const hoje = hojeSP();
  const mes = mesValido(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);
  const [{ data: f }, { data: documentos }, { data: anotacoes }, { data: atestados }, { data: ponto }, { data: todos }] = await Promise.all([
    supabase.from("funcionarios").select("*").eq("id", id).maybeSingle(),
    supabase.from("funcionario_documentos").select("id, tipo, descricao, nome_arquivo, caminho, tamanho, enviado_por_nome, atualizado_em").eq("funcionario_id", id).order("criado_em", { ascending: false }),
    supabase.from("funcionario_anotacoes").select("id, texto, criado_por_nome, alterado_por_nome, criado_em, atualizado_em").eq("funcionario_id", id).order("criado_em", { ascending: false }),
    supabase.from("funcionario_atestados").select("*").eq("funcionario_id", id).order("data_inicio", { ascending: false }),
    supabase.from("funcionario_ponto").select("id, dia, marcacoes, minutos_trabalhados, observacao, origem").eq("funcionario_id", id).gte("dia", inicio).lte("dia", fim).order("dia"),
    supabase.from("funcionarios").select("id, nome, apelido, matricula, cpf, pis, cargo, setor").order("nome"),
  ]);
  if (!f) notFound();

  // links para abrir os arquivos da pasta privada (valem 1 hora)
  const caminhos = [...(documentos ?? []).map((d) => d.caminho), ...(atestados ?? []).map((a) => a.caminho).filter(Boolean)] as string[];
  const { data: links } = caminhos.length ? await supabase.storage.from(BUCKET_FUNCIONARIOS).createSignedUrls(caminhos, 3600) : { data: [] };
  const urlDe = (c: string | null) => (c ? links?.find((l) => l.path === c)?.signedUrl ?? null : null);
  const docs = (documentos ?? []).map((d) => ({ ...d, url: urlDe(d.caminho) }));
  const ates: AtestadoComLink[] = (atestados ?? []).map((a) => ({ ...a, url: urlDe(a.caminho) }));

  const situacao = (f.situacao ?? "ativo") as SituacaoFuncionario;
  const anos = idade(f.data_nascimento);
  const niver = diasAteAniversario(f.data_nascimento, hoje);
  const doze = somarDias(hoje, -365);
  const ates12 = ates.filter((a) => a.data_fim >= doze);
  const dias12 = ates12.reduce((t, a) => t + diasNoPeriodo(a.data_inicio, a.data_fim, doze, hoje), 0);
  const minutosMes = (ponto ?? []).reduce((t, d) => t + (d.minutos_trabalhados ?? 0), 0);
  const tem = new Set(docs.map((d) => d.tipo));
  const grupos = (Object.keys(TIPOS_ARQUIVO_FUNCIONARIO) as TipoArquivoFuncionario[])
    .map((t) => ({ tipo: t, docs: docs.filter((d) => (Object.hasOwn(TIPOS_ARQUIVO_FUNCIONARIO, d.tipo) ? d.tipo : "outro") === t) }))
    .filter((g) => g.docs.length);
  const unicos = (k: "cargo" | "setor") => [...new Set((todos ?? []).map((x) => x[k]).filter(Boolean) as string[])].sort();
  const exameVencido = f.proximo_exame && f.proximo_exame < hoje;
  const cnhVencida = f.cnh_validade && f.cnh_validade < hoje;

  const blocos: { titulo: string; itens: [string, React.ReactNode, boolean?][] }[] = [
    {
      titulo: "Dados pessoais",
      itens: [
        ["CPF", f.cpf], ["RG", [f.rg, f.rg_orgao].filter(Boolean).join(" · ") || null],
        ["Nascimento", f.data_nascimento ? `${data(f.data_nascimento)}${anos !== null ? ` (${anos} anos)` : ""}` : null],
        ["Estado civil", f.estado_civil], ["Escolaridade", f.escolaridade], ["Nome da mãe", f.nome_mae], ["Nome do pai", f.nome_pai],
      ],
    },
    {
      titulo: "Documentos de trabalho",
      itens: [
        ["PIS / NIS", f.pis], ["Carteira de trabalho", f.ctps], ["Título de eleitor", f.titulo_eleitor],
        ["CNH", f.cnh ? (
          <span className="flex flex-wrap items-center gap-2">
            {[f.cnh, f.cnh_categoria && `cat. ${f.cnh_categoria}`].filter(Boolean).join(" · ")}
            {f.cnh_validade && <Selo cor={cnhVencida ? "red" : "stone"}>{cnhVencida ? "vencida em" : "vale até"} {data(f.cnh_validade)}</Selo>}
          </span>
        ) : null],
      ],
    },
    {
      titulo: "Contato e endereço",
      itens: [
        ["Celular", f.telefone], ["Outro telefone", f.telefone2],
        ["E-mail", f.email ? <a href={`mailto:${f.email}`} className="text-madeira-800 hover:underline">{f.email}</a> : null],
        ["Endereço", enderecoCompleto(f) || null, true],
        ["Em caso de emergência", [f.contato_emergencia_nome, f.contato_emergencia_parentesco && `(${f.contato_emergencia_parentesco})`, f.contato_emergencia_telefone].filter(Boolean).join(" ") || null, true],
      ],
    },
    {
      titulo: "Trabalho",
      itens: [
        ["Cargo / função", f.cargo], ["Setor", f.setor], ["Tipo de contrato", f.tipo_contrato], ["Matrícula no relógio", f.matricula],
        ["Admissão", f.data_admissao ? data(f.data_admissao) : null],
        ...(situacao === "desligado" ? [["Saída", f.data_demissao ? data(f.data_demissao) : null], ["Motivo da saída", f.motivo_demissao]] as [string, React.ReactNode][] : []),
        ["Salário", f.salario != null ? brl(f.salario) : null], ["Horas por semana", f.horas_semana != null ? `${String(f.horas_semana).replace(".", ",")} h` : null],
        ["Horário", f.horario, true],
      ],
    },
    {
      titulo: "Banco",
      itens: [["Banco", f.banco], ["Agência", f.agencia], ["Conta", f.conta], ["Pix", f.pix]],
    },
    {
      titulo: "Saúde e uniforme",
      itens: [
        ["Tipo sanguíneo", f.tipo_sanguineo], ["Alergias / cuidados", f.alergias],
        ["Último exame (ASO)", f.ultimo_exame ? data(f.ultimo_exame) : null],
        ["Próximo exame", f.proximo_exame ? <span className="flex flex-wrap items-center gap-2">{data(f.proximo_exame)}{exameVencido && <Selo cor="red">vencido</Selo>}</span> : null],
        ["Camisa", f.tamanho_camisa], ["Calça", f.tamanho_calca], ["Calçado / botina", f.tamanho_calcado],
      ],
    },
  ];

  const funcsParaPonto = (todos ?? []).map(({ id: i, nome, apelido, matricula, cpf, pis }) => ({ id: i, nome, apelido, matricula, cpf, pis }));

  return (
    <>
      <div className="mb-2 text-sm"><Link href="/funcionarios" className="text-madeira-700 hover:underline">← Todos os funcionários</Link></div>
      <Titulo
        sub={[f.apelido && `“${f.apelido}”`, f.cargo, f.setor].filter(Boolean).join(" · ") || undefined}
        acao={
          <div className="flex flex-wrap gap-2">
            <JanelaBotao rotulo="Editar cadastro" titulo="Editar funcionário" descricao={f.nome} variante="secundario" icone="lapis" largura="xl">
              <FormFuncionario funcionario={f} cargos={unicos("cargo")} setores={unicos("setor")} />
            </JanelaBotao>
            <BotaoExcluir
              acao={excluirFuncionario.bind(null, id)}
              rotulo="Excluir"
              titulo="Excluir este funcionário?"
              detalhe={<><strong>{f.nome}</strong>. Os arquivos, atestados, ponto e anotações também são apagados. Se a pessoa saiu da empresa, prefira mudar a situação para &quot;Desligado&quot;.</>}
              aviso="Funcionário excluído"
              depois="/funcionarios"
            />
          </div>
        }
      >
        {f.nome}
      </Titulo>

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-xs text-stone-500">Situação:</span>
        <SeletorSituacaoFuncionario id={id} situacao={situacao} />
        {niver !== null && niver <= 30 && situacao !== "desligado" && <Selo cor={niver === 0 ? "green" : "blue"}>{niver === 0 ? "Faz aniversário hoje!" : `Aniversário em ${niver} ${niver === 1 ? "dia" : "dias"}`}</Selo>}
        {exameVencido && situacao !== "desligado" && <Selo cor="red">Exame médico vencido</Selo>}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Tempo de casa" valor={tempoDeCasa(f.data_admissao, situacao === "desligado" ? f.data_demissao : null) ?? "—"} sub={f.data_admissao ? `desde ${data(f.data_admissao)}` : "informe a data de admissão"} />
        <Indicador rotulo="Atestados (12 meses)" valor={ates12.length} sub={`${dias12} ${dias12 === 1 ? "dia" : "dias"} fora`} />
        <Indicador rotulo="Horas no ponto" valor={horasLegiveis(minutosMes)} sub={`em ${mes.slice(5)}/${mes.slice(0, 4)}`} />
        <Indicador rotulo="Arquivos na pasta" valor={docs.length} sub={`${anotacoes?.length ?? 0} ${anotacoes?.length === 1 ? "anotação" : "anotações"}`} />
      </div>

      <Cartao className="mb-8">
        <div className="grid gap-6">
          {blocos.map((g) => (
            <div key={g.titulo}>
              <h3 className="mb-3 text-sm font-semibold text-stone-800">{g.titulo}</h3>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {g.itens.map(([rotulo, valor, largo]) => (
                  <div key={rotulo} className={largo ? "sm:col-span-2" : ""}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{rotulo}</dt>
                    <dd className="mt-1 whitespace-pre-line text-stone-800">{valor || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          {f.observacoes && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-stone-800">Observações</h3>
              <p className="whitespace-pre-line text-sm text-stone-800">{f.observacoes}</p>
            </div>
          )}
        </div>
      </Cartao>

      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Icone nome="pasta" className="h-5 w-5 text-madeira-700" /> Pasta do funcionário</h2>
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {ARQUIVOS_ESSENCIAIS.map((t) => (
                <Selo key={t} cor={tem.has(t) ? "green" : "amber"}>{rotuloArquivo(t).replace(/ \(.*\)$/, "")}{tem.has(t) ? "" : ": falta"}</Selo>
              ))}
            </div>
            <JanelaBotao rotulo="Adicionar arquivo" titulo="Adicionar arquivo à pasta" descricao={f.nome} largura="md" aviso={null}>
              <FormArquivo funcionarioId={id} tipoInicial={ARQUIVOS_ESSENCIAIS.find((t) => !tem.has(t)) ?? "outro"} />
            </JanelaBotao>
          </div>
          {grupos.length ? (
            <div className="grid gap-5">
              {grupos.map((g) => (
                <section key={g.tipo}>
                  <h4 className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">
                    <Icone nome="pasta" className="h-3.5 w-3.5 text-madeira-600" /> {rotuloArquivo(g.tipo)} <span className="text-stone-400">({g.docs.length})</span>
                  </h4>
                  <ul className="divide-y divide-stone-100">
                    {g.docs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-madeira-50 text-madeira-700 ring-1 ring-inset ring-madeira-200">
                          <Icone nome="documento" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          {d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-madeira-800 hover:underline">{d.nome_arquivo}</a> : <span className="block truncate text-sm font-medium">{d.nome_arquivo}</span>}
                          <div className="mt-0.5 text-xs text-stone-500">
                            {d.descricao && <>{d.descricao} · </>}
                            {tamanhoLegivel(d.tamanho) && <>{tamanhoLegivel(d.tamanho)} · </>}
                            {dataHora(d.atualizado_em)}{d.enviado_por_nome ? `, por ${d.enviado_por_nome}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {d.url && <a href={d.url} target="_blank" rel="noreferrer" className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Abrir</a>}
                          <JanelaBotao rotulo="Alterar" titulo="Alterar arquivo" descricao={d.nome_arquivo} variante="secundario" icone={null} largura="md" aviso={null} className="!px-3 !py-1.5">
                            <FormArquivo funcionarioId={id} arquivo={d} />
                          </JanelaBotao>
                          <BotaoExcluir acao={excluirArquivo.bind(null, d.id)} titulo="Excluir este arquivo?" detalhe={<strong>{d.nome_arquivo}</strong>} aviso="Arquivo excluído" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
              A pasta está vazia. Coloque aqui os documentos pessoais, a carteira de trabalho, o contrato, os exames, certificados, holerites e tudo o que for importante.
            </p>
          )}
        </Cartao>

        <Cartao className="self-start">
          <h3 className="mb-3 text-sm font-semibold text-stone-800">Anotações</h3>
          <form action={adicionarAnotacaoFuncionario.bind(null, id)} className="mb-4 grid gap-2">
            <textarea name="texto" required rows={3} placeholder="Ex.: pediu para sair mais cedo dia 20, combinado banco de horas…" className={inputCls} />
            <button className={`${estiloBotao.primario} justify-self-end`}>Adicionar anotação</button>
          </form>
          {anotacoes?.length ? (
            <ul className="grid gap-3">
              {anotacoes.map((a) => (
                <li key={a.id} className="rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
                  <p className="whitespace-pre-line text-sm text-stone-800">{a.texto}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-stone-500">
                      {a.criado_por_nome ?? "Equipe"} · {dataHora(a.criado_em)}
                      {a.alterado_por_nome && a.atualizado_em !== a.criado_em ? ` · alterada por ${a.alterado_por_nome}` : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <JanelaBotao rotulo="Alterar" titulo="Alterar anotação" variante="link" icone={null} largura="sm" aviso="Anotação alterada" className="!text-xs">
                        <form action={editarAnotacaoFuncionario.bind(null, a.id, id)} className="grid gap-3">
                          <textarea name="texto" required rows={6} defaultValue={a.texto} className={inputCls} />
                          <button className={`${estiloBotao.primario} justify-self-end`}>Salvar</button>
                        </form>
                      </JanelaBotao>
                      <BotaoExcluir acao={excluirAnotacaoFuncionario.bind(null, a.id, id)} titulo="Excluir esta anotação?" aviso="Anotação excluída" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-stone-400">Nenhuma anotação ainda.</p>
          )}
        </Cartao>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Atestados e afastamentos</h2>
        <JanelaBotao rotulo="Lançar atestado" titulo="Lançar atestado" descricao={f.nome} largura="md" aviso={null}>
          <FormAtestado funcionarioId={id} />
        </JanelaBotao>
      </div>
      <Cartao className="mb-8">
        {ates.length > 0 && (
          <p className="mb-2 text-xs text-stone-500">
            {ates.length} {ates.length === 1 ? "atestado" : "atestados"} no total, somando {ates.reduce((t, a) => t + diasDoAtestado(a.data_inicio, a.data_fim), 0)} dias.
          </p>
        )}
        <ListaDeAtestados atestados={ates} />
      </Cartao>

      <div id="ponto" className="mb-3 flex scroll-mt-6 flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Relógio ponto</h2>
        <div className="flex flex-wrap items-center gap-2">
          <TrocarMes mes={mes} base={`/funcionarios/${id}`} ancora="#ponto" />
          <JanelaBotao rotulo="Lançar dia" titulo="Lançar um dia de ponto" descricao={f.nome} variante="secundario" largura="md" aviso="Dia salvo">
            <FormDiaDePonto funcionarioId={id} />
          </JanelaBotao>
          <JanelaBotao rotulo="Importar planilha do ponto" titulo="Importar planilha do relógio ponto" descricao={f.nome} icone="importar" largura="lg" aviso={null}>
            <ImportarPonto funcionarios={funcsParaPonto} soDe={id} />
          </JanelaBotao>
        </div>
      </div>
      <Cartao className="mb-8">
        <PontoDoMes funcionarioId={id} mes={mes} dias={(ponto ?? []) as never} atestados={ates} />
        <p className="mt-4 text-xs text-stone-500">
          Se o relógio só gera PDF, guarde o relatório na pasta do funcionário como &quot;Relatório do relógio ponto&quot;. Para o sistema somar as horas, exporte em planilha .xlsx.
        </p>
      </Cartao>
    </>
  );
}
