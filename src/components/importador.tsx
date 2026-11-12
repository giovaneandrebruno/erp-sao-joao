"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Botao, Erro, inputCls } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { AREAS, acharCabecalho, acharLegenda, avaliarAba, converter, mapearColunas, normalizar, type Area } from "@/lib/importacao";
import { EXT_IA, EXT_PLANILHA, lerPlanilhaArquivo, type Aba } from "@/lib/planilha";
import { guardarArquivo, importarDados, limparArea, type Resumo } from "@/app/(app)/importar/actions";

type Etapa =
  | { tipo: "escolher" }
  | { tipo: "lendo"; texto: string }
  | { tipo: "mapear"; abas: Aba[]; aba: number; linhaCab: number; mapa: (string | null)[]; observacao?: string }
  | { tipo: "guardado"; texto: string }
  | { tipo: "pronto"; resumo: Resumo };

type Arquivo = { nome: string; caminho: string | null; tipo: string | null };

function Janela({ titulo, sub, fechar, children, largo }: { titulo: string; sub?: string; fechar: () => void; children: ReactNode; largo?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#16123a]/40 p-4 backdrop-blur-sm md:p-10" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className={`w-full ${largo ? "max-w-5xl" : "max-w-lg"} rounded-2xl bg-white p-6 shadow-[0_30px_80px_-20px_rgb(22_18_58/0.5)]`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{titulo}</h3>
            {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
          </div>
          <button type="button" onClick={fechar} className="rounded-full px-2 text-xl leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const nomeSeguro = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-80);

const IconeUpload = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M10 13V3m0 0L6 7m4-4 4 4M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Botão "Importar arquivo" + janela de leitura, mapeamento de colunas e confirmação. */
export function Importador({ area, rotulo = "Importar arquivo" }: { area: Area; rotulo?: string }) {
  const def = AREAS[area];
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "escolher" });
  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [modo, setModo] = useState<"atualizar" | "somar">("atualizar");
  const [tipoPadrao, setTipoPadrao] = useState<"pagar" | "receber">("pagar");
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [juntar, setJuntar] = useState(true);
  const [pendente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  function fechar() {
    setAberto(false);
    setEtapa({ tipo: "escolher" });
    setArquivo(null);
    setErro(null);
  }

  async function enviarAoStorage(f: File) {
    const caminho = `${area}/${Date.now()}-${nomeSeguro(f.name)}`;
    const { error } = await createClient().storage.from("importacoes").upload(caminho, f, { contentType: f.type || undefined });
    return error ? null : caminho;
  }

  function prepararMapa(abas: Aba[], aba: number, linhaCab?: number, observacao?: string) {
    const linhas = abas[aba]?.linhas ?? [];
    const cab = linhaCab ?? acharCabecalho(area, linhas);
    setEtapa({ tipo: "mapear", abas, aba, linhaCab: cab, mapa: mapearColunas(area, linhas[cab] ?? [], linhas.slice(cab + 1, cab + 80)), observacao });
  }

  async function receber(f: File | undefined) {
    if (!f) return;
    setErro(null);
    if (f.size > 50 * 1024 * 1024) { setErro("O arquivo passa de 50 MB."); return; }
    setEtapa({ tipo: "lendo", texto: "Enviando o arquivo…" });
    const caminho = await enviarAoStorage(f);
    const info: Arquivo = { nome: f.name, caminho, tipo: f.type || f.name.split(".").pop() || null };
    setArquivo(info);
    try {
      if (EXT_PLANILHA.test(f.name) || /\.xls$/i.test(f.name)) {
        setEtapa({ tipo: "lendo", texto: "Lendo a planilha…" });
        const abas = (await lerPlanilhaArquivo(f)).filter((a) => a.linhas.length);
        if (!abas.length) throw new Error("A planilha está vazia.");
        // a aba que mais parece com o que esta área espera; no empate, a com mais linhas
        const notas = abas.map((a) => avaliarAba(area, a.linhas).nota);
        const melhor = abas.reduce((m, a, i) => (notas[i] > notas[m] || (notas[i] === notas[m] && a.linhas.length > abas[m].linhas.length) ? i : m), 0);
        prepararMapa(abas, melhor);
      } else if (EXT_IA.test(f.name)) {
        if (!caminho) throw new Error("Não consegui enviar o arquivo. Tente de novo.");
        setEtapa({ tipo: "lendo", texto: "Lendo o documento e organizando os dados… isso pode levar até um minuto." });
        const r = await fetch("/api/importar/ler", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caminho, area }) });
        const dados = await r.json().catch(() => ({ erro: "Falha na leitura." }));
        if (!r.ok) {
          await guardarArquivo(area, f.name, caminho, info.tipo);
          setEtapa({ tipo: "guardado", texto: dados.erro ?? "Não deu para ler o arquivo, mas ele ficou guardado." });
          return;
        }
        const linhas = [dados.cabecalho as string[], ...(dados.linhas as string[][])];
        prepararMapa([{ nome: f.name, linhas }], 0, 0, dados.observacao);
      } else {
        if (!caminho) throw new Error("Não consegui enviar o arquivo. Tente de novo.");
        const e = await guardarArquivo(area, f.name, caminho, info.tipo);
        if (e) throw new Error(e);
        setEtapa({ tipo: "guardado", texto: "Esse tipo de arquivo não tem dados para ler, então ele ficou guardado como referência em Importar arquivos." });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
      setEtapa({ tipo: "escolher" });
    }
  }

  const mapeamento = etapa.tipo === "mapear" ? etapa : null;
  const linhasAba = mapeamento ? mapeamento.abas[mapeamento.aba].linhas : [];
  const cabecalho = mapeamento ? (linhasAba[mapeamento.linhaCab] ?? []).map((c, i) => c || `Coluna ${i + 1}`) : [];
  // outras abas com as mesmas colunas (ex.: "em andamento" e "concluídos") entram juntas
  const assinatura = (l: string[] | undefined) => (l ?? []).map((c) => normalizar(c ?? "")).join("|");
  const abasIguais = mapeamento
    ? mapeamento.abas
        .map((a, i) => ({ a, i, linha: a.linhas.slice(0, 30).findIndex((l) => assinatura(l) === assinatura(linhasAba[mapeamento.linhaCab])) }))
        .filter((x) => x.i !== mapeamento.aba && x.linha >= 0 && assinatura(linhasAba[mapeamento.linhaCab]).length > 3)
    : [];
  const corpo = mapeamento
    ? [...linhasAba.slice(mapeamento.linhaCab + 1), ...(juntar ? abasIguais.flatMap((x) => x.a.linhas.slice(x.linha + 1)) : [])]
    : [];
  const legenda = mapeamento ? acharLegenda(linhasAba, mapeamento.linhaCab) : {};
  const largura = Math.max(cabecalho.length, ...corpo.slice(0, 200).map((l) => l.length));
  const colunas = Array.from({ length: largura }, (_, i) => cabecalho[i] ?? `Coluna ${i + 1}`);
  const opcoes = area === "financeiro" ? { tipoPadrao } : { legenda };
  const resultado = useMemo(
    () => (mapeamento ? converter(area, colunas, corpo, colunas.map((_, i) => mapeamento.mapa[i] ?? null), opcoes) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapeamento, area, tipoPadrao, juntar],
  );
  const camposUsados = mapeamento ? def.campos.filter((c) => mapeamento.mapa.includes(c.chave)) : [];
  const faltando = def.campos.filter((c) => c.obrigatorio && !mapeamento?.mapa.includes(c.chave));

  function trocarCampo(i: number, campo: string | null) {
    if (!mapeamento) return;
    const mapa = colunas.map((_, j) => mapeamento.mapa[j] ?? null).map((m, j) => (j === i ? campo : m === campo && campo ? null : m));
    setEtapa({ ...mapeamento, mapa });
  }

  function confirmar() {
    if (!mapeamento || !arquivo) return;
    setErro(null);
    iniciar(async () => {
      const r = await importarDados({
        area, arquivoNome: arquivo.nome, arquivoCaminho: arquivo.caminho, arquivoTipo: arquivo.tipo,
        cabecalho: colunas, linhas: corpo, mapa: colunas.map((_, i) => mapeamento.mapa[i] ?? null), modo, opcoes,
      });
      if ("erro" in r) setErro(r.erro);
      else { setEtapa({ tipo: "pronto", resumo: r.resumo }); router.refresh(); }
    });
  }

  return (
    <>
      <Botao type="button" variante="secundario" onClick={() => setAberto(true)} className="inline-flex items-center gap-2">
        <IconeUpload /> {rotulo}
      </Botao>
      {aberto && (
        <Janela titulo={`Importar para ${def.titulo}`} sub={def.explicacao} fechar={fechar} largo={etapa.tipo === "mapear"}>
          {etapa.tipo === "escolher" && (
            <>
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files?.[0]); }}
                className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${arrastando ? "border-violeta bg-violeta/5" : "border-stone-200 hover:border-violeta/50 hover:bg-stone-50"}`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violeta to-ciano text-white"><IconeUpload /></span>
                <span className="font-medium text-stone-800">Arraste o arquivo aqui ou clique para escolher</span>
                <span className="text-xs text-stone-500">Planilhas Excel (.xlsx ou .xls) e CSV são lidas na hora. PDFs e fotos de documentos são lidos automaticamente. Outros arquivos ficam guardados como referência.</span>
              </button>
              <input ref={entrada} type="file" className="hidden" onChange={(e) => { receber(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="mt-3"><Erro mensagem={erro} /></div>
            </>
          )}

          {etapa.tipo === "lendo" && (
            <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-6 text-sm text-stone-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violeta border-t-transparent" /> {etapa.texto}
            </div>
          )}

          {etapa.tipo === "guardado" && (
            <>
              <p className="rounded-xl bg-ciano/10 p-4 text-sm text-stone-700 ring-1 ring-ciano/30">{etapa.texto}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={() => setEtapa({ tipo: "escolher" })}>Enviar outro</Botao>
                <Botao type="button" onClick={fechar}>Fechar</Botao>
              </div>
            </>
          )}

          {etapa.tipo === "pronto" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[["Novos", etapa.resumo.inseridos, "text-neon"], ["Atualizados", etapa.resumo.atualizados, "text-violeta"], ["Removidos", etapa.resumo.removidos, "text-rosa"]].map(([r, v, c]) => (
                  <div key={r as string} className="rounded-xl bg-stone-50 p-4 text-center">
                    <div className={`font-mono text-2xl font-semibold ${c}`}>{v as number}</div>
                    <div className="text-xs uppercase tracking-wider text-stone-500">{r as string}</div>
                  </div>
                ))}
              </div>
              {etapa.resumo.avisos.length > 0 && (
                <ul className="mt-4 max-h-40 list-disc overflow-auto pl-5 text-xs text-stone-500">{etapa.resumo.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
              )}
              <div className="mt-4 flex justify-end"><Botao type="button" onClick={fechar}>Ver no sistema</Botao></div>
            </>
          )}

          {mapeamento && resultado && (
            <>
              {mapeamento.observacao && <p className="mb-3 rounded-xl bg-ciano/10 p-3 text-sm text-stone-700 ring-1 ring-ciano/30">{mapeamento.observacao}</p>}
              <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
                <span className="mr-auto font-medium text-stone-800">{arquivo?.nome}</span>
                {mapeamento.abas.length > 1 && (
                  <label className="flex items-center gap-2 text-stone-600">Aba
                    <select className={inputCls} value={mapeamento.aba} onChange={(e) => prepararMapa(mapeamento.abas, Number(e.target.value))}>
                      {mapeamento.abas.map((a, i) => <option key={i} value={i}>{a.nome} ({a.linhas.length} linhas)</option>)}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-stone-600">Títulos das colunas na linha
                  <input type="number" min={1} max={linhasAba.length} value={mapeamento.linhaCab + 1} className={`${inputCls} w-20`}
                    onChange={(e) => prepararMapa(mapeamento.abas, mapeamento.aba, Math.max(0, Math.min(linhasAba.length - 1, Number(e.target.value) - 1)), mapeamento.observacao)} />
                </label>
              </div>

              {abasIguais.length > 0 && (
                <label className="mb-4 flex items-center gap-2 rounded-xl bg-violeta/5 p-3 text-sm text-stone-700 ring-1 ring-violeta/20">
                  <input type="checkbox" checked={juntar} onChange={(e) => setJuntar(e.target.checked)} className="accent-violeta" />
                  Juntar com as abas que têm as mesmas colunas: {abasIguais.map((x) => x.a.nome).join(", ")}
                </label>
              )}
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">1. Confira onde cada coluna vai entrar no sistema</p>
              <div className="mb-5 max-h-64 overflow-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-50 text-stone-500">
                    <tr><th className="px-3 py-2">Coluna da planilha</th><th className="px-3 py-2">Exemplo</th><th className="px-3 py-2">Vai para</th></tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {colunas.map((c, i) => {
                      const exemplo = corpo.find((l) => l[i]?.trim())?.[i] ?? "";
                      return (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-medium text-stone-800">{c}</td>
                          <td className="max-w-56 truncate px-3 py-1.5 text-stone-500">{exemplo}</td>
                          <td className="px-3 py-1">
                            <select value={mapeamento.mapa[i] ?? ""} onChange={(e) => trocarCampo(i, e.target.value || null)}
                              className={`${inputCls} w-full py-1 text-xs ${mapeamento.mapa[i] ? "border-violeta/40 bg-violeta/5" : ""}`}>
                              <option value="">Guardar como informação extra</option>
                              {def.campos.map((f) => <option key={f.chave} value={f.chave}>{f.rotulo}{f.obrigatorio ? " *" : ""}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">2. Veja como vai ficar ({resultado.registros.length} registro(s){resultado.ignoradas ? `, ${resultado.ignoradas} ignorado(s)` : ""})</p>
              {faltando.length > 0 ? (
                <Erro mensagem={`Escolha a coluna de: ${faltando.map((f) => f.rotulo).join(", ")}.`} />
              ) : (
                <div className="mb-3 max-h-64 overflow-auto rounded-xl border border-stone-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-stone-50 text-stone-500">
                      <tr>{camposUsados.map((f) => <th key={f.chave} className="whitespace-nowrap px-3 py-2">{f.rotulo}</th>)}<th className="px-3 py-2">Extras</th></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {resultado.registros.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          {camposUsados.map((f) => {
                            const v = f.chave === "pedido" ? r.ref.pedido : f.chave === "pessoa" ? r.ref.pessoa : f.chave === "codigo" && area === "producao" ? r.chave.replace(/^cod:/, "") : r.valores[f.chave];
                            const texto = v == null || v === "" ? "—" : f.tipo === "data" ? String(v).split("-").reverse().join("/") : f.tipo === "numero" ? Number(v).toLocaleString("pt-BR") : String(v).replace("_", " ");
                            return <td key={f.chave} className="max-w-48 truncate px-3 py-1.5">{texto}</td>;
                          })}
                          <td className="max-w-48 truncate px-3 py-1.5 text-stone-400">{r.extras ? Object.entries(r.extras).map(([k, v]) => `${k}: ${v}`).join(" · ") : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {resultado.avisos.length > 0 && (
                <details className="mb-3 text-xs text-stone-500"><summary className="cursor-pointer">{resultado.avisos.length} aviso(s) da leitura</summary>
                  <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">{resultado.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </details>
              )}

              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">3. Como importar</p>
              <div className="mb-4 grid gap-2 md:grid-cols-2">
                {([
                  ["atualizar", "Deixar o sistema igual à planilha", "Atualiza o que mudou, cadastra o que é novo e tira o que saiu da planilha (só o que veio de importações)."],
                  ["somar", "Só acrescentar e atualizar", "Atualiza o que já existe e cadastra o novo, sem tirar nada do sistema."],
                ] as const).map(([v, t, d]) => (
                  <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition ${modo === v ? "border-violeta/50 bg-violeta/5" : "border-stone-200 hover:border-stone-300"}`}>
                    <input type="radio" name="modo" checked={modo === v} onChange={() => setModo(v)} className="mt-1 accent-violeta" />
                    <span><span className="font-medium text-stone-800">{t}</span><span className="block text-xs text-stone-500">{d}</span></span>
                  </label>
                ))}
              </div>
              {area === "financeiro" && (
                <label className="mb-4 flex items-center gap-2 text-sm text-stone-600">Quando a planilha não diz se é a pagar ou a receber, considerar
                  <select className={inputCls} value={tipoPadrao} onChange={(e) => setTipoPadrao(e.target.value as "pagar" | "receber")}>
                    <option value="pagar">A pagar</option><option value="receber">A receber</option>
                  </select>
                </label>
              )}
              <Erro mensagem={erro} />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={() => setEtapa({ tipo: "escolher" })}>Outro arquivo</Botao>
                <Botao type="button" disabled={pendente || faltando.length > 0 || !resultado.registros.length} onClick={confirmar}>
                  {pendente ? "Importando…" : `Importar ${resultado.registros.length} registro(s)`}
                </Botao>
              </div>
            </>
          )}
        </Janela>
      )}
    </>
  );
}

