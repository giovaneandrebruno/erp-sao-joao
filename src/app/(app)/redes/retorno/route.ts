import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { perfilAtual } from "@/lib/perfil";
import { enderecoDoSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { VERSAO_GRAPH, appConfigurado, cifrar } from "@/lib/redes";

type Pagina = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };

async function pedir<T>(url: URL): Promise<T> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const corpo = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok || corpo.error) throw new Error(corpo.error?.message ?? `Erro ${r.status}`);
  return corpo;
}

/** Volta do login do Facebook: troca o código por uma chave da página que não expira e guarda cifrada. */
export async function GET(request: NextRequest) {
  const site = await enderecoDoSite();
  const voltar = (q: string) => NextResponse.redirect(`${site}/redes?${q}`);
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") return NextResponse.redirect(`${site}/`);
  if (!appConfigurado()) return voltar("erro=app");

  const jar = await cookies();
  const estado = jar.get("redes_estado")?.value;
  jar.delete({ name: "redes_estado", path: "/redes" });
  const p = request.nextUrl.searchParams;
  if (p.get("error")) return voltar("erro=cancelado");
  const codigo = p.get("code");
  if (!codigo || !estado || p.get("state") !== estado) return voltar("erro=estado");

  try {
    const base = `https://graph.facebook.com/${VERSAO_GRAPH}`;
    const u1 = new URL(`${base}/oauth/access_token`);
    u1.searchParams.set("client_id", process.env.META_APP_ID!);
    u1.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    u1.searchParams.set("redirect_uri", `${site}/redes/retorno`);
    u1.searchParams.set("code", codigo);
    const curta = await pedir<{ access_token: string }>(u1);

    // chave de 60 dias da pessoa; a chave da página tirada dela não expira
    const u2 = new URL(`${base}/oauth/access_token`);
    u2.searchParams.set("grant_type", "fb_exchange_token");
    u2.searchParams.set("client_id", process.env.META_APP_ID!);
    u2.searchParams.set("client_secret", process.env.META_APP_SECRET!);
    u2.searchParams.set("fb_exchange_token", curta.access_token);
    const longa = await pedir<{ access_token: string }>(u2);

    const u3 = new URL(`${base}/me/accounts`);
    u3.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
    u3.searchParams.set("limit", "100");
    u3.searchParams.set("access_token", longa.access_token);
    const { data: paginas } = await pedir<{ data: Pagina[] }>(u3);
    const pagina = paginas.find((x) => x.instagram_business_account) ?? paginas[0];
    if (!pagina) return voltar("erro=sem-pagina");

    const supabase = await createClient();
    const { error } = await supabase.from("redes_conexao").upsert({
      id: 1,
      page_id: pagina.id,
      page_nome: pagina.name,
      ig_id: pagina.instagram_business_account?.id ?? null,
      ig_usuario: pagina.instagram_business_account?.username ?? null,
      token_cifrado: cifrar(pagina.access_token),
      conectado_em: new Date().toISOString(),
      conectado_por_nome: perfil.nome || perfil.email,
    });
    if (error) throw new Error(error.message);
    return voltar(pagina.instagram_business_account ? "ligado=1" : "ligado=1&sem-instagram=1");
  } catch (e) {
    return voltar(`erro=meta&detalhe=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
  }
}
