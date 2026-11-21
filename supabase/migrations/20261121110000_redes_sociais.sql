-- Redes sociais e uso do site.
-- acessos_sistema: cada tela aberta por alguém da equipe (para a aba "Site" de Redes sociais).
-- redes_conexao: a página do Facebook e o Instagram ligados ao sistema. A chave de acesso da Meta
--   fica cifrada (a senha de decifrar só existe no servidor, nas variáveis de ambiente da Vercel).
-- redes_diario: uma foto por dia dos números das redes, para guardar o histórico além dos 30 dias da Meta.

create table if not exists public.acessos_sistema (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  nome text default public.nome_do_usuario_atual(),
  caminho text not null check (length(caminho) between 1 and 300),
  em timestamptz not null default now()
);
create index if not exists acessos_sistema_em_idx on public.acessos_sistema (em desc);
alter table public.acessos_sistema enable row level security;
-- cada pessoa só registra o próprio acesso; só o administrador vê os acessos
create policy "registra_o_proprio" on public.acessos_sistema for insert to authenticated
  with check (user_id = auth.uid());
create policy "admin_ve" on public.acessos_sistema for select to authenticated
  using (public.eh_admin());
grant select, insert on public.acessos_sistema to authenticated;

create table if not exists public.redes_conexao (
  id smallint primary key default 1 check (id = 1),
  page_id text not null,
  page_nome text,
  ig_id text,
  ig_usuario text,
  token_cifrado text not null,
  conectado_em timestamptz not null default now(),
  conectado_por_nome text default public.nome_do_usuario_atual()
);
alter table public.redes_conexao enable row level security;
create policy "admin_acesso_total" on public.redes_conexao for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
grant select, insert, update, delete on public.redes_conexao to authenticated;

create table if not exists public.redes_diario (
  dia date not null,
  rede text not null check (rede in ('instagram', 'facebook')),
  seguidores integer,
  alcance integer,
  visualizacoes integer,
  interacoes integer,
  primary key (dia, rede)
);
alter table public.redes_diario enable row level security;
create policy "admin_acesso_total" on public.redes_diario for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
grant select, insert, update, delete on public.redes_diario to authenticated;

-- Para desfazer:
-- drop table public.redes_diario; drop table public.redes_conexao; drop table public.acessos_sistema;
