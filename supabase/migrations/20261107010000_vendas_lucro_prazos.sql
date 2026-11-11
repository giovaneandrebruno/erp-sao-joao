-- Fase 2 e 3: configurações, parceiros (vendedores/arquitetos/montadores), CRM,
-- margem e comissões, lucro por pedido, marcos de prazo e assistência técnica.

-- ---------------------------------------------------------------- configurações da empresa (1 linha)
create table configuracoes (
  id boolean primary key default true check (id),
  nome_fantasia text not null default 'São João Móveis',
  razao_social text,
  cnpj text,
  endereco text,
  cidade text,
  uf text,
  telefone text,
  email text,
  aliquota_imposto numeric(5,2) not null default 6,
  taxa_credito numeric(5,2) not null default 3.5,
  taxa_debito numeric(5,2) not null default 1.5,
  taxa_boleto numeric(5,2) not null default 0,
  comissao_vendedor_padrao numeric(5,2) not null default 3,
  comissao_arquiteto_padrao numeric(5,2) not null default 10,
  markup_padrao numeric(6,3) not null default 2.2,
  margem_minima numeric(5,2) not null default 20,
  validade_orcamento_dias integer not null default 15,
  clausulas_contrato text not null default
'1. O prazo de entrega começa a contar a partir da aprovação do projeto executivo e do pagamento da entrada.
2. Alterações no projeto após a aprovação podem mudar o valor e o prazo, mediante novo acordo entre as partes.
3. O CONTRATANTE deve liberar o local para medição, entrega e montagem, com paredes, piso e pontos elétricos e hidráulicos concluídos.
4. A garantia dos móveis é de 1 (um) ano contra defeitos de fabricação, a partir da data de entrega, não cobrindo mau uso.
5. Em caso de desistência após o início da produção, os valores pagos cobrem os materiais já adquiridos e os serviços já executados.',
  atualizado_em timestamptz not null default now()
);
insert into configuracoes default values;
create trigger trg_config_upd before update on configuracoes for each row execute function set_atualizado_em();

-- ---------------------------------------------------------------- parceiros
create type tipo_parceiro as enum ('vendedor', 'arquiteto', 'montador');

