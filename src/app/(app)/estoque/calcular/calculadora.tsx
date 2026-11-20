"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Botao, Campo, Cartao, Selo, Tabela, inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";
import { Icone } from "@/components/icones";
import { brl } from "@/lib/format";
import { CHAPA_PADRAO, qtd } from "@/lib/estoque";
import { importarMateriais } from "../../pedidos/materiais-entrega";

type Produto = { id: string; nome: string; un: string; categoria: string; livre: number; custo: number; largura: number | null; altura: number | null };
type Peca = { id: number; descricao: string; largura: string; altura: string; quantidade: string; chapa: string; fita: string; l1: boolean; l2: boolean; a1: boolean; a2: boolean };
type Extra = { id: number; produto: string; quantidade: string };

const n = (s: string) => {
  const v = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};
let seq = 1;
const novaPeca = (base?: Partial<Peca>): Peca => ({ id: seq++, descricao: "", largura: "", altura: "", quantidade: "1", chapa: base?.chapa ?? "", fita: base?.fita ?? "", l1: false, l2: false, a1: false, a2: false });
const novoExtra = (): Extra => ({ id: seq++, produto: "", quantidade: "" });
const emM2 = (un: string) => /m2|m²/i.test(un);
const emCm = (un: string) => /^cm$/i.test(un.trim());

