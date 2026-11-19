import { JanelaBotao } from "@/components/janela";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { ROTULOS2, decimal, pct } from "@/lib/format";
import { alternarAtivo, atualizarParceiro, atualizarPerfil, criarParceiro, excluirParceiro } from "./actions";
import { AcoesLinha, BotaoCancelar, BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";
import { NovoUsuario } from "./novo-usuario";
import { ROTULO_PAPEL } from "@/lib/acesso";
import { perfilAtual } from "@/lib/perfil";

type Pessoa = { nome?: string | null; tipo?: string | null; comissao_padrao?: number | null; telefone?: string | null; email?: string | null; chave_pix?: string | null };

function FormPessoa({ id, p = {} }: { id?: string; p?: Pessoa }) {
  return (
    <form action={id ? atualizarParceiro.bind(null, id) : criarParceiro} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Nome *" className="md:col-span-2"><input name="nome" required defaultValue={p.nome ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Tipo" className="md:col-span-2">
        <select name="tipo" defaultValue={p.tipo ?? "vendedor"} className={inputCls}>
          {Object.entries(ROTULOS2.tipoParceiro).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Comissão padrão (%)" className="md:col-span-2"><input name="comissao_padrao" inputMode="decimal" placeholder="usa a da configuração" defaultValue={decimal(p.comissao_padrao)} className={inputCls} /></Campo>
      <Campo rotulo="Telefone" className="md:col-span-2"><input name="telefone" defaultValue={p.telefone ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="E-mail" className="md:col-span-2"><input name="email" type="email" defaultValue={p.email ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Chave Pix" className="md:col-span-2"><input name="chave_pix" defaultValue={p.chave_pix ?? ""} className={inputCls} /></Campo>
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{id ? "Salvar alterações" : "Adicionar"}</Botao>
        {id && <BotaoCancelar />}
      </div>
    </form>
  );
}

export default async function EquipePage({ searchParams }: PageProps<"/equipe">) {
  const { editar } = await searchParams;
  const supabase = await createClient();
  const [{ data: parceiros }, { data: perfis }, eu] = await Promise.all([
    supabase.from("parceiros").select("*").order("tipo").order("nome"),
    supabase.from("perfis").select("*").order("criado_em"),
    perfilAtual(),
  ]);

  return (
    <>
      <Titulo acao={<JanelaBotao rotulo="Adicionar pessoa" titulo="Adicionar pessoa" descricao="Vendedor, arquiteto ou montador." aviso="Pessoa adicionada"><FormPessoa /></JanelaBotao>}>Equipe e parceiros</Titulo>
      <p className="mb-4 text-sm text-stone-500">Vendedores e arquitetos recebem comissão sobre os pedidos. Montadores aparecem nos prazos e na assistência técnica.</p>
      <div className="mb-8">
        <Tabela cabecalho={["Nome", "Tipo", "Comissão padrão", "Telefone", "Pix", ""]} vazio={!parceiros?.length}>
          {parceiros?.map((p) => (
            <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
              <td className="px-4 py-3 font-medium">{p.nome}</td>
              <td className="px-4 py-3"><Selo cor={p.tipo === "vendedor" ? "blue" : p.tipo === "arquiteto" ? "amber" : "stone"}>{ROTULOS2.tipoParceiro[p.tipo as keyof typeof ROTULOS2.tipoParceiro]}</Selo></td>
              <td className="px-4 py-3">{p.comissao_padrao != null ? pct(p.comissao_padrao) : "—"}</td>
              <td className="px-4 py-3">{p.telefone ?? "—"}</td>
              <td className="px-4 py-3">{p.chave_pix ?? "—"}</td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <form action={alternarAtivo.bind(null, p.id, !p.ativo)} className="mr-2"><button className="text-xs text-stone-500 hover:underline">{p.ativo ? "desativar" : "reativar"}</button></form>
                  <LinkEditar id={p.id} />
                  <BotaoExcluir acao={excluirParceiro.bind(null, p.id)} titulo="Excluir esta pessoa?" detalhe={<strong>{p.nome}</strong>} aviso="Pessoa excluída" />
                </AcoesLinha>
              </td>
            </tr>
          ))}
        </Tabela>
      </div>

      <div className="mb-1 mt-12 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Usuários e acessos</h2>
        <JanelaBotao rotulo="Criar usuário" titulo="Criar usuário" descricao="A pessoa entra no sistema com este e-mail e a senha inicial." variante="secundario">
          <NovoUsuario parceiros={(parceiros ?? []).filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))} />
        </JanelaBotao>
      </div>
      <p className="mb-4 text-sm text-stone-500">Administrador vê tudo. Escritório / vendas não vê financeiro, comissões, relatórios, equipe e configurações. Montador não tem acesso às telas do sistema.</p>
      <div className="mb-6">
        <Tabela cabecalho={["E-mail", "Nome", "Perfil", "Pessoa da equipe", ""]} vazio={!perfis?.length}>
          {perfis?.map((u) => (
            <tr key={u.user_id}>
              <td colSpan={5} className="py-2">
                <form action={atualizarPerfil.bind(null, u.user_id)} className="grid items-center gap-3 md:grid-cols-[1.4fr_1fr_1.2fr_1fr_auto]">
                  <span className="text-sm font-medium">{u.email}{u.user_id === eu?.user_id && <span className="ml-2 text-xs text-stone-400">(você)</span>}</span>
                  <input name="nome" defaultValue={u.nome ?? ""} placeholder="nome" className={inputCls} />
                  <select name="papel" defaultValue={u.papel} className={inputCls}>
                    {Object.entries(ROTULO_PAPEL).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                  </select>
                  <select name="parceiro_id" defaultValue={u.parceiro_id ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {parceiros?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <button className="text-sm font-medium text-madeira-700 hover:underline">salvar</button>
                </form>
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
      {(() => {
        const p = typeof editar === "string" ? parceiros?.find((x) => x.id === editar) : undefined;
        return p ? (
          <JanelaEditar key={p.id} titulo="Alterar pessoa" descricao={p.nome} aviso="Pessoa salva">
            <FormPessoa id={p.id} p={p} />
          </JanelaEditar>
        ) : null;
      })()}
    </>
  );
}
