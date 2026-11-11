/**
 * Regras da importação de arquivos: quais campos cada área aceita, como reconhecer as colunas
 * da planilha e como transformar cada linha num registro do sistema.
 * Usado no navegador (pré-visualização) e no servidor (gravação), para os dois darem o mesmo resultado.
 */

export type Area = "producao" | "clientes" | "fornecedores" | "estoque" | "financeiro";
export type TipoCampo = "texto" | "numero" | "data" | "etapa" | "tipo_produto" | "tipo_lancamento" | "situacao" | "unidade" | "inteiro";

export type CampoArea = { chave: string; rotulo: string; tipo: TipoCampo; obrigatorio?: boolean; reconhece: RegExp };

export type DefinicaoArea = {
  area: Area;
  titulo: string;
  tabela: "ordens_producao" | "clientes" | "fornecedores" | "produtos" | "lancamentos";
  caminho: string;
  explicacao: string;
  campos: CampoArea[];
};

export const AREAS: Record<Area, DefinicaoArea> = {
  producao: {
    area: "producao",
    titulo: "Produção (PCP)",
    tabela: "ordens_producao",
    caminho: "/producao",
    explicacao: "Planilha de planejamento da produção: cada linha vira uma ordem de produção no quadro.",
    campos: [
      { chave: "codigo", rotulo: "Código / Nº da OP", tipo: "texto", reconhece: /^(c[oó]d|n[ºo°]?\s*(da\s*)?op\b|^op$|^id$|ordem)/i },
      { chave: "pedido", rotulo: "Nº do pedido", tipo: "inteiro", reconhece: /pedido|contrato|^ped\b|^os\b/i },
      { chave: "cliente_nome", rotulo: "Cliente", tipo: "texto", reconhece: /cliente|obra|nome/i },
      { chave: "ambiente", rotulo: "Ambiente", tipo: "texto", reconhece: /ambiente|c[oô]modo|local/i },
      { chave: "descricao", rotulo: "Descrição / Móvel", tipo: "texto", obrigatorio: true, reconhece: /descri|m[oó]vel|item|pe[cç]a|m[oó]dulo|produto|servi[cç]o|projeto/i },
      { chave: "etapa", rotulo: "Etapa / Status", tipo: "etapa", reconhece: /etapa|status|situa|fase|andamento/i },
      { chave: "responsavel", rotulo: "Responsável", tipo: "texto", reconhece: /respons|marceneiro|montador|equipe|operador|setor/i },
      { chave: "prazo", rotulo: "Prazo / Entrega", tipo: "data", reconhece: /prazo|entrega|data\s*(prev|fim|final)|previs|t[eé]rmino|conclus/i },
      { chave: "observacoes", rotulo: "Observações", tipo: "texto", reconhece: /obs|nota|coment/i },
    ],
  },
  clientes: {
    area: "clientes",
    titulo: "Clientes",
    tabela: "clientes",
    caminho: "/clientes",
    explicacao: "Lista de clientes: quem já existe (mesmo CPF/CNPJ ou mesmo nome) é atualizado, quem é novo é cadastrado.",
    campos: [
      { chave: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, reconhece: /nome|cliente|raz[aã]o/i },
      { chave: "cpf_cnpj", rotulo: "CPF / CNPJ", tipo: "texto", reconhece: /cpf|cnpj|documento/i },
      { chave: "telefone", rotulo: "Telefone", tipo: "texto", reconhece: /fone|celular|whats|contato/i },
      { chave: "email", rotulo: "E-mail", tipo: "texto", reconhece: /e-?mail/i },
      { chave: "endereco", rotulo: "Endereço", tipo: "texto", reconhece: /endere|rua|logradouro/i },
      { chave: "cidade", rotulo: "Cidade", tipo: "texto", reconhece: /cidade|munic/i },
      { chave: "uf", rotulo: "UF", tipo: "texto", reconhece: /^uf$|estado/i },
      { chave: "cep", rotulo: "CEP", tipo: "texto", reconhece: /cep/i },
      { chave: "observacoes", rotulo: "Observações", tipo: "texto", reconhece: /obs|nota|coment/i },
    ],
  },
  fornecedores: {
    area: "fornecedores",
    titulo: "Fornecedores",
    tabela: "fornecedores",
    caminho: "/fornecedores",
    explicacao: "Lista de fornecedores: quem já existe é atualizado, quem é novo é cadastrado.",
    campos: [
      { chave: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, reconhece: /nome|fornecedor|raz[aã]o|empresa/i },
      { chave: "cpf_cnpj", rotulo: "CPF / CNPJ", tipo: "texto", reconhece: /cpf|cnpj|documento/i },
      { chave: "telefone", rotulo: "Telefone", tipo: "texto", reconhece: /fone|celular|whats/i },
      { chave: "email", rotulo: "E-mail", tipo: "texto", reconhece: /e-?mail/i },
      { chave: "contato", rotulo: "Pessoa de contato", tipo: "texto", reconhece: /contato|vendedor|representante/i },
      { chave: "observacoes", rotulo: "Observações", tipo: "texto", reconhece: /obs|nota|coment/i },
    ],
  },
  estoque: {
    area: "estoque",
    titulo: "Estoque e produtos",
    tabela: "produtos",
    caminho: "/estoque",
    explicacao: "Lista de materiais e produtos: o mesmo código (ou nome) atualiza o produto e o saldo em estoque.",
    campos: [
      { chave: "codigo", rotulo: "Código", tipo: "texto", reconhece: /c[oó]d|sku|refer/i },
      { chave: "nome", rotulo: "Nome / Descrição", tipo: "texto", obrigatorio: true, reconhece: /nome|descri|produto|material|item/i },
      { chave: "tipo", rotulo: "Tipo", tipo: "tipo_produto", reconhece: /^tipo|categoria|classe/i },
      { chave: "unidade_medida", rotulo: "Unidade", tipo: "texto", reconhece: /^un|medida/i },
      { chave: "custo", rotulo: "Custo", tipo: "numero", reconhece: /custo|compra/i },
      { chave: "preco_venda", rotulo: "Preço de venda", tipo: "numero", reconhece: /venda|pre[cç]o|valor/i },
      { chave: "estoque_atual", rotulo: "Saldo em estoque", tipo: "numero", reconhece: /saldo|estoque|qtd|quant|atual/i },
      { chave: "estoque_minimo", rotulo: "Estoque mínimo", tipo: "numero", reconhece: /m[ií]nim/i },
    ],
  },
  financeiro: {
    area: "financeiro",
    titulo: "Financeiro",
    tabela: "lancamentos",
    caminho: "/financeiro",
    explicacao: "Contas a pagar e a receber: cada linha vira um lançamento com vencimento e valor.",
    campos: [
      { chave: "descricao", rotulo: "Descrição", tipo: "texto", obrigatorio: true, reconhece: /descri|hist[oó]rico|conta|refer|nome/i },
      { chave: "tipo", rotulo: "Pagar ou receber", tipo: "tipo_lancamento", reconhece: /^tipo|natureza|pagar|receber|entrada|sa[ií]da|d[eé]bito|cr[eé]dito/i },
      { chave: "valor", rotulo: "Valor", tipo: "numero", obrigatorio: true, reconhece: /valor|total|montante|quantia/i },
      { chave: "vencimento", rotulo: "Vencimento", tipo: "data", obrigatorio: true, reconhece: /venc|data|dia/i },
      { chave: "pago_em", rotulo: "Pago em", tipo: "data", reconhece: /pago\s*em|pagamento|baixa|quita/i },
      { chave: "situacao", rotulo: "Situação (pago / aberto)", tipo: "situacao", reconhece: /situa|status|pago\??$/i },
      { chave: "categoria", rotulo: "Categoria", tipo: "texto", reconhece: /categ|plano|grupo|centro/i },
      { chave: "forma_pagamento", rotulo: "Forma de pagamento", tipo: "texto", reconhece: /forma|meio/i },
      { chave: "pessoa", rotulo: "Cliente / fornecedor", tipo: "texto", reconhece: /cliente|fornecedor|favorecido|pagador|sacado/i },
      { chave: "unidade", rotulo: "Unidade (marcenaria / loja)", tipo: "unidade", reconhece: /unidade|empresa|loja/i },
      { chave: "observacoes", rotulo: "Observações", tipo: "texto", reconhece: /obs|nota|coment/i },
    ],
  },
};

