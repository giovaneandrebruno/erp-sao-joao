-- Importação de arquivos (planilhas, PDFs, imagens) para dentro do sistema.
-- Cada arquivo enviado vira uma linha em "importacoes". Os registros criados a partir dele
-- guardam o id da importação, para poder atualizar com uma planilha nova ou limpar tudo depois.

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('producao', 'clientes', 'fornecedores', 'estoque', 'financeiro')),
  arquivo_nome text not null,
  arquivo_caminho text,
  arquivo_tipo text,
  modo text not null default 'atualizar',
  linhas_lidas integer not null default 0,
  inseridos integer not null default 0,
  atualizados integer not null default 0,
  removidos integer not null default 0,
  avisos text[] not null default '{}',
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on importacoes (area, criado_em desc);

alter table importacoes enable row level security;
create policy "escritorio_acesso_total" on importacoes for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on importacoes to authenticated;

-- Marcação de origem nos registros que podem vir de arquivo
do $$
declare t text;
begin
  foreach t in array array['clientes', 'fornecedores', 'produtos', 'ordens_producao', 'lancamentos']
  loop
    execute format('alter table %I add column if not exists importacao_id uuid references importacoes(id) on delete set null', t);
    execute format('alter table %I add column if not exists chave_importacao text', t);
    -- colunas da planilha que não têm lugar próprio no sistema ficam guardadas aqui
    execute format('alter table %I add column if not exists extras jsonb', t);
    execute format('create index if not exists %I on %I (importacao_id)', t || '_importacao_idx', t);
  end loop;
end $$;

-- A planilha de produção (PCP) costuma trazer cliente e ambiente mesmo sem pedido no sistema
alter table ordens_producao
  add column if not exists cliente_nome text,
  add column if not exists ambiente text;

-- ---------------------------------------------------------------- arquivos originais (Storage)
insert into storage.buckets (id, name, public, file_size_limit)
values ('importacoes', 'importacoes', false, 52428800)
on conflict (id) do nothing;
create policy "importacoes_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'importacoes' and public.eh_escritorio());
create policy "importacoes_ver" on storage.objects for select to authenticated
  using (bucket_id = 'importacoes' and public.eh_escritorio());
create policy "importacoes_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'importacoes' and public.eh_escritorio());

-- ---------------------------------------------------------------- limpar o que veio de arquivos (pede a senha)
create function public.limpar_importacoes(p_area text, p_senha text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ok boolean;
  v_removidos integer := 0;
  v_mantidos integer := 0;
  v_arquivos text[];
begin
  if auth.uid() is null or not public.eh_escritorio() then raise exception 'Sem permissão.'; end if;
  if p_area = 'financeiro' and not public.eh_admin() then raise exception 'Só o administrador limpa o financeiro.'; end if;
  if p_area not in ('producao', 'clientes', 'fornecedores', 'estoque', 'financeiro') then raise exception 'Área inválida.'; end if;

  select u.encrypted_password = extensions.crypt(coalesce(p_senha, ''), u.encrypted_password)
    into v_ok from auth.users u where u.id = auth.uid();
  if not coalesce(v_ok, false) then
    perform pg_sleep(1);
    raise exception 'Senha incorreta.';
  end if;

  select coalesce(array_agg(arquivo_caminho) filter (where arquivo_caminho is not null), '{}')
    into v_arquivos from importacoes where area = p_area;

  if p_area = 'producao' then
    delete from ordens_producao where importacao_id is not null;
    get diagnostics v_removidos = row_count;
  elsif p_area = 'fornecedores' then
    delete from fornecedores where importacao_id is not null;
    get diagnostics v_removidos = row_count;
  elsif p_area = 'estoque' then
    delete from produtos where importacao_id is not null;
    get diagnostics v_removidos = row_count;
  elsif p_area = 'financeiro' then
    delete from lancamentos where importacao_id is not null;
    get diagnostics v_removidos = row_count;
  elsif p_area = 'clientes' then
    -- cliente que já tem orçamento, pedido, negociação ou chamado fica, para não perder esse histórico
    delete from clientes c where c.importacao_id is not null
      and not exists (select 1 from orcamentos o where o.cliente_id = c.id)
      and not exists (select 1 from pedidos p where p.cliente_id = c.id)
      and not exists (select 1 from negociacoes n where n.cliente_id = c.id)
      and not exists (select 1 from chamados ch where ch.cliente_id = c.id);
    get diagnostics v_removidos = row_count;
    update clientes set importacao_id = null, chave_importacao = null where importacao_id is not null;
    get diagnostics v_mantidos = row_count;
  end if;

  delete from importacoes where area = p_area;
  return jsonb_build_object('removidos', v_removidos, 'mantidos', v_mantidos, 'arquivos', to_jsonb(v_arquivos));
end $$;
revoke execute on function public.limpar_importacoes(text, text) from public, anon;
grant execute on function public.limpar_importacoes(text, text) to authenticated;
