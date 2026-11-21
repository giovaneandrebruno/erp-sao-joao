import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Instagram e Facebook pela API oficial da Meta (Graph API).
 * O app da Meta fica nas variáveis META_APP_ID e META_APP_SECRET (só no servidor).
 * A chave de acesso da página é guardada cifrada no banco; só o servidor sabe decifrar.
 */
export const VERSAO_GRAPH = "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSAO_GRAPH}`;

export const PERMISSOES = [
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_messages",
  "pages_messaging",
  "business_management",
];

export function appConfigurado() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function chave() {
  return createHash("sha256").update(`redes:${process.env.META_APP_SECRET ?? ""}`).digest();
}

export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}

function decifrar(guardado: string) {
  const [iv, tag, dados] = guardado.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

export type Conexao = { page_id: string; page_nome: string | null; ig_id: string | null; ig_usuario: string | null; conectado_em: string; conectado_por_nome: string | null; token: string | null };

/** A página e o Instagram ligados ao sistema (ou nulo se ainda não ligou). */
export async function conexaoAtual(): Promise<Conexao | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("redes_conexao").select("page_id, page_nome, ig_id, ig_usuario, conectado_em, conectado_por_nome, token_cifrado").eq("id", 1).maybeSingle();
  if (!data) return null;
  let token: string | null = null;
  try {
    token = appConfigurado() ? decifrar(data.token_cifrado) : null;
  } catch {
    token = null; // a senha do app mudou: precisa ligar de novo
  }
  return { page_id: data.page_id, page_nome: data.page_nome, ig_id: data.ig_id, ig_usuario: data.ig_usuario, conectado_em: data.conectado_em, conectado_por_nome: data.conectado_por_nome, token };
}

export class ErroMeta extends Error {
  constructor(mensagem: string, public codigo?: number) {
    super(mensagem);
  }
}

/** Chamada à Graph API. Os parâmetros vão na URL; a chave vai no cabeçalho. */
export async function graph<T = Record<string, unknown>>(caminho: string, token: string, parametros: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${GRAPH}/${caminho.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, String(v));
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const corpo = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!r.ok || corpo.error) throw new ErroMeta(corpo.error?.message ?? `Erro ${r.status} da Meta`, corpo.error?.code);
  return corpo;
}

/** Tenta a chamada e devolve nulo se a Meta recusar (métrica sem permissão, conta pequena demais...). */
async function talvez<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

// ---------- datas ----------

