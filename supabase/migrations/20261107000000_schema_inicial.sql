-- ERP São João: esquema inicial
-- Módulos: clientes, fornecedores, produtos/estoque, orçamentos, pedidos,
-- ordens de produção e financeiro.

create extension if not exists pgcrypto;

-- Unidade de negócio: a marcenaria (fábrica) ou a loja São João Móveis
create type unidade_negocio as enum ('marcenaria', 'loja');
create type status_orcamento as enum ('rascunho', 'enviado', 'aprovado', 'recusado');
create type status_pedido as enum ('aberto', 'em_producao', 'pronto', 'entregue', 'cancelado');
create type etapa_producao as enum ('aguardando', 'corte', 'fita_borda', 'montagem', 'acabamento', 'pronto', 'instalacao', 'concluido');
create type tipo_produto as enum ('materia_prima', 'produto', 'servico');
create type tipo_movimento as enum ('entrada', 'saida', 'ajuste');
create type tipo_lancamento as enum ('receber', 'pagar');

-- Atualiza a coluna atualizado_em automaticamente
create function set_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------------------------------------------------------------- cadastros
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text,
  telefone text,
  email text,
  contato text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nome text not null,
  tipo tipo_produto not null default 'materia_prima',
  unidade_medida text not null default 'un',
  custo numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  estoque_atual numeric(12,3) not null default 0,
  estoque_minimo numeric(12,3) not null default 0,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- vendas
create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  cliente_id uuid not null references clientes(id) on delete restrict,
  unidade unidade_negocio not null default 'marcenaria',
  status status_orcamento not null default 'rascunho',
  validade date,
  prazo_entrega_dias integer,
  desconto numeric(12,2) not null default 0,
  condicoes_pagamento text,
  observacoes text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references orcamentos(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  ambiente text,
  descricao text not null,
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12,2) not null default 0,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  orcamento_id uuid unique references orcamentos(id) on delete set null,
  cliente_id uuid not null references clientes(id) on delete restrict,
  unidade unidade_negocio not null default 'marcenaria',
  status status_pedido not null default 'aberto',
  data_entrega_prevista date,
  desconto numeric(12,2) not null default 0,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  ambiente text,
  descricao text not null,
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12,2) not null default 0,
  ordem integer not null default 0
);

