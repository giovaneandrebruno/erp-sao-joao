-- Briefing do cliente (respostas da ficha de atendimento). Um por cliente. Só acrescenta.
create table if not exists public.cliente_briefing (
  id uuid not null default gen_random_uuid() unique,
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  preenchido_por_nome text default public.nome_do_usuario_atual(),
  alterado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.cliente_briefing enable row level security;
create policy "escritorio_acesso_total" on public.cliente_briefing for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.cliente_briefing to authenticated;

create or replace function public.briefing_alterado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  new.alterado_por_nome := public.nome_do_usuario_atual();
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'briefing_alterado' and tgrelid = 'public.cliente_briefing'::regclass) then
    create trigger briefing_alterado before update on public.cliente_briefing for each row execute function public.briefing_alterado();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = 'public.cliente_briefing'::regclass) then
    create trigger auditoria after insert or update or delete on public.cliente_briefing for each row execute function public.registrar_auditoria();
  end if;
end $$;
