-- Agendas do Google ligadas por cada usuário (pelo "endereço secreto no formato iCal").
-- O endereço dá acesso de leitura à agenda, então cada pessoa só vê e mexe nas próprias.
create table if not exists public.agendas_google (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default 'Google Agenda',
  url text not null,
  criado_em timestamptz not null default now()
);

create index if not exists agendas_google_user_idx on public.agendas_google (user_id);

alter table public.agendas_google enable row level security;

create policy "so_o_dono" on public.agendas_google
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.agendas_google from anon;
grant select, insert, update, delete on public.agendas_google to authenticated;
