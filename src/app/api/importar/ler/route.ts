import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { AREAS, type Area } from "@/lib/importacao";

// Leitura de PDF e imagem pode levar mais de um minuto em arquivos grandes.
export const maxDuration = 300;

const TIPOS_IMAGEM = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const;

const ESQUEMA = {
  type: "object",
  properties: {
    cabecalho: { type: "array", items: { type: "string" } },
    linhas: { type: "array", items: { type: "array", items: { type: "string" } } },
    observacao: { type: "string" },
  },
  required: ["cabecalho", "linhas", "observacao"],
  additionalProperties: false,
} as const;

/** Lê um PDF ou imagem já enviado ao Storage e devolve os dados como uma tabela. */
export async function POST(request: Request) {
  const perfil = await perfilAtual();
  if (!perfil || perfil.papel === "montador") return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

  const { caminho, area } = (await request.json()) as { caminho?: string; area?: Area };
  const def = area ? AREAS[area] : undefined;
  if (!caminho || !def) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: "A leitura automática de PDF e imagem ainda não está ligada. O arquivo foi guardado; para importar os dados agora, envie a planilha (Excel ou CSV).", semChave: true },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const { data: arquivo, error } = await supabase.storage.from("importacoes").download(caminho);
  if (error || !arquivo) return NextResponse.json({ erro: "Não achei o arquivo enviado." }, { status: 404 });
  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  const ext = caminho.split(".").pop()?.toLowerCase() ?? "";

  let anexo: Anthropic.ContentBlockParam;
  if (ext === "pdf") anexo = { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  else if (ext in TIPOS_IMAGEM) anexo = { type: "image", source: { type: "base64", media_type: TIPOS_IMAGEM[ext as keyof typeof TIPOS_IMAGEM], data: base64 } };
  else return NextResponse.json({ erro: "Esse tipo de arquivo não é lido automaticamente." }, { status: 415 });

  const campos = def.campos.map((c) => `- ${c.rotulo}${c.obrigatorio ? " (obrigatório)" : ""}`).join("\n");
  const pedido = `Este arquivo é de uma marcenaria de móveis planejados e vai ser importado na área "${def.titulo}" do sistema de gestão.
${def.explicacao}

Campos que o sistema aceita:
${campos}

Extraia TODOS os registros do arquivo como uma tabela:
- "cabecalho": um nome de coluna para cada informação, usando os nomes dos campos acima sempre que couber. Informações úteis que não se encaixam em nenhum campo também viram colunas, com um nome curto.
- "linhas": uma linha por registro, na mesma ordem das colunas, com o texto exatamente como aparece (datas em dd/mm/aaaa, valores em reais como 1.234,56). Deixe "" quando a informação não existir.
- Não invente dados e não pule linhas. Ignore totais, subtotais e cabeçalhos repetidos de página.
- "observacao": uma frase curta em português sobre o que foi lido, ou sobre o que não deu para ler.`;

  try {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 64000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      messages: [{ role: "user", content: [anexo, { type: "text", text: pedido }] }],
    });
    const resposta = await stream.finalMessage();
    if (resposta.stop_reason === "refusal") return NextResponse.json({ erro: "O arquivo não pôde ser lido automaticamente." }, { status: 422 });
    const texto = resposta.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const dados = JSON.parse(texto) as { cabecalho: string[]; linhas: string[][]; observacao: string };
    if (resposta.stop_reason === "max_tokens") dados.observacao = `${dados.observacao} O arquivo é muito grande: só parte dele foi lida.`;
    return NextResponse.json(dados);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ erro: "A chave da leitura automática é inválida." }, { status: 500 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ erro: "Muitas leituras ao mesmo tempo. Tente de novo em um minuto." }, { status: 429 });
    if (e instanceof SyntaxError) return NextResponse.json({ erro: "A leitura veio incompleta. Tente de novo." }, { status: 500 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ erro: `Falha na leitura automática (${e.status}).` }, { status: 502 });
    throw e;
  }
}