export const LISTA_AREAS = Object.values(AREAS);
export const MAX_LINHAS = 5000;

// ---------------------------------------------------------------- leitura de valores

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** "1.234,56" → 1234.56 ; "1234.56" → 1234.56 ; "R$ -10" → -10 ; "(10,00)" → -10 */
export function numeroBR(v: string | undefined | null): number | null {
  if (v == null) return null;
  let s = String(v).replace(/[R$\s ]/g, "");
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

/** Datas em dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd, "12/nov", ou número de série do Excel → "aaaa-mm-dd". */
export function dataISO(v: string | undefined | null, anoBase = new Date().getFullYear()): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const ok = (a: number, m: number, d: number) => {
    if (a < 100) a += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1990 || a > 2100) return null;
    const dt = new Date(Date.UTC(a, m - 1, d));
    if (dt.getUTCDate() !== d) return null;
    return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?/);
  if (m) return ok(m[3] ? +m[3] : anoBase, +m[2], +m[1]);
  m = normalizar(s).match(/^(\d{1,2})[/.\- ]?(?:de )?([a-z]{3})[a-z]*\.?(?:[/.\- ]?(?:de )?(\d{2,4}))?/);
  if (m && MESES[m[2]]) return ok(m[3] ? +m[3] : anoBase, MESES[m[2]], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 30000 && serial < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return dt.toISOString().slice(0, 10);
    }
  }
  return null;
}