export function Calculadora({ pedidos, produtos, pedidoInicial }: { pedidos: { id: string; rotulo: string }[]; produtos: Produto[]; pedidoInicial: string }) {
  const [pedido, setPedido] = useState(pedidoInicial);
  const [perdaChapa, setPerdaChapa] = useState("15");
  const [perdaFita, setPerdaFita] = useState("10");
  const [pecas, setPecas] = useState<Peca[]>([novaPeca()]);
  const [extras, setExtras] = useState<Extra[]>([novoExtra()]);
  const [gravando, iniciar] = useTransition();
  const [feito, setFeito] = useState(false);

  const chapas = produtos.filter((p) => p.categoria === "chapa");
  const fitas = produtos.filter((p) => p.categoria === "fita");
  const outros = produtos.filter((p) => p.categoria !== "chapa" && p.categoria !== "fita");
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const resultado = useMemo(() => {
    const area = new Map<string, { m2: number; pecas: number }>();
    const fita = new Map<string, number>();
    for (const p of pecas) {
      const l = n(p.largura), a = n(p.altura), q = n(p.quantidade);
      if (!l || !a || !q) continue;
      if (p.chapa) {
        const atual = area.get(p.chapa) ?? { m2: 0, pecas: 0 };
        area.set(p.chapa, { m2: atual.m2 + (l * a * q) / 1e6, pecas: atual.pecas + q });
      }
      if (p.fita) {
        const mm = ((p.l1 ? l : 0) + (p.l2 ? l : 0) + (p.a1 ? a : 0) + (p.a2 ? a : 0)) * q;
        if (mm) fita.set(p.fita, (fita.get(p.fita) ?? 0) + mm / 1000);
      }
    }
    const pc = 1 + n(perdaChapa) / 100, pf = 1 + n(perdaFita) / 100;
    const linhas: { produto: Produto; quantidade: number; detalhe: string }[] = [];
    for (const [id, v] of area) {
      const prod = porId.get(id);
      if (!prod) continue;
      const largura = prod.largura ?? CHAPA_PADRAO.largura, altura = prod.altura ?? CHAPA_PADRAO.altura;
      const areaChapa = (largura * altura) / 1e6;
      const m2 = v.m2 * pc;
      const quantidade = emM2(prod.un) ? Math.ceil(m2 * 100) / 100 : Math.ceil(m2 / areaChapa);
      linhas.push({ produto: prod, quantidade, detalhe: `${qtd(v.pecas)} peças · ${qtd(Math.round(v.m2 * 100) / 100)} m² + ${qtd(n(perdaChapa))}% de perda · chapa ${largura}×${altura}` });
    }
    for (const [id, metros] of fita) {
      const prod = porId.get(id);
      if (!prod) continue;
      const m = metros * pf;
      const quantidade = emCm(prod.un) ? Math.ceil(m * 100) : Math.ceil(m * 2) / 2;
      linhas.push({ produto: prod, quantidade, detalhe: `${qtd(Math.round(metros * 10) / 10)} m de borda + ${qtd(n(perdaFita))}% de sobra` });
    }
    for (const e of extras) {
      const prod = porId.get(e.produto);
      const q = n(e.quantidade);
      if (!prod || !q) continue;
      const igual = linhas.find((l) => l.produto.id === prod.id);
      if (igual) igual.quantidade += q;
      else linhas.push({ produto: prod, quantidade: q, detalhe: "Ferragem / acessório" });
    }
    return linhas;
  }, [pecas, extras, perdaChapa, perdaFita, porId]);

  const total = resultado.reduce((s, r) => s + r.quantidade * r.produto.custo, 0);
  const mudarPeca = (id: number, campo: keyof Peca, valor: string | boolean) => setPecas((l) => l.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  const mudarExtra = (id: number, campo: keyof Extra, valor: string) => setExtras((l) => l.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)));

  function reservar() {
    if (!pedido) { avisar("Escolha o pedido", true); return; }
    if (!resultado.length) { avisar("Informe pelo menos uma peça ou ferragem", true); return; }
    iniciar(async () => {
      const erro = await importarMateriais(pedido, resultado.map((r) => ({ produto_id: r.produto.id, quantidade: r.quantidade, observacoes: `Calculado: ${r.detalhe}` })));
      if (erro) { avisar(erro, true); return; }
      avisar("Material reservado no pedido");
      setFeito(true);
    });
  }

  const marca = (p: Peca, k: "l1" | "l2" | "a1" | "a2", rotulo: string) => (
    <label className="flex items-center gap-1 text-xs text-stone-600" title={k.startsWith("l") ? "Lado do comprimento (largura)" : "Lado da altura"}>
      <input type="checkbox" checked={p[k]} onChange={(e) => mudarPeca(p.id, k, e.target.checked)} /> {rotulo}
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <Cartao>
        <div className="grid gap-4 md:grid-cols-12">
          <Campo rotulo="Pedido *" className="md:col-span-6">
            <select value={pedido} onChange={(e) => { setPedido(e.target.value); setFeito(false); }} className={inputCls}>
              <option value="">Escolha o pedido</option>
              {pedidos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Perda na chapa (%)" className="md:col-span-3">
            <input value={perdaChapa} onChange={(e) => setPerdaChapa(e.target.value)} inputMode="decimal" className={inputCls} />
          </Campo>
          <Campo rotulo="Sobra de fita (%)" className="md:col-span-3">
            <input value={perdaFita} onChange={(e) => setPerdaFita(e.target.value)} inputMode="decimal" className={inputCls} />
          </Campo>
        </div>
        {!chapas.length && (
          <p className="mt-4 text-sm text-stone-500">
            Nenhum produto da categoria <b>Chapas</b> ou <b>Fitas de borda</b> no cadastro ainda. Cadastre em <Link href="/estoque/novo" className="text-madeira-800 underline">Novo produto</Link> e informe a medida da chapa.
          </p>
        )}
      </Cartao>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Peças do projeto</h2>
          <Botao type="button" variante="secundario" onClick={() => setPecas((l) => [...l, novaPeca(l[l.length - 1])])}><Icone nome="mais" className="h-4 w-4" /> Adicionar peça</Botao>
        </div>
        <Tabela cabecalho={["Peça", "Largura (mm)", "Altura (mm)", "Qtd", "Chapa", "Fita de borda", "Lados com fita", ""]}>
          {pecas.map((p) => (
            <tr key={p.id}>
              <td className="px-2! py-2"><input value={p.descricao} onChange={(e) => mudarPeca(p.id, "descricao", e.target.value)} placeholder="Lateral, porta..." className={`${inputCls} w-32`} /></td>
              <td className="px-2! py-2"><input value={p.largura} onChange={(e) => mudarPeca(p.id, "largura", e.target.value)} inputMode="decimal" className={`${inputCls} w-20`} /></td>
              <td className="px-2! py-2"><input value={p.altura} onChange={(e) => mudarPeca(p.id, "altura", e.target.value)} inputMode="decimal" className={`${inputCls} w-20`} /></td>
              <td className="px-2! py-2"><input value={p.quantidade} onChange={(e) => mudarPeca(p.id, "quantidade", e.target.value)} inputMode="decimal" className={`${inputCls} w-14`} /></td>
              <td className="px-2! py-2">
                <select value={p.chapa} onChange={(e) => mudarPeca(p.id, "chapa", e.target.value)} className={`${inputCls} w-44`}>
                  <option value="">—</option>
                  {chapas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </td>
              <td className="px-2! py-2">
                <select value={p.fita} onChange={(e) => mudarPeca(p.id, "fita", e.target.value)} className={`${inputCls} w-40`}>
                  <option value="">Sem fita</option>
                  {fitas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </td>
              <td className="px-2! py-2"><div className="flex gap-2">{marca(p, "l1", "L1")}{marca(p, "l2", "L2")}{marca(p, "a1", "A1")}{marca(p, "a2", "A2")}</div></td>
              <td className="px-2! py-2">
                <button type="button" onClick={() => setPecas((l) => (l.length > 1 ? l.filter((x) => x.id !== p.id) : [novaPeca()]))} aria-label="Tirar peça" className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rosa">
                  <Icone nome="lixeira" className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </Tabela>
        <p className="mt-2 text-xs text-stone-500">L1 e L2 são os dois lados da largura; A1 e A2, os dois lados da altura. Marque onde vai fita.</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ferragens e acessórios</h2>
          <Botao type="button" variante="secundario" onClick={() => setExtras((l) => [...l, novoExtra()])}><Icone nome="mais" className="h-4 w-4" /> Adicionar item</Botao>
        </div>
        <Tabela cabecalho={["Item", "Quantidade", ""]}>
          {extras.map((e) => (
            <tr key={e.id}>
              <td className="px-2! py-2">
                <select value={e.produto} onChange={(ev) => mudarExtra(e.id, "produto", ev.target.value)} className={`${inputCls} w-full max-w-md`}>
                  <option value="">Dobradiça, corrediça, puxador, parafuso...</option>
                  {outros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </td>
              <td className="px-2! py-2"><input value={e.quantidade} onChange={(ev) => mudarExtra(e.id, "quantidade", ev.target.value)} inputMode="decimal" className={`${inputCls} w-24`} /></td>
              <td className="px-2! py-2">
                <button type="button" onClick={() => setExtras((l) => (l.length > 1 ? l.filter((x) => x.id !== e.id) : [novoExtra()]))} aria-label="Tirar item" className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rosa">
                  <Icone nome="lixeira" className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </Tabela>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Material necessário</h2>
        <Tabela cabecalho={["Material", "Quantidade", "Como foi calculado", "Livre no estoque", "Situação", "Custo estimado"]} vazio={!resultado.length}>
          {resultado.map((r) => (
            <tr key={r.produto.id}>
              <td className="px-4 py-3 font-medium">{r.produto.nome}</td>
              <td className="px-4 py-3 font-semibold">{qtd(r.quantidade, r.produto.un)}</td>
              <td className="px-4 py-3 text-stone-500">{r.detalhe}</td>
              <td className="px-4 py-3">{qtd(r.produto.livre, r.produto.un)}</td>
              <td className="px-4 py-3">{r.produto.livre >= r.quantidade ? <Selo cor="green">tem no estoque</Selo> : <Selo cor="red">faltam {qtd(Math.round((r.quantidade - Math.max(0, r.produto.livre)) * 1000) / 1000)}</Selo>}</td>
              <td className="px-4 py-3">{brl(r.quantidade * r.produto.custo)}</td>
            </tr>
          ))}
        </Tabela>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-stone-600">Custo estimado do material: <b className="font-mono">{brl(total)}</b></span>
          <div className="flex items-center gap-3">
            {feito && pedido && <Link href={`/pedidos/${pedido}`} className="text-sm font-medium text-madeira-800 hover:underline">Abrir o pedido</Link>}
            <Botao type="button" onClick={reservar} disabled={gravando || !resultado.length}>{gravando ? "Reservando..." : "Reservar no pedido"}</Botao>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">O cálculo de chapas é pela área com a perda informada. Para um aproveitamento exato, use o plano de corte do seu programa de projeto e importe a lista de materiais na tela do pedido.</p>
      </section>
    </div>
  );
}
