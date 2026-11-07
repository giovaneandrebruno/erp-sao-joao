import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { inicioDo, podeAbrir, type Papel } from "@/lib/acesso";

const ROTAS_PUBLICAS = ["/login", "/auth", "/p/"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);
  const publica = ROTAS_PUBLICAS.some((r) => request.nextUrl.pathname.startsWith(r));

  if (!logado && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (logado && !publica) {
    const { data: perfil } = await supabase.from("perfis").select("papel").eq("user_id", String(data!.claims.sub)).maybeSingle();
    const papel = (perfil?.papel ?? null) as Papel | null;
    const caminho = request.nextUrl.pathname;
    if (!papel && caminho !== "/sem-acesso") {
      const url = request.nextUrl.clone();
      url.pathname = "/sem-acesso";
      return NextResponse.redirect(url);
    }
    if (papel && !podeAbrir(papel, caminho)) {
      const url = request.nextUrl.clone();
      url.pathname = inicioDo(papel);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