create table parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_parceiro not null,
  telefone text,
  email text,
  chave_pix text,
  comissao_padrao numeric(5,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger trg_parceiros_upd before update on parceiros for each row execute function set_atualizado_em();

-- ---------------------------------------------------------------- CRM
create type etapa_negociacao as enum ('novo', 'contato', 'medicao', 'projeto', 'proposta', 'negociacao', 'ganho', 'perdido');

create table negociacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  titulo text not null,
  etapa etapa_negociacao not null default 'novo',
  origem text,
  valor_estimado numeric(12,2),
  vendedor_id uuid references parceiros(id) on delete set null,
  arquiteto_id uuid references parceiros(id) on delete set null,
  orcamento_id uuid references orcamentos(id) on delete set null,
  proxima_acao text,
  proxima_acao_data date,
  motivo_perda text,
  unidade unidade_negocio not null default 'marcenaria',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger trg_negociacoes_upd before update on negociacoes for each row execute function set_atualizado_em();
create index on negociacoes (cliente_id);
create index on negociacoes (etapa);

create table negociacao_notas (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  texto text not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on negociacao_notas (negociacao_id);

-- ---------------------------------------------------------------- margem e comissões no orçamento e no pedido
create type forma_pagamento as enum ('pix', 'dinheiro', 'boleto', 'cartao_credito', 'cartao_debito', 'financiamento');

alter table orcamentos
  add column vendedor_id uuid references parceiros(id) on delete set null,
  add column arquiteto_id uuid references parceiros(id) on delete set null,
  add column comissao_vendedor_pct numeric(5,2) not null default 0,
  add column comissao_arquiteto_pct numeric(5,2) not null default 0,
  add column forma_pagamento forma_pagamento not null default 'pix',
  add column parcelas integer not null default 1 check (parcelas >= 1),
  add column taxa_pagamento_pct numeric(5,2) not null default 0,
  add column imposto_pct numeric(5,2) not null default 0;

alter table orcamento_itens add column custo_unitario numeric(12,2) not null default 0;

alter table pedidos
  add column vendedor_id uuid references parceiros(id) on delete set null,
  add column arquiteto_id uuid references parceiros(id) on delete set null,
  add column comissao_vendedor_pct numeric(5,2) not null default 0,
  add column comissao_arquiteto_pct numeric(5,2) not null default 0,
  add column forma_pagamento forma_pagamento not null default 'pix',
  add column parcelas integer not null default 1 check (parcelas >= 1),
  add column taxa_pagamento_pct numeric(5,2) not null default 0,
  add column imposto_pct numeric(5,2) not null default 0,
  add column comissoes_lancadas boolean not null default false;

alter table pedido_itens add column custo_unitario numeric(12,2) not null default 0;

-- Novos orçamentos já nascem com impostos, comissão e validade da configuração
create function orcamento_padroes() returns trigger
language plpgsql as $$
declare c configuracoes%rowtype;
begin
  select * into c from configuracoes limit 1;
  if new.imposto_pct = 0 then new.imposto_pct := c.aliquota_imposto; end if;
  if new.validade is null then new.validade := current_date + c.validade_orcamento_dias; end if;
  return new;
end $$;
create trigger trg_orcamento_padroes before insert on orcamentos for each row execute function orcamento_padroes();

-- ---------------------------------------------------------------- resultado (DRE) do orçamento e do pedido
-- A versão antiga do resumo fica guardada com outro nome (sem apagar nada).
alter view orcamentos_resumo rename to orcamentos_resumo_v1;
revoke all on orcamentos_resumo_v1 from authenticated;
create view orcamentos_resumo with (security_invoker = true) as
with base as (
  select o.*,
         c.nome as cliente_nome,
         coalesce(sum(i.quantidade * i.preco_unitario), 0) as subtotal,
         coalesce(sum(i.quantidade * i.custo_unitario), 0) as custo_total
  from orcamentos o
  join clientes c on c.id = o.cliente_id
  left join orcamento_itens i on i.orcamento_id = o.id
  group by o.id, c.nome
)
select b.*,
       b.subtotal - b.desconto as total,
       round((b.subtotal - b.desconto) * b.comissao_vendedor_pct / 100, 2) as valor_comissao_vendedor,
       round((b.subtotal - b.desconto) * b.comissao_arquiteto_pct / 100, 2) as valor_comissao_arquiteto,
       round((b.subtotal - b.desconto) * b.taxa_pagamento_pct / 100, 2) as valor_taxa_pagamento,
       round((b.subtotal - b.desconto) * b.imposto_pct / 100, 2) as valor_imposto,
       (b.subtotal - b.desconto)
         - b.custo_total
         - round((b.subtotal - b.desconto) * (b.comissao_vendedor_pct + b.comissao_arquiteto_pct + b.taxa_pagamento_pct + b.imposto_pct) / 100, 2)
         as lucro
from base b;

alter view pedidos_resumo rename to pedidos_resumo_v1;
revoke all on pedidos_resumo_v1 from authenticated;
create view pedidos_resumo with (security_invoker = true) as
with base as (
  select p.*,
         c.nome as cliente_nome,
         coalesce((select sum(i.quantidade * i.preco_unitario) from pedido_itens i where i.pedido_id = p.id), 0) as subtotal,
         coalesce((select sum(i.quantidade * i.custo_unitario) from pedido_itens i where i.pedido_id = p.id), 0) as custo_total,
         coalesce((select sum(l.valor) from lancamentos l where l.pedido_id = p.id and l.tipo = 'pagar' and coalesce(l.categoria, '') <> 'Comissão'), 0) as custos_extras,
         coalesce((select sum(l.valor) from lancamentos l where l.pedido_id = p.id and l.tipo = 'receber' and l.pago_em is not null), 0) as recebido
  from pedidos p
  join clientes c on c.id = p.cliente_id
)
select b.*,
       b.subtotal - b.desconto as total,
       round((b.subtotal - b.desconto) * b.comissao_vendedor_pct / 100, 2) as valor_comissao_vendedor,
       round((b.subtotal - b.desconto) * b.comissao_arquiteto_pct / 100, 2) as valor_comissao_arquiteto,
       round((b.subtotal - b.desconto) * b.taxa_pagamento_pct / 100, 2) as valor_taxa_pagamento,
       round((b.subtotal - b.desconto) * b.imposto_pct / 100, 2) as valor_imposto,
       (b.subtotal - b.desconto)
         - b.custo_total - b.custos_extras
         - round((b.subtotal - b.desconto) * (b.comissao_vendedor_pct + b.comissao_arquiteto_pct + b.taxa_pagamento_pct + b.imposto_pct) / 100, 2)
         as lucro
from base b;

-- ---------------------------------------------------------------- marcos de prazo
create type tipo_marco as enum ('medicao', 'projeto_executivo', 'compra_material', 'producao', 'entrega', 'montagem', 'vistoria');

create table pedido_marcos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  tipo tipo_marco not null,
  previsto date,
  realizado date,
  responsavel_id uuid references parceiros(id) on delete set null,
  observacoes text,
  unique (pedido_id, tipo)
);
create index on pedido_marcos (previsto) where realizado is null;

-- ---------------------------------------------------------------- assistência técnica
create type status_chamado as enum ('aberto', 'agendado', 'em_atendimento', 'resolvido');

create table chamados (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  cliente_id uuid not null references clientes(id) on delete cascade,
  pedido_id uuid references pedidos(id) on delete set null,
  descricao text not null,
  status status_chamado not null default 'aberto',
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
  em_garantia boolean not null default true,
  data_agendada date,
  responsavel_id uuid references parceiros(id) on delete set null,
  solucao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger trg_chamados_upd before update on chamados for each row execute function set_atualizado_em();
create index on chamados (cliente_id);

-- ---------------------------------------------------------------- aprovar orçamento (nova versão)
create or replace function aprovar_orcamento(p_orcamento_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_orc orcamentos%rowtype;
  v_pedido_id uuid;
  v_prazo integer;
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
  update negociacoes set etapa = 'ganho' where orcamento_id = p_orcamento_id and etapa <> 'ganho';

  v_prazo := coalesce(v_orc.prazo_entrega_dias, 45);

  insert into pedidos (orcamento_id, cliente_id, unidade, desconto, observacoes, data_entrega_prevista,
                       vendedor_id, arquiteto_id, comissao_vendedor_pct, comissao_arquiteto_pct,
                       forma_pagamento, parcelas, taxa_pagamento_pct, imposto_pct)
  values (v_orc.id, v_orc.cliente_id, v_orc.unidade, v_orc.desconto, v_orc.observacoes, current_date + v_prazo,
          v_orc.vendedor_id, v_orc.arquiteto_id, v_orc.comissao_vendedor_pct, v_orc.comissao_arquiteto_pct,
          v_orc.forma_pagamento, v_orc.parcelas, v_orc.taxa_pagamento_pct, v_orc.imposto_pct)
  returning id into v_pedido_id;

  insert into pedido_itens (pedido_id, produto_id, ambiente, descricao, quantidade, preco_unitario, custo_unitario, ordem)
  select v_pedido_id, produto_id, ambiente, descricao, quantidade, preco_unitario, custo_unitario, ordem
  from orcamento_itens where orcamento_id = p_orcamento_id;

  -- Marcos de prazo distribuídos ao longo do prazo de entrega
  insert into pedido_marcos (pedido_id, tipo, previsto) values
    (v_pedido_id, 'medicao',           current_date + greatest(1, round(v_prazo * 0.07)::int)),
    (v_pedido_id, 'projeto_executivo', current_date + greatest(2, round(v_prazo * 0.15)::int)),
    (v_pedido_id, 'compra_material',   current_date + greatest(3, round(v_prazo * 0.25)::int)),
    (v_pedido_id, 'producao',          current_date + greatest(4, round(v_prazo * 0.80)::int)),
    (v_pedido_id, 'entrega',           current_date + v_prazo),
    (v_pedido_id, 'montagem',          current_date + v_prazo + 3),
    (v_pedido_id, 'vistoria',          current_date + v_prazo + 7);

  return v_pedido_id;
end $$;

-- ---------------------------------------------------------------- segurança
do $$
declare t text;
begin
  foreach t in array array['configuracoes','parceiros','negociacoes','negociacao_notas','pedido_marcos','chamados']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "funcionarios_acesso_total" on %I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
grant select on orcamentos_resumo, pedidos_resumo to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
