-- Melhorias de 2026-11-20:
-- 1. Cópia de segurança automática todo dia (30 dias guardados dentro do banco).
-- 2. Histórico de alterações: quem criou, mudou ou excluiu cada registro importante.
-- 3. Proposta online: conta quantas vezes o cliente abriu e quando foi a última.
-- 4. Lista de melhorias do sistema, com nota de resultado e de esforço.
-- 5. Tamanho do banco para o administrador acompanhar.
-- Nada aqui apaga dados.

-- ───────────────────────── 1. Cópia automática ─────────────────────────
create extension if not exists pg_cron with schema pg_catalog;

-- esquema fora do site: só as funções abaixo leem e gravam nele
create schema if not exists copias;
revoke all on schema copias from public;
revoke all on schema copias from anon, authenticated;

-- 30 "gavetas": cada dia grava por cima da gaveta de 30 dias atrás (sem precisar apagar nada)
create table if not exists copias.copias (
  gaveta smallint primary key check (gaveta between 0 and 29),
  feita_em timestamptz not null default now(),
  origem text not null default 'automatica' check (origem in ('automatica', 'manual')),
  registros integer not null default 0,
  tamanho_bytes bigint not null default 0,
  dados jsonb not null
);
revoke all on copias.copias from public, anon, authenticated;

create or replace function copias.fazer_copia(p_origem text default 'automatica')
returns void
language plpgsql
security definer
set search_path = public, copias
as $$
declare
  v_tab text;
  v_linhas jsonb;
  v_dados jsonb := '{}'::jsonb;
  v_total integer := 0;
begin
  for v_tab in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'auditoria'
    order by table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', v_tab) into v_linhas;
    v_dados := v_dados || jsonb_build_object(v_tab, v_linhas);
    v_total := v_total + jsonb_array_length(v_linhas);
  end loop;

  insert into copias.copias as c (gaveta, feita_em, origem, registros, tamanho_bytes, dados)
  values (((current_date - date '2000-01-01') % 30)::smallint, now(), p_origem, v_total, pg_column_size(v_dados), v_dados)
  on conflict (gaveta) do update
    set feita_em = excluded.feita_em, origem = excluded.origem, registros = excluded.registros,
        tamanho_bytes = excluded.tamanho_bytes, dados = excluded.dados;
end $$;
revoke all on function copias.fazer_copia(text) from public, anon, authenticated;

-- todo dia às 6h UTC (3h da manhã em Brasília)
do $$
begin
  perform cron.schedule('copia-diaria', '0 6 * * *', 'select copias.fazer_copia(''automatica'')');
end $$;

-- o que o site (só o administrador) pode fazer com as cópias
create or replace function public.copias_lista()
returns table (gaveta smallint, feita_em timestamptz, origem text, registros integer, tamanho_bytes bigint)
language plpgsql stable security definer set search_path = public, copias
as $$
begin
  if not eh_admin() then raise exception 'Só o administrador vê as cópias.'; end if;
  return query select c.gaveta, c.feita_em, c.origem, c.registros, c.tamanho_bytes from copias.copias c order by c.feita_em desc;
end $$;

create or replace function public.copia_dados(p_gaveta smallint)
returns jsonb
language plpgsql stable security definer set search_path = public, copias
as $$
begin
  if not eh_admin() then raise exception 'Só o administrador baixa as cópias.'; end if;
  return (select jsonb_build_object('feita_em', c.feita_em, 'dados', c.dados) from copias.copias c where c.gaveta = p_gaveta);
end $$;

create or replace function public.copia_agora()
returns void
language plpgsql security definer set search_path = public, copias
as $$
begin
  if not eh_admin() then raise exception 'Só o administrador faz cópias.'; end if;
  perform copias.fazer_copia('manual');
end $$;

create or replace function public.tamanho_banco()
returns jsonb
language plpgsql stable security definer set search_path = public, copias
as $$
begin
  if not eh_admin() then raise exception 'Só o administrador vê o tamanho do banco.'; end if;
  return jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
    'copias_bytes', coalesce(pg_total_relation_size('copias.copias'), 0),
    'tabelas', (
      select coalesce(jsonb_agg(jsonb_build_object('tabela', s.relname, 'linhas', s.n_live_tup, 'bytes', pg_total_relation_size(s.relid)) order by pg_total_relation_size(s.relid) desc), '[]'::jsonb)
      from pg_stat_user_tables s where s.schemaname = 'public'
    )
  );
end $$;

revoke all on function public.copias_lista() from public, anon;
revoke all on function public.copia_dados(smallint) from public, anon;
revoke all on function public.copia_agora() from public, anon;
revoke all on function public.tamanho_banco() from public, anon;
grant execute on function public.copias_lista() to authenticated;
grant execute on function public.copia_dados(smallint) to authenticated;
grant execute on function public.copia_agora() to authenticated;
grant execute on function public.tamanho_banco() to authenticated;

-- ───────────────────────── 2. Histórico de alterações ─────────────────────────
create table if not exists public.auditoria (
  id bigserial primary key,
  em timestamptz not null default now(),
  usuario_id uuid,
  usuario_nome text,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('criou', 'alterou', 'excluiu')),
  antes jsonb,
  depois jsonb
);
create index if not exists auditoria_em_idx on public.auditoria (em desc);
create index if not exists auditoria_registro_idx on public.auditoria (tabela, registro_id);
alter table public.auditoria enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'auditoria' and policyname = 'admin_le') then
    create policy admin_le on public.auditoria for select to authenticated using (eh_admin());
  end if;
