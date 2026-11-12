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

-- ---------------------------------------------------------------- confirmar a senha antes de limpar o que veio de arquivos
create function public.conferir_minha_senha(p_senha text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_ok boolean;
begin
  if auth.uid() is null then return false; end if;
  select u.encrypted_password = extensions.crypt(coalesce(p_senha, ''), u.encrypted_password)
    into v_ok from auth.users u where u.id = auth.uid();
  if not coalesce(v_ok, false) then perform pg_sleep(1); end if;
  return coalesce(v_ok, false);
end $$;
revoke execute on function public.conferir_minha_senha(text) from public, anon;
grant execute on function public.conferir_minha_senha(text) to authenticated;
