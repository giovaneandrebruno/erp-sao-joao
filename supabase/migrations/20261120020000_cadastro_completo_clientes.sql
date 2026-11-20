-- Cadastro completo de clientes: o mesmo cadastro vale para quem ainda é contato
-- (lead) e para quem já comprou (cliente). Só acrescenta colunas; nada é apagado.

-- Situação: quem já está no banco hoje entra como "cliente" (72 de 73 já têm pedido,
-- produção ou lançamento). Depois disso, todo cadastro novo começa como "lead".
alter table clientes add column if not exists situacao text not null default 'cliente';
alter table clientes alter column situacao set default 'lead';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_situacao_check') then
    alter table clientes add constraint clientes_situacao_check check (situacao in ('lead', 'cliente', 'inativo'));
  end if;
end $$;

alter table clientes add column if not exists tipo_pessoa text not null default 'fisica';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_tipo_pessoa_check') then
    alter table clientes add constraint clientes_tipo_pessoa_check check (tipo_pessoa in ('fisica', 'juridica'));
  end if;
end $$;

-- Dados pessoais / da empresa
alter table clientes add column if not exists nome_fantasia text;
alter table clientes add column if not exists rg text;
alter table clientes add column if not exists inscricao_estadual text;
alter table clientes add column if not exists data_nascimento date;
alter table clientes add column if not exists estado_civil text;
alter table clientes add column if not exists profissao text;
alter table clientes add column if not exists contato_nome text;

-- Contato
alter table clientes add column if not exists telefone2 text;

-- Endereço (a coluna "endereco" continua sendo a rua)
alter table clientes add column if not exists numero text;
alter table clientes add column if not exists complemento text;
alter table clientes add column if not exists bairro text;
alter table clientes add column if not exists endereco_obra text;

-- Comercial
alter table clientes add column if not exists origem text;
alter table clientes add column if not exists indicado_por text;
alter table clientes add column if not exists vendedor_id uuid references parceiros(id) on delete set null;
alter table clientes add column if not exists arquiteto_id uuid references parceiros(id) on delete set null;

create index if not exists clientes_situacao_idx on clientes (situacao);
create index if not exists clientes_vendedor_idx on clientes (vendedor_id);
create index if not exists clientes_arquiteto_idx on clientes (arquiteto_id);

-- Quando o lead fecha (pedido, ordem de produção ou negociação ganha), vira cliente sozinho.
create or replace function public.cliente_fechou()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cliente_id is not null then
    update clientes set situacao = 'cliente' where id = new.cliente_id and situacao <> 'cliente';
  end if;
  return new;
end;
$$;
revoke execute on function public.cliente_fechou() from public, anon;

create or replace trigger trg_pedidos_cliente_fechou after insert on pedidos
  for each row execute function public.cliente_fechou();

create or replace trigger trg_ordens_cliente_fechou after insert on ordens_producao
  for each row execute function public.cliente_fechou();

create or replace trigger trg_negociacoes_cliente_fechou after insert or update of etapa on negociacoes
  for each row when (new.etapa = 'ganho') execute function public.cliente_fechou();

-- O cliente já tem algo no sistema? Conta tudo, inclusive lançamentos que o vendedor não enxerga,
-- para ninguém excluir um cliente que tem histórico no financeiro.
create or replace function public.cliente_tem_historico(p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.eh_escritorio() or (
    exists (select 1 from orcamentos where cliente_id = p_cliente)
    or exists (select 1 from pedidos where cliente_id = p_cliente)
    or exists (select 1 from ordens_producao where cliente_id = p_cliente)
    or exists (select 1 from negociacoes where cliente_id = p_cliente)
    or exists (select 1 from chamados where cliente_id = p_cliente)
    or exists (select 1 from lancamentos where cliente_id = p_cliente)
  );
$$;
revoke execute on function public.cliente_tem_historico(uuid) from public, anon;
grant execute on function public.cliente_tem_historico(uuid) to authenticated;

-- Prova
do $$
declare faltando text;
begin
  select string_agg(c, ', ') into faltando
  from unnest(array['situacao','tipo_pessoa','nome_fantasia','rg','inscricao_estadual','data_nascimento','estado_civil',
    'profissao','contato_nome','telefone2','numero','complemento','bairro','endereco_obra','origem','indicado_por',
    'vendedor_id','arquiteto_id']) c
  where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clientes' and column_name = c);
  if faltando is not null then raise exception 'Colunas faltando em clientes: %', faltando; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_pedidos_cliente_fechou') then raise exception 'gatilho de pedidos faltando'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_ordens_cliente_fechou') then raise exception 'gatilho de produção faltando'; end if;
  if to_regprocedure('public.cliente_tem_historico(uuid)') is null then raise exception 'função cliente_tem_historico faltando'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_negociacoes_cliente_fechou') then raise exception 'gatilho do funil faltando'; end if;
end $$;

-- Rollback (só como referência, não executar sem o sim do dono):
-- drop trigger if exists trg_pedidos_cliente_fechou on pedidos;
-- drop trigger if exists trg_ordens_cliente_fechou on ordens_producao;
-- drop trigger if exists trg_negociacoes_cliente_fechou on negociacoes;
-- drop function if exists public.cliente_fechou();
-- drop function if exists public.cliente_tem_historico(uuid);
-- alter table clientes drop column situacao, drop column tipo_pessoa, drop column nome_fantasia, drop column rg,
--   drop column inscricao_estadual, drop column data_nascimento, drop column estado_civil, drop column profissao,
--   drop column contato_nome, drop column telefone2, drop column numero, drop column complemento, drop column bairro,
--   drop column endereco_obra, drop column origem, drop column indicado_por, drop column vendedor_id, drop column arquiteto_id;
