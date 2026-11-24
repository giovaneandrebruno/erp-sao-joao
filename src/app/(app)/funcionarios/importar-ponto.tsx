"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Erro, estiloBotao, inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { data } from "@/lib/format";
import { lerPlanilhaArquivo } from "@/lib/planilha";
import { acharFuncionario, lerPonto, type DiaLido, type FuncionarioParaPonto } from "@/lib/ponto";
import { importarPonto } from "./actions";

type Grupo = { chaveGrupo: string; pessoa: string | null; chave: string | null; dias: DiaLido[] };

/**
 * Importar a planilha .xlsx do relógio ponto. O sistema lê as marcações, reconhece cada pessoa
 * (pela matrícula, CPF, PIS ou nome) e mostra tudo antes de gravar. Quem não foi reconhecido pode ser escolhido na lista.
 */
export function ImportarPonto({ funcionarios, soDe }: { funcionarios: FuncionarioParaPonto[]; soDe?: string }) {
  const router = useRouter();
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);

  async function ler(arquivo: File | undefined) {
    setErro(null);
    setGrupos(null);
    if (!arquivo) return;
    setLendo(true);
    try {
      const dias = lerPonto(await lerPlanilhaArquivo(arquivo));
      if (!dias.length) {
        setErro("Não achei marcações de ponto nesta planilha. Ela precisa ter uma coluna de data (Data ou Dia) e as horas (Entrada, Saída, Marcações…).");
        return;
      }
      const mapa = new Map<string, Grupo>();
      for (const d of dias) {
        const k = `${d.pessoa ?? ""}|${d.chave ?? ""}`;
        const g = mapa.get(k) ?? { chaveGrupo: k, pessoa: d.pessoa, chave: d.chave, dias: [] };
        g.dias.push(d);
        mapa.set(k, g);
      }
      const lista = [...mapa.values()];
      const inicial: Record<string, string> = {};
      for (const g of lista) {
        const achado = acharFuncionario(g, funcionarios);
        if (soDe) inicial[g.chaveGrupo] = !g.pessoa && !g.chave ? soDe : achado === soDe ? soDe : lista.length === 1 ? soDe : "";
        else inicial[g.chaveGrupo] = achado ?? "";
      }
      setNomeArquivo(arquivo.name);
      setEscolha(inicial);
      setGrupos(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setLendo(false);
    }
  }

  const aGravar = useMemo(
    () => (grupos ?? []).flatMap((g) => (escolha[g.chaveGrupo] ? g.dias.map((d) => ({ funcionario_id: escolha[g.chaveGrupo], dia: d.dia, marcacoes: d.marcacoes })) : [])),
    [grupos, escolha],
  );

  async function gravar() {
    setGravando(true);
    setErro(null);
    try {
      const r = await importarPonto(aGravar, nomeArquivo);
      if (r.erro) { setErro(r.erro); return; }
      avisar(`${r.gravados} ${r.gravados === 1 ? "dia gravado" : "dias gravados"}`);
      setGrupos(null);
      document.querySelector<HTMLDialogElement>("dialog[open]")?.close();
      router.refresh();
    } catch {
      setErro("Não foi possível gravar. Confira a internet e tente de novo.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <div className="grid gap-4" data-manter-aberta>
      <p className="text-sm text-stone-600">
        Exporte o relatório do relógio ponto em planilha do Excel (<strong>.xlsx</strong>) e escolha o arquivo aqui. O sistema lê a data e as horas de cada dia.
        Se o mesmo dia já estiver gravado, ele é atualizado (importar de novo não duplica).
      </p>
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => ler(e.target.files?.[0])}
        className={`${inputCls} file:mr-3 file:rounded-md file:border-0 file:bg-madeira-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-madeira-800`}
      />
      {lendo && <p className="text-xs text-stone-500">Lendo a planilha…</p>}
      <Erro mensagem={erro} />

      {grupos && (
        <>
          <div className="overflow-x-auto rounded-xl ring-1 ring-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-[0.12em] text-stone-500">
                <tr><th className="px-3 py-2">Na planilha</th><th className="px-3 py-2">Dias</th><th className="px-3 py-2">Período</th><th className="px-3 py-2">Gravar em</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {grupos.map((g) => {
                  const dias = g.dias.map((d) => d.dia).sort();
                  return (
                    <tr key={g.chaveGrupo}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-stone-800">{g.pessoa ?? (g.chave ? `Código ${g.chave}` : "Sem nome na planilha")}</div>
                        {g.pessoa && g.chave && <div className="text-xs text-stone-500">Código {g.chave}</div>}
                      </td>
                      <td className="px-3 py-2">{g.dias.length}</td>
                      <td className="whitespace-nowrap px-3 py-2">{data(dias[0])} a {data(dias[dias.length - 1])}</td>
                      <td className="px-3 py-2">
                        <select value={escolha[g.chaveGrupo] ?? ""} onChange={(e) => setEscolha({ ...escolha, [g.chaveGrupo]: e.target.value })} className={`${inputCls} !py-1.5`}>
                          <option value="">Não gravar</option>
                          {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-stone-500">{aGravar.length} {aGravar.length === 1 ? "dia" : "dias"} para gravar</span>
            <button type="button" onClick={gravar} disabled={gravando || !aGravar.length} className={estiloBotao.primario}>{gravando ? "Gravando…" : "Gravar marcações"}</button>
          </div>
        </>
      )}
    </div>
  );
}
