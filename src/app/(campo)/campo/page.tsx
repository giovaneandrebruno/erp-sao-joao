import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { data, hojeISO } from "@/lib/format";
import { servicosEmAberto, type Servico } from "./dados";

export default async function CampoPage({ searchParams }: PageProps<"/campo">) {
  const sp = await searchParams;
  const perfil = await perfilAtual();
  const montador = perfil?.papel === "montador";
  const filtro = montador ? perfil?.parceiro_id ?? "00000000-0000-0000-0000-000000000000" : typeof sp.montador === "string" && sp.montador ? sp.montador : null;

  const supabase = await createClient();
  const [servicos, { data: montadores }] = await Promise.all([
    servicosEmAberto(filtro),
    montador ? Promise.resolve({ data: [] as { id: string; nome: string }[] }) : supabase.from("parceiros").select("id, nome").eq("tipo", "montador").eq("ativo", true).order("nome"),
  ]);

  const hoje = hojeISO();
  const atrasados = servicos.filter((s) => s.data && s.data < hoje);
  const deHoje = servicos.filter((s) => s.data === hoje);
  const proximos = servicos.filter((s) => !s.data || s.data > hoje);

  return (
    <>
      <div className="mb-6">
        <p className="text-sm text-stone-500">{perfil?.nome ? `Olá, ${perfil.nome.split(" ")[0]}!` : "Olá!"}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Meus serviços</h1>
      </div>

      {montador && !perfil?.parceiro_id && (
        <p className="vidro mb-6 rounded-2xl p-4 text-sm text-stone-600">Seu usuário ainda não está ligado a um montador da equipe. Peça ao administrador para ligar em Equipe e parceiros.</p>
      )}

      {!montador && (
        <form className="mb-6 flex gap-2">
          <select name="montador" defaultValue={filtro ?? ""} className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
            <option value="">Todos os montadores</option>
            {montadores?.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <button className="rounded-full bg-gradient-to-r from-violeta to-ciano px-4 text-sm font-semibold text-white">Ver</button>
        </form>
      )}

      <Grupo titulo="Atrasados" itens={atrasados} alerta mostrarResp={!montador} />
      <Grupo titulo="Hoje" itens={deHoje} mostrarResp={!montador} />
      <Grupo titulo="Próximos" itens={proximos} mostrarResp={!montador} />
      {!servicos.length && <p className="vidro rounded-2xl p-8 text-center text-sm text-stone-500">Nenhum serviço em aberto. 🎉</p>}
    </>
  );
}

function Grupo({ titulo, itens, alerta, mostrarResp }: { titulo: string; itens: Servico[]; alerta?: boolean; mostrarResp?: boolean }) {
  if (!itens.length) return null;
  return (
    <section className="mb-6">
      <h2 className={`mb-2 text-[11px] font-medium uppercase tracking-[0.2em] ${alerta ? "text-rosa" : "text-stone-500"}`}>{titulo} · {itens.length}</h2>
      <ul className="space-y-2">
        {itens.map((s) => (
          <li key={s.chave}>
            <Link href={`/campo/${s.tipo}/${s.id}`} className="vidro flex items-center gap-4 rounded-2xl p-4 transition hover:border-violeta/40">
              <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white ${alerta ? "bg-rosa" : "bg-gradient-to-br from-violeta to-ciano"}`}>
                <span className="text-lg font-semibold leading-none">{s.data ? s.data.slice(8, 10) : "—"}</span>
                <span className="text-[10px] uppercase">{s.data ? data(s.data).slice(3, 5) : ""}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{s.cliente}</div>
                <div className="truncate text-sm text-stone-500">{s.titulo}</div>
                {s.endereco && <div className="truncate text-xs text-stone-400">{s.endereco}</div>}
                {mostrarResp && s.responsavel && <div className="text-xs text-violeta">{s.responsavel}</div>}
              </div>
              <span className="text-stone-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