export type Etapa = "aguardando" | "corte" | "fita_borda" | "montagem" | "acabamento" | "pronto" | "instalacao" | "concluido";

export function etapaDe(v: string): Etapa | null {
  const s = normalizar(v);
  if (!s) return null;
  if (/conclu|finaliz|entregue|encerr|^ok$|^feito|^100 ?%/.test(s)) return "concluido";
  if (/instal|entrega|montagem (no|na|em) (cliente|obra)|na obra/.test(s)) return "instalacao";
  if (/pronto|embal|expedi|aguardando entrega/.test(s)) return "pronto";
  if (/acab|pintura|laca|verniz|revis/.test(s)) return "acabamento";
  if (/fita|borda|bordo/.test(s)) return "fita_borda";
  if (/corte|cortad|usinag|fura[cç]|cnc|seccion/.test(s)) return "corte";
  if (/mont/.test(s)) return "montagem";
  if (/aguard|pendente|nao inici|a fazer|fila|programad|planejad|novo/.test(s)) return "aguardando";
  return null;
}

function tipoProduto(v: string) {
  const s = normalizar(v);
  if (/serv|mao de obra/.test(s)) return "servico";
  if (/prod|revenda|movel|acabado/.test(s)) return "produto";
  if (s) return "materia_prima";
  return null;
}

function tipoLancamento(v: string) {
  const s = normalizar(v);
  if (/pagar|despesa|saida|debito|fornecedor|custo|^p$|^d$|^-$/.test(s)) return "pagar";
  if (/receber|receita|entrada|credito|cliente|venda|^r$|^c$|^\+$/.test(s)) return "receber";
  return null;
}

function situacaoPaga(v: string) {
  const s = normalizar(v);
  if (/nao|aberto|pendente|vencid|a pagar|a receber|atras/.test(s)) return false;
  if (/pago|paga|quitad|recebid|baixad|liquidad|^sim$|^s$|^ok$|^x$/.test(s)) return true;
  return null;
}

// ---------------------------------------------------------------- reconhecimento de colunas