/** Botão "Limpar conteúdo": apaga o que veio de arquivos nesta área, depois de confirmar a senha. */
export function LimparConteudo({ area }: { area: Area }) {
  const def = AREAS[area];
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function fechar() { setAberto(false); setSenha(""); setErro(null); setFeito(null); }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="rounded-full border border-rosa/30 bg-white px-4 py-2 text-sm font-medium text-rosa transition hover:bg-rosa/5">
        Limpar conteúdo
      </button>
      {aberto && (
        <Janela titulo={`Limpar ${def.titulo.toLowerCase()} importados`} fechar={fechar}>
          {feito ? (
            <>
              <p className="rounded-xl bg-neon/10 p-4 text-sm text-stone-700 ring-1 ring-neon/30">{feito}</p>
              <div className="mt-4 flex justify-end"><Botao type="button" onClick={fechar}>Fechar</Botao></div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setErro(null);
                iniciar(async () => {
                  const r = await limparArea(area, senha);
                  if ("erro" in r) { setErro(r.erro); return; }
                  setFeito(`Pronto: ${r.removidos} registro(s) apagado(s).${r.mantidos ? ` ${r.mantidos} cliente(s) com orçamento, pedido ou atendimento ficaram no sistema.` : ""} Já pode carregar um arquivo novo do zero.`);
                  router.refresh();
                });
              }}
            >
              <p className="mb-4 text-sm text-stone-600">
                Isso apaga <strong>tudo o que entrou por arquivos</strong> em {def.titulo} e os arquivos enviados. O que foi cadastrado à mão no sistema continua. Não dá para desfazer.
              </p>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Digite a sua senha para confirmar</span>
                <input type="password" autoFocus autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
              </label>
              <div className="mt-3"><Erro mensagem={erro} /></div>
              <div className="mt-4 flex justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao>
                <Botao type="submit" variante="perigo" disabled={pendente || !senha}>{pendente ? "Limpando…" : "Limpar tudo"}</Botao>
              </div>
            </form>
          )}
        </Janela>
      )}
    </>
  );
}

/** Os dois botões juntos, para o topo das telas. */
export function FerramentasImportacao({ area, extra }: { area: Area; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Importador area={area} />
      <LimparConteudo area={area} />
      {extra}
    </div>
  );
}
