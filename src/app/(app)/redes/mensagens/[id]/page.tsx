import Link from "next/link";
import { connection } from "next/server";
import { Cartao, Titulo, estiloBotao } from "@/components/ui";
import { dataHora } from "@/lib/format";
import { conexaoAtual, conversa } from "@/lib/redes";
import { ErroDaMeta, SemConexao } from "../../comum";

export default async function ConversaPage({ params }: PageProps<"/redes/mensagens/[id]">) {
  await connection();
  const id = decodeURIComponent((await params).id);
  const conexao = await conexaoAtual();
  if (!conexao?.token) return <SemConexao conexao={conexao} />;
  if (!/^[\w.:=-]+$/.test(id)) return <ErroDaMeta mensagem="Conversa inválida." />;
  let c: Awaited<ReturnType<typeof conversa>>;
  try {
    c = await conversa(conexao, id);
  } catch (e) {
    return <ErroDaMeta mensagem={(e as Error).message} />;
  }
  const doInstagram = Boolean(c.usuario);
  const responder = doInstagram ? "https://www.instagram.com/direct/inbox/" : "https://business.facebook.com/latest/inbox/all";
  const cadastro = `/clientes/novo?${new URLSearchParams({ nome: c.usuario ?? c.nome, origem: doInstagram ? "Instagram" : "Facebook" })}`;

  return (
    <>
      <Titulo
        sub={<Link href="/redes/mensagens" className="hover:text-violeta">← Todas as mensagens</Link>}
        acao={
          <div className="flex flex-wrap gap-2">
            <Link href={cadastro} className={estiloBotao.secundario}>Cadastrar como cliente</Link>
            <a href={responder} target="_blank" rel="noreferrer" className={estiloBotao.primario}>Responder no {doInstagram ? "Instagram" : "Facebook"}</a>
          </div>
        }
      >
        {c.nome}
      </Titulo>
      <Cartao>
        {c.mensagens.length ? (
          <ul className="flex flex-col gap-3">
            {c.mensagens.map((m) => (
              <li key={m.id} className={`flex ${m.deles ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.deles ? "bg-stone-100 text-stone-900" : "bg-violeta/10 text-stone-900"}`}>
                  {m.texto && <p className="whitespace-pre-wrap">{m.texto}</p>}
                  {m.anexos.map((a) =>
                    a.imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={a.url} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.nome} className="mt-1 max-h-60 rounded-lg" /></a>
                    ) : (
                      <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block underline">{a.nome}</a>
                    ),
                  )}
                  <div className="mt-1 text-[11px] text-stone-500">{m.deles ? c.nome : "Você"} · {dataHora(m.em)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-stone-400">Nenhuma mensagem nesta conversa.</p>
        )}
      </Cartao>
    </>
  );
}