/** Sugere o campo de cada coluna pelo nome do cabeçalho. Cada campo vai para uma coluna só. */
export function mapearColunas(area: Area, cabecalho: string[]): (string | null)[] {
  const campos = AREAS[area].campos;
  const mapa: (string | null)[] = cabecalho.map(() => null);
  const usados = new Set<string>();
  // primeiro os campos na ordem da definição (mais específicos antes), depois as colunas
  for (const campo of campos) {
    const i = cabecalho.findIndex((c, idx) => mapa[idx] === null && c && campo.reconhece.test(normalizarCab(c)));
    if (i >= 0 && !usados.has(campo.chave)) { mapa[i] = campo.chave; usados.add(campo.chave); }
  }
  return mapa;
}

const normalizarCab = (c: string) => c.replace(/[_\-]+/g, " ").trim();

/** Acha a linha de cabeçalho nas primeiras linhas (planilhas de PCP costumam ter título em cima). */
export function acharCabecalho(area: Area, tabela: string[][]): number {
  let melhor = 0;
  let melhorNota = -1;
  const campos = AREAS[area].campos;
  for (let i = 0; i < Math.min(tabela.length, 25); i++) {
    const cel = tabela[i].map((c) => (c ?? "").trim()).filter(Boolean);
    if (cel.length < 2) continue;
    const textos = cel.filter((c) => numeroBR(c) === null && !dataISO(c));
    const batidas = cel.filter((c) => campos.some((f) => f.reconhece.test(normalizarCab(c)))).length;
    const nota = batidas * 3 + textos.length - (cel.length - textos.length) * 2;
    if (nota > melhorNota) { melhorNota = nota; melhor = i; }
  }
  return melhor;
}

// ---------------------------------------------------------------- conversão das linhas

export type Opcoes = { tipoPadrao?: "pagar" | "receber" };

export type Registro = {
  chave: string;
  valores: Record<string, string | number | null>;
  extras: Record<string, string> | null;
  /** referências que o servidor resolve (nº do pedido, nome do cliente/fornecedor) */
  ref: { pedido?: number | null; pessoa?: string | null };
};

export type Convertido = { registros: Registro[]; avisos: string[]; ignoradas: number };