-- ---------------------------------------------------------------- produção
create table ordens_producao (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  pedido_id uuid references pedidos(id) on delete cascade,
  descricao text not null,
  etapa etapa_producao not null default 'aguardando',
  responsavel text,
  prazo date,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- estoque
create table movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  tipo tipo_movimento not null,
  -- entrada/saida: quantidade positiva; ajuste: novo saldo do estoque
  quantidade numeric(12,3) not null check (quantidade >= 0),
  custo_unitario numeric(12,2),
  referencia text,
  pedido_id uuid references pedidos(id) on delete set null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

create function aplicar_movimento_estoque() returns trigger
language plpgsql as $$
begin
  if new.tipo = 'entrada' then
    update produtos set estoque_atual = estoque_atual + new.quantidade where id = new.produto_id;
  elsif new.tipo = 'saida' then
    update produtos set estoque_atual = estoque_atual - new.quantidade where id = new.produto_id;
  else
    update produtos set estoque_atual = new.quantidade where id = new.produto_id;
  end if;
  return new;
end $$;

create trigger trg_movimento_estoque after insert on movimentos_estoque
for each row execute function aplicar_movimento_estoque();

-- ---------------------------------------------------------------- financeiro
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_lancamento not null,
  unidade unidade_negocio not null default 'marcenaria',
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  pago_em date,
  forma_pagamento text,
  cliente_id uuid references clientes(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  pedido_id uuid references pedidos(id) on delete set null,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- índices
create index on orcamentos (cliente_id);
create index on orcamento_itens (orcamento_id);
create index on pedidos (cliente_id);
create index on pedido_itens (pedido_id);
create index on ordens_producao (pedido_id);
create index on movimentos_estoque (produto_id);
create index on lancamentos (vencimento);
create index on lancamentos (cliente_id);
create index on lancamentos (fornecedor_id);
create index on lancamentos (pedido_id);
create index on produtos (fornecedor_id);

-- ---------------------------------------------------------------- gatilhos
create trigger trg_clientes_upd before update on clientes for each row execute function set_atualizado_em();
create trigger trg_fornecedores_upd before update on fornecedores for each row execute function set_atualizado_em();
create trigger trg_produtos_upd before update on produtos for each row execute function set_atualizado_em();
create trigger trg_orcamentos_upd before update on orcamentos for each row execute function set_atualizado_em();
create trigger trg_pedidos_upd before update on pedidos for each row execute function set_atualizado_em();
create trigger trg_ordens_upd before update on ordens_producao for each row execute function set_atualizado_em();
create trigger trg_lancamentos_upd before update on lancamentos for each row execute function set_atualizado_em();

-- ---------------------------------------------------------------- visões com totais
create view orcamentos_resumo with (security_invoker = true) as
select o.*,
       c.nome as cliente_nome,
       coalesce(sum(i.quantidade * i.preco_unitario), 0) as subtotal,
       coalesce(sum(i.quantidade * i.preco_unitario), 0) - o.desconto as total
from orcamentos o
join clientes c on c.id = o.cliente_id
left join orcamento_itens i on i.orcamento_id = o.id
group by o.id, c.nome;

create view pedidos_resumo with (security_invoker = true) as
select p.*,
       c.nome as cliente_nome,
       coalesce(sum(i.quantidade * i.preco_unitario), 0) - p.desconto as total
from pedidos p
join clientes c on c.id = p.cliente_id
left join pedido_itens i on i.pedido_id = p.id
group by p.id, c.nome;

-- ---------------------------------------------------------------- orçamento aprovado vira pedido
create function aprovar_orcamento(p_orcamento_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_orc orcamentos%rowtype;
  v_pedido_id uuid;
begin
  select * into v_orc from orcamentos where id = p_orcamento_id for update;
  if not found then
    raise exception 'Orçamento não encontrado';
  end if;

  select id into v_pedido_id from pedidos where orcamento_id = p_orcamento_id;
  if v_pedido_id is not null then
    return v_pedido_id;
  end if;

  update orcamentos set status = 'aprovado' where id = p_orcamento_id;

  insert into pedidos (orcamento_id, cliente_id, unidade, desconto, observacoes, data_entrega_prevista)
  values (v_orc.id, v_orc.cliente_id, v_orc.unidade, v_orc.desconto, v_orc.observacoes,
          case when v_orc.prazo_entrega_dias is not null
               then current_date + v_orc.prazo_entrega_dias end)
  returning id into v_pedido_id;

  insert into pedido_itens (pedido_id, produto_id, ambiente, descricao, quantidade, preco_unitario, ordem)
  select v_pedido_id, produto_id, ambiente, descricao, quantidade, preco_unitario, ordem
  from orcamento_itens where orcamento_id = p_orcamento_id;

  return v_pedido_id;
end $$;

-- ---------------------------------------------------------------- segurança (RLS)
-- Somente usuários logados (funcionários) acessam os dados.
-- Desative o cadastro público no Supabase (Authentication > Sign In / Providers)
-- e convide os funcionários pelo painel.
do $$
declare t text;
begin
  foreach t in array array['clientes','fornecedores','produtos','orcamentos','orcamento_itens',
                           'pedidos','pedido_itens','ordens_producao','movimentos_estoque','lancamentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "funcionarios_acesso_total" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

revoke execute on function aprovar_orcamento(uuid) from public, anon;
grant execute on function aprovar_orcamento(uuid) to authenticated;

-- Permissões explícitas da API (funciona mesmo com "Automatically expose new tables" desligado).
-- Visitantes não logados (anon) não recebem acesso a nada.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  clientes, fornecedores, produtos, orcamentos, orcamento_itens,
  pedidos, pedido_itens, ordens_producao, movimentos_estoque, lancamentos
  to authenticated;
grant select on orcamentos_resumo, pedidos_resumo to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