const DIA = 86400;
const agoraSeg = () => Math.floor(Date.now() / 1000);
export function diaISO(seg: number) {
  return new Date(seg * 1000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Janelas de no máximo 30 dias (limite da Meta), cobrindo os últimos `dias` dias até ontem. */
function janelas(dias: number) {
  const fim = agoraSeg();
  const lista: { since: number; until: number }[] = [];
  for (let ate = fim; ate > fim - dias * DIA; ate -= 30 * DIA) lista.push({ since: Math.max(ate - 30 * DIA, fim - dias * DIA), until: ate });
  return lista;
}

type Valores = { data?: { name: string; values?: { value: number | Record<string, number>; end_time: string }[]; total_value?: { value: number } }[] };

/** Série diária de uma métrica: { "2026-11-20": 123, ... }. */
async function serie(objeto: string, metrica: string, token: string, dias: number, extra: Record<string, string> = {}) {
  const porDia: Record<string, number> = {};
  const partes = await Promise.all(janelas(dias).map((j) => graph<Valores>(`${objeto}/insights`, token, { metric: metrica, period: "day", ...j, ...extra })));
  for (const p of partes) for (const v of p.data?.[0]?.values ?? []) {
    const dia = diaISO(Date.parse(v.end_time) / 1000 - DIA);
    porDia[dia] = (porDia[dia] ?? 0) + (typeof v.value === "number" ? v.value : Object.values(v.value).reduce((a, b) => a + b, 0));
  }
  return porDia;
}

/** Primeira métrica da lista que a Meta aceitar (os nomes mudam de uma versão para outra). */
async function primeiraSerie(objeto: string, metricas: string[], token: string, dias: number) {
  for (const m of metricas) {
    const s = await talvez(serie(objeto, m, token, dias));
    if (s && Object.keys(s).length) return s;
  }
  return null;
}

/** Totais do período (métricas que a Meta só entrega somadas). */
async function totais(objeto: string, metricas: string[], token: string, dias: number) {
  const soma: Record<string, number> = {};
  for (const j of janelas(dias)) {
    const r = await talvez(graph<Valores>(`${objeto}/insights`, token, { metric: metricas.join(","), period: "day", metric_type: "total_value", ...j }));
    for (const d of r?.data ?? []) soma[d.name] = (soma[d.name] ?? 0) + (d.total_value?.value ?? 0);
  }
  return soma;
}

// ---------- Instagram ----------

export type Post = {
  id: string;
  legenda: string;
  tipo: string;
  imagem: string | null;
  link: string;
  em: string;
  curtidas: number;
  comentarios: number;
  alcance: number | null;
  salvos: number | null;
  compartilhamentos: number | null;
  interacoes: number;
};

export type DadosInstagram = {
  usuario: string;
  seguidores: number;
  posts: number;
  alcancePorDia: Record<string, number>;
  seguidoresPorDia: Record<string, number> | null;
  totais: Record<string, number>;
  totaisAntes: Record<string, number>;
  publicacoes: Post[];
  cidades: { nome: string; valor: number }[];
};

type Midia = { id: string; caption?: string; media_type: string; media_product_type?: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string; like_count?: number; comments_count?: number };

const METRICAS_IG = ["views", "reach", "profile_views", "accounts_engaged", "total_interactions", "website_clicks"];

export async function dadosInstagram(c: Conexao, dias: number): Promise<DadosInstagram> {
  const t = c.token!;
  const ig = c.ig_id!;
  const [perfil, alcancePorDia, seguidoresPorDia, tot, totAntes, midias, demografia] = await Promise.all([
    graph<{ username: string; followers_count: number; media_count: number }>(ig, t, { fields: "username,followers_count,media_count" }),
    serie(ig, "reach", t, dias).catch(() => ({})),
    talvez(serie(ig, "follower_count", t, Math.min(dias, 30))),
    totais(ig, METRICAS_IG, t, dias),
    totaisAntes(ig, METRICAS_IG, t, dias),
    graph<{ data: Midia[] }>(`${ig}/media`, t, { fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: 30 }),
    talvez(graph<{ data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] }>(`${ig}/insights`, t, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "city" })),
  ]);
  const publicacoes = await Promise.all(
    midias.data.slice(0, 18).map(async (m): Promise<Post> => {
      const ins = await talvez(graph<Valores>(`${m.id}/insights`, t, { metric: "reach,saved,shares,total_interactions" }));
      const v = (n: string) => ins?.data?.find((d) => d.name === n)?.values?.[0]?.value as number | undefined;
      const curtidas = m.like_count ?? 0;
      const comentarios = m.comments_count ?? 0;
      return {
        id: m.id,
        legenda: m.caption ?? "",
        tipo: m.media_product_type === "REELS" ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : m.media_type === "VIDEO" ? "Vídeo" : "Foto",
        imagem: m.thumbnail_url ?? m.media_url ?? null,
        link: m.permalink,
        em: m.timestamp,
        curtidas,
        comentarios,
        alcance: v("reach") ?? null,
        salvos: v("saved") ?? null,
        compartilhamentos: v("shares") ?? null,
        interacoes: v("total_interactions") ?? curtidas + comentarios,
      };
    }),
  );
  const cidades = (demografia?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])
    .map((r) => ({ nome: r.dimension_values[0] ?? "", valor: r.value }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);
  return { usuario: perfil.username, seguidores: perfil.followers_count, posts: perfil.media_count, alcancePorDia, seguidoresPorDia, totais: tot, totaisAntes: totAntes, publicacoes, cidades };
}

/** Os mesmos totais no período anterior de mesmo tamanho (para comparar). */
async function totaisAntes(objeto: string, metricas: string[], token: string, dias: number) {
  const soma: Record<string, number> = {};
  const fim = agoraSeg() - dias * DIA;
  for (let ate = fim; ate > fim - dias * DIA; ate -= 30 * DIA) {
    const since = Math.max(ate - 30 * DIA, fim - dias * DIA);
    const r = await talvez(graph<Valores>(`${objeto}/insights`, token, { metric: metricas.join(","), period: "day", metric_type: "total_value", since, until: ate }));
    for (const d of r?.data ?? []) soma[d.name] = (soma[d.name] ?? 0) + (d.total_value?.value ?? 0);
  }
  return soma;
}

// ---------- Facebook ----------

export type PostFacebook = { id: string; texto: string; imagem: string | null; link: string; em: string; reacoes: number; comentarios: number; compartilhamentos: number };

export type DadosFacebook = {
  nome: string;
  seguidores: number;
  curtidas: number;
  link: string | null;
  alcancePorDia: Record<string, number> | null;
  visualizacoesPorDia: Record<string, number> | null;
  engajamentoPorDia: Record<string, number> | null;
  novosSeguidoresPorDia: Record<string, number> | null;
  visitasPorDia: Record<string, number> | null;
  publicacoes: PostFacebook[];
};

type PostBruto = { id: string; message?: string; full_picture?: string; permalink_url: string; created_time: string; shares?: { count: number }; reactions?: { summary?: { total_count: number } }; comments?: { summary?: { total_count: number } } };

