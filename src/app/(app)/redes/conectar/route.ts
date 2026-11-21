import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { perfilAtual } from "@/lib/perfil";
import { enderecoDoSite } from "@/lib/site";
import { PERMISSOES, VERSAO_GRAPH, appConfigurado } from "@/lib/redes";

/** Leva o administrador para o login do Facebook, para ligar a página e o Instagram ao sistema. */
export async function GET() {
  const site = await enderecoDoSite();
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") return NextResponse.redirect(`${site}/`);
  if (!appConfigurado()) return NextResponse.redirect(`${site}/redes?erro=app`);
  const estado = randomBytes(16).toString("hex");
  (await cookies()).set("redes_estado", estado, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/redes" });
  const url = new URL(`https://www.facebook.com/${VERSAO_GRAPH}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", `${site}/redes/retorno`);
  url.searchParams.set("state", estado);
  url.searchParams.set("scope", PERMISSOES.join(","));
  url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url.toString());
}