end $$;
grant select on public.auditoria to authenticated;
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

-- campos que mudam sozinhos e não precisam aparecer no histórico
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ignorar text[] := array['atualizado_em', 'visualizado_em', 'aberturas', 'ultima_abertura_em', 'ultima_copia_em', 'ultima_copia_por'];
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_antes jsonb;
  v_depois jsonb;
  v_uid uuid := auth.uid();
  v_nome text;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, o.value), jsonb_object_agg(n.key, n.value)
      into v_antes, v_depois
    from jsonb_each(v_new) n
    join jsonb_each(v_old) o on o.key = n.key
    where n.value is distinct from o.value and not (n.key = any (v_ignorar));
    if v_depois is null then return new; end if; -- nada que importe mudou
  elsif tg_op = 'INSERT' then
    v_depois := v_new;
  else
    v_antes := v_old;
  end if;

  if v_uid is not null then
    select coalesce(nullif(p.nome, ''), p.email) into v_nome from perfis p where p.user_id = v_uid;
  end if;

  insert into auditoria (usuario_id, usuario_nome, tabela, registro_id, acao, antes, depois)
  values (
    v_uid,
    coalesce(v_nome, case when v_uid is null then 'Sistema / cliente' else 'Usuário' end),
    tg_table_name,
    coalesce(coalesce(v_new, v_old) ->> 'id', coalesce(v_new, v_old) ->> 'user_id'),
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'excluiu' end,
    v_antes,
    v_depois
  );
  return coalesce(new, old);
end $$;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

do $$
declare
  v_tab text;
begin
  foreach v_tab in array array[
    'clientes', 'fornecedores', 'parceiros', 'negociacoes', 'orcamentos', 'orcamento_itens', 'pedidos', 'pedido_itens',
    'pedido_marcos', 'ordens_producao', 'produtos', 'lancamentos', 'chamados', 'configuracoes', 'perfis'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;

-- ───────────────────────── 3. Proposta aberta pelo cliente ─────────────────────────
alter table public.orcamentos
  add column if not exists aberturas integer not null default 0,
  add column if not exists ultima_abertura_em timestamptz;

create or replace function public.proposta_publica(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc orcamentos%rowtype;
  v jsonb;
begin
  select * into v_orc from orcamentos where token = p_token;
  if not found then return null; end if;
  -- só conta quando quem abre é o cliente (sem login)
  if auth.uid() is null then
    update orcamentos
       set visualizado_em = coalesce(visualizado_em, now()),
           aberturas = aberturas + 1,
           ultima_abertura_em = now()
     where id = v_orc.id;
  end if;
  select jsonb_build_object(
    'numero', r.numero, 'status', r.status, 'validade', r.validade, 'criado_em', r.criado_em,
    'observacoes', r.observacoes, 'prazo_entrega_dias', r.prazo_entrega_dias,
    'forma_pagamento', r.forma_pagamento, 'parcelas', r.parcelas, 'condicoes_pagamento', r.condicoes_pagamento,
    'subtotal', r.subtotal, 'desconto', r.desconto, 'total', r.total,
    'aceite_em', v_orc.aceite_em, 'aceite_nome', v_orc.aceite_nome,
    'cliente', r.cliente_nome,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('ambiente', i.ambiente, 'descricao', i.descricao, 'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario) order by i.ordem, i.id)
                       from orcamento_itens i where i.orcamento_id = v_orc.id), '[]'::jsonb),
    'empresa', (select jsonb_build_object('nome', c.nome_fantasia, 'telefone', c.telefone, 'email', c.email, 'cidade', c.cidade, 'uf', c.uf) from configuracoes c limit 1)
  ) into v
  from orcamentos_resumo r where r.id = v_orc.id;
  return v;
end $$;

-- ───────────────────────── 4. Melhorias do sistema ─────────────────────────
create table if not exists public.melhorias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  area text,
  resultado smallint not null default 3 check (resultado between 1 and 5),
  esforco smallint not null default 3 check (esforco between 1 and 5),
  situacao text not null default 'ideia' check (situacao in ('ideia', 'fazendo', 'feito', 'descartado')),
  sugerido_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.melhorias enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'melhorias' and policyname = 'escritorio_le') then
    create policy escritorio_le on public.melhorias for select to authenticated using (eh_escritorio());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'melhorias' and policyname = 'escritorio_sugere') then
    create policy escritorio_sugere on public.melhorias for insert to authenticated with check (eh_escritorio());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'melhorias' and policyname = 'admin_altera') then
    create policy admin_altera on public.melhorias for update to authenticated using (eh_admin()) with check (eh_admin());
  end if;
end $$;
grant select, insert, update on public.melhorias to authenticated;

-- quem sugeriu é sempre quem está logado (não dá para sugerir em nome de outra pessoa)
create or replace function public.melhoria_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.sugerido_por := (select coalesce(nullif(p.nome, ''), p.email) from perfis p where p.user_id = auth.uid());
  return new;
end $$;
revoke all on function public.melhoria_autor() from public, anon, authenticated;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'melhoria_autor' and tgrelid = 'public.melhorias'::regclass) then
    create trigger melhoria_autor before insert on public.melhorias for each row execute function public.melhoria_autor();
  end if;
end $$;
revoke all on public.melhorias from anon;

-- primeira cópia já fica pronta
select copias.fazer_copia('manual');