export async function dadosFacebook(c: Conexao, dias: number): Promise<DadosFacebook> {
  const t = c.token!;
  const p = c.page_id;
  const [pagina, alcance, visualizacoes, engajamento, novos, visitas, posts] = await Promise.all([
    graph<{ name: string; followers_count?: number; fan_count?: number; link?: string }>(p, t, { fields: "name,followers_count,fan_count,link" }),
    primeiraSerie(p, ["page_total_media_view_unique", "page_impressions_unique"], t, dias),
    primeiraSerie(p, ["page_media_view", "page_impressions"], t, dias),
    primeiraSerie(p, ["page_post_engagements"], t, dias),
    primeiraSerie(p, ["page_daily_follows_unique", "page_fan_adds_unique"], t, dias),
    primeiraSerie(p, ["page_views_total"], t, dias),
    talvez(graph<{ data: PostBruto[] }>(`${p}/posts`, t, { fields: "id,message,full_picture,permalink_url,created_time,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)", limit: 15 })),
  ]);
  return {
    nome: pagina.name,
    seguidores: pagina.followers_count ?? pagina.fan_count ?? 0,
    curtidas: pagina.fan_count ?? 0,
    link: pagina.link ?? null,
    alcancePorDia: alcance,
    visualizacoesPorDia: visualizacoes,
    engajamentoPorDia: engajamento,
    novosSeguidoresPorDia: novos,
    visitasPorDia: visitas,
    publicacoes: (posts?.data ?? []).map((x) => ({
      id: x.id,
      texto: x.message ?? "",
      imagem: x.full_picture ?? null,
      link: x.permalink_url,
      em: x.created_time,
      reacoes: x.reactions?.summary?.total_count ?? 0,
      comentarios: x.comments?.summary?.total_count ?? 0,
      compartilhamentos: x.shares?.count ?? 0,
    })),
  };
}

// ---------- Mensagens ----------

export type Conversa = { id: string; rede: "instagram" | "messenger"; nome: string; ultima: string; em: string; deles: boolean; naoLidas: number };
export type Mensagem = { id: string; texto: string; em: string; deles: boolean; anexos: { url: string; nome: string; imagem: boolean }[] };

type Participante = { id: string; name?: string; username?: string };
type ConversaBruta = { id: string; updated_time: string; unread_count?: number; participants?: { data: Participante[] }; messages?: { data: { message?: string; from?: Participante; created_time: string }[] } };

function nosso(c: Conexao, id?: string) {
  return id === c.page_id || id === c.ig_id;
}

export async function conversas(c: Conexao): Promise<{ lista: Conversa[]; erros: string[] }> {
  const erros: string[] = [];
  const redes = (["instagram", "messenger"] as const).filter((r) => r === "messenger" || c.ig_id);
  const partes = await Promise.all(
    redes.map((rede) =>
      graph<{ data: ConversaBruta[] }>(`${c.page_id}/conversations`, c.token!, {
        platform: rede,
        fields: "id,updated_time,unread_count,participants,messages.limit(1){message,from,created_time}",
        limit: 40,
      })
        .then((r) => r.data.map((x): Conversa => {
          const outro = x.participants?.data.find((p) => !nosso(c, p.id));
          const m = x.messages?.data[0];
          return {
            id: x.id,
            rede,
            nome: outro?.username ? `@${outro.username}` : outro?.name ?? "Pessoa sem nome",
            ultima: m?.message || (m ? "(foto ou anexo)" : ""),
            em: m?.created_time ?? x.updated_time,
            deles: m ? !nosso(c, m.from?.id) : false,
            naoLidas: x.unread_count ?? 0,
          };
        }))
        .catch((e: Error) => {
          erros.push(`${rede === "instagram" ? "Instagram" : "Facebook"}: ${e.message}`);
          return [] as Conversa[];
        }),
    ),
  );
  return { lista: partes.flat().sort((a, b) => b.em.localeCompare(a.em)), erros };
}

export async function conversa(c: Conexao, id: string) {
  const r = await graph<{ participants?: { data: Participante[] }; messages?: { data: { id: string; message?: string; from?: Participante; created_time: string; attachments?: { data: { name?: string; file_url?: string; image_data?: { url: string } }[] } }[] } }>(id, c.token!, {
    fields: "participants,messages.limit(60){id,message,from,created_time,attachments{name,file_url,image_data}}",
  });
  const outro = r.participants?.data.find((p) => !nosso(c, p.id));
  const mensagens: Mensagem[] = (r.messages?.data ?? [])
    .map((m) => ({
      id: m.id,
      texto: m.message ?? "",
      em: m.created_time,
      deles: !nosso(c, m.from?.id),
      anexos: (m.attachments?.data ?? []).map((a) => ({ url: a.image_data?.url ?? a.file_url ?? "", nome: a.name ?? "anexo", imagem: Boolean(a.image_data) })).filter((a) => a.url),
    }))
    .reverse();
  return { nome: outro?.username ? `@${outro.username}` : outro?.name ?? "Pessoa sem nome", usuario: outro?.username ?? null, mensagens };
}

/** Guarda os números do dia (o histórico da Meta só volta 30 dias). Falha em silêncio. */
export async function guardarDia(rede: "instagram" | "facebook", valores: { seguidores?: number | null; alcance?: number | null; visualizacoes?: number | null; interacoes?: number | null }) {
  try {
    const supabase = await createClient();
    await supabase.from("redes_diario").upsert({ dia: diaISO(agoraSeg()), rede, ...valores });
  } catch {
    // o histórico é um extra: não atrapalha a tela
  }
}