export function converter(area: Area, cabecalho: string[], linhas: string[][], mapa: (string | null)[], opcoes: Opcoes = {}): Convertido {
  const def = AREAS[area];
  const avisos: string[] = [];
  const registros: Registro[] = [];
  const vistas = new Map<string, number>();
  let ignoradas = 0;
  const camposMapeados = new Set(mapa.filter(Boolean) as string[]);
  const anoBase = new Date().getFullYear();

  for (const [n, linha] of linhas.entries()) {
    const nLinha = n + 1;
    if (!linha.some((c) => (c ?? "").trim())) continue;
    const bruto: Record<string, string> = {};
    const extras: Record<string, string> = {};
    linha.forEach((cel, i) => {
      const v = (cel ?? "").trim();
      if (!v) return;
      const campo = mapa[i];
      if (campo) bruto[campo] = bruto[campo] ? `${bruto[campo]} ${v}` : v;
      else if (cabecalho[i]?.trim()) extras[cabecalho[i].trim().slice(0, 60)] = v.slice(0, 500);
    });

    const valores: Record<string, string | number | null> = {};
    const ref: Registro["ref"] = {};
    let invalida: string | null = null;

    for (const campo of def.campos) {
      if (!camposMapeados.has(campo.chave)) continue;
      const v = bruto[campo.chave] ?? "";
      let saida: string | number | null = null;
      switch (campo.tipo) {
        case "texto": saida = v ? v.slice(0, 500) : null; break;
        case "numero": saida = numeroBR(v); if (v && saida === null) avisos.push(`Linha ${nLinha}: "${v}" não é um número (${campo.rotulo}).`); break;
        case "inteiro": { const x = numeroBR(v.replace(/[^\d,.\-]/g, "")); saida = x === null ? null : Math.trunc(x); break; }
        case "data": saida = dataISO(v, anoBase); if (v && !saida) avisos.push(`Linha ${nLinha}: não entendi a data "${v}" (${campo.rotulo}).`); break;
        case "etapa": saida = etapaDe(v) ?? (v ? "aguardando" : null); break;
        case "tipo_produto": saida = tipoProduto(v); break;
        case "tipo_lancamento": saida = tipoLancamento(v); break;
        case "situacao": { const p = situacaoPaga(v); saida = p === null ? null : p ? "pago" : "aberto"; break; }
        case "unidade": saida = v ? (/loja/i.test(v) ? "loja" : "marcenaria") : null; break;
      }
      if (campo.obrigatorio && (saida === null || saida === "")) { invalida = `falta ${campo.rotulo.toLowerCase()}`; break; }
      valores[campo.chave] = saida;
    }
    if (invalida) { ignoradas++; if (ignoradas <= 15) avisos.push(`Linha ${nLinha} ignorada: ${invalida}.`); continue; }

    // ajustes por área
    if (area === "producao") {
      ref.pedido = (valores.pedido as number | null) ?? null;
      delete valores.pedido;
      delete valores.codigo;
    }
    if (area === "financeiro") {
      let valor = valores.valor as number;
      let tipo = valores.tipo as string | null;
      if (!tipo) tipo = valor < 0 ? "pagar" : opcoes.tipoPadrao ?? "pagar";
      valor = Math.abs(valor);
      if (!valor) { ignoradas++; if (ignoradas <= 15) avisos.push(`Linha ${nLinha} ignorada: valor zerado.`); continue; }
      valores.tipo = tipo;
      valores.valor = Math.round(valor * 100) / 100;
      const situacao = valores.situacao;
      delete valores.situacao;
      if (situacao === "pago" && !valores.pago_em) valores.pago_em = valores.vencimento;
      if (situacao === "aberto") valores.pago_em = null;
      if (camposMapeados.has("situacao") && !("pago_em" in valores)) valores.pago_em = null;
      ref.pessoa = (valores.pessoa as string | null) ?? null;
      delete valores.pessoa;
      if ("unidade" in valores && !valores.unidade) valores.unidade = "marcenaria";
    }
    if (area === "estoque") {
      for (const k of ["custo", "preco_venda", "estoque_atual", "estoque_minimo"]) if (k in valores && valores[k] === null) valores[k] = 0;
      if ("tipo" in valores && !valores.tipo) valores.tipo = "materia_prima";
      if ("unidade_medida" in valores && !valores.unidade_medida) valores.unidade_medida = "un";
    }
    if (area === "producao" && "etapa" in valores && !valores.etapa) valores.etapa = "aguardando";

    // chave que identifica a mesma linha numa planilha editada depois
    const k = (s: unknown) => normalizar(String(s ?? ""));
    let base: string;
    if (area === "producao") base = bruto.codigo ? `cod:${k(bruto.codigo)}` : [ref.pedido ?? "", k(valores.cliente_nome), k(valores.ambiente), k(valores.descricao)].join("|");
    else if (area === "clientes" || area === "fornecedores") {
      const doc = String(valores.cpf_cnpj ?? "").replace(/\D/g, "");
      base = doc.length >= 11 ? `doc:${doc}` : `nome:${k(valores.nome)}`;
    } else if (area === "estoque") base = valores.codigo ? `cod:${k(valores.codigo)}` : `nome:${k(valores.nome)}`;
    else base = [valores.tipo, k(valores.descricao), valores.vencimento].join("|");
    const repeticao = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, repeticao);
    const chave = repeticao > 1 ? `${base}#${repeticao}` : base;

    registros.push({ chave, valores, extras: Object.keys(extras).length ? extras : null, ref });
    if (registros.length >= MAX_LINHAS) { avisos.push(`Só as primeiras ${MAX_LINHAS} linhas foram consideradas.`); break; }
  }
  if (ignoradas > 15) avisos.push(`… e mais ${ignoradas - 15} linha(s) ignoradas.`);
  return { registros, avisos, ignoradas };
}
