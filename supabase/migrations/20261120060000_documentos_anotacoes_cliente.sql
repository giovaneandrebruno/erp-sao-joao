-- Pasta do cliente: documentos (arquivos) e anotações (só acrescenta, nada é apagado).
-- Qualquer pessoa da equipe do escritório (administrador ou vendedor) envia, troca e exclui
-- arquivos, como o pedido fechado assinado e o memorial descritivo, e escreve anotações.

-- ───────────────────────── quem fez (nome guardado junto) ─────────────────────────
create or replace function public.nome_do_usuario_atual() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.nome, ''), p.email, 'Usuário') from perfis p where p.user_id = auth.uid()
$$;
revoke all on function public.nome_do_usuario_atual() from public, anon;
grant execute on function public.nome_do_usuario_atual() to authenticated;

-- ───────────────────────── documentos ─────────────────────────
create table if not exists public.cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'outro',
  descricao text,
  nome_arquivo text not null,
  caminho text not null unique,
  tamanho bigint,
  tipo_arquivo text,
  enviado_por uuid default auth.uid(),
  enviado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cliente_documentos_tipo_check') then
    alter table public.cliente_documentos add constraint cliente_documentos_tipo_check check (tipo in (
      'pedido_fechado', 'memorial_descritivo', 'briefing', 'contrato', 'projeto', 'medidas', 'comprovante', 'foto', 'outro'
    ));
  end if;
end $$;
create index if not exists cliente_documentos_cliente_id_idx on public.cliente_documentos (cliente_id, criado_em desc);
alter table public.cliente_documentos enable row level security;
create policy "escritorio_acesso_total" on public.cliente_documentos for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.cliente_documentos to authenticated;

-- ───────────────────────── anotações ─────────────────────────
create table if not exists public.cliente_anotacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  criado_por uuid default auth.uid(),
  criado_por_nome text default public.nome_do_usuario_atual(),
  alterado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists cliente_anotacoes_cliente_id_idx on public.cliente_anotacoes (cliente_id, criado_em desc);
alter table public.cliente_anotacoes enable row level security;
create policy "escritorio_acesso_total" on public.cliente_anotacoes for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.cliente_anotacoes to authenticated;

-- Ao alterar: guarda a hora e quem alterou (sem depender do app).
create or replace function public.pasta_cliente_alterado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_table_name = 'cliente_anotacoes' then
    new.alterado_por_nome := public.nome_do_usuario_atual();
  else
    new.enviado_por := auth.uid();
    new.enviado_por_nome := public.nome_do_usuario_atual();
  end if;
  return new;
end $$;

do $$
declare v_tab text;
begin
  foreach v_tab in array array['cliente_documentos', 'cliente_anotacoes'] loop
    if not exists (select 1 from pg_trigger where tgname = 'pasta_alterado' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger pasta_alterado before update on public.%I for each row execute function public.pasta_cliente_alterado()', v_tab);
    end if;
    -- histórico de alterações (mesma regra das outras tabelas)
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;

-- ───────────────────────── arquivos (Storage, pasta privada) ─────────────────────────
-- Até 50 MB por arquivo. Só a equipe do escritório envia, abre, troca e apaga.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

create policy "documentos_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.eh_escritorio());
create policy "documentos_ver" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.eh_escritorio());
create policy "documentos_trocar" on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and public.eh_escritorio())
  with check (bucket_id = 'documentos' and public.eh_escritorio());
create policy "documentos_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.eh_escritorio());

-- Para desfazer (à mão, se um dia precisar):
-- drop table public.cliente_anotacoes; drop table public.cliente_documentos;
-- drop function public.pasta_cliente_alterado(); drop function public.nome_do_usuario_atual();
-- (os arquivos ficam no Storage, pasta "documentos")
