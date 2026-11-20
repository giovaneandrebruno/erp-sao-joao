-- Estoque e Compras separados (só acrescenta, nada é apagado):
-- 1. Produto ganha categoria (chapa, fita, ferragem...), local no depósito e medida da chapa.
-- 2. Movimentação guarda a origem (compra, pedido, inventário, perda...) e o custo médio é recalculado na entrada.
-- 3. Inventário (contagem do estoque) com ajuste automático do saldo.
-- 4. Compras: requisições, cotações com vários fornecedores, pedidos de compra e recebimento.
-- 5. Cada item de compra pode ser marcado para um pedido (cliente), sem reservar; o consumo por pedido fica registrado.
-- 6. Saldo de cada produto passa a mostrar também o que já foi comprado e está a caminho.

-- ───────────────────────── 1. Produto ─────────────────────────
alter table public.produtos
  add column if not exists categoria text not null default 'outro'
    check (categoria in ('chapa', 'fita', 'ferragem', 'acessorio', 'insumo', 'vidro_aluminio', 'embalagem', 'outro')),
  add column if not exists local text,
  add column if not exists espessura_mm numeric(6,1),
  add column if not exists chapa_largura_mm integer check (chapa_largura_mm is null or chapa_largura_mm > 0),
  add column if not exists chapa_altura_mm integer check (chapa_altura_mm is null or chapa_altura_mm > 0),
  add column if not exists prazo_reposicao_dias integer check (prazo_reposicao_dias is null or prazo_reposicao_dias >= 0);

-- ───────────────────────── 2. Movimentação ─────────────────────────
alter table public.movimentos_estoque
  add column if not exists origem text not null default 'manual'
    check (origem in ('manual', 'compra', 'pedido', 'inventario', 'perda', 'devolucao')),
  add column if not exists compra_id uuid;
create index if not exists movimentos_estoque_criado_em_idx on public.movimentos_estoque (criado_em desc);
create index if not exists movimentos_estoque_pedido_id_idx on public.movimentos_estoque (pedido_id);

-- Movimento lançado pelos gatilhos do pedido (baixa de itens e materiais) fica marcado como "uso em pedido".
create or replace function public.origem_do_movimento() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.origem = 'manual' and new.pedido_id is not null and new.compra_id is null then
    new.origem := case when new.tipo = 'entrada' then 'devolucao' else 'pedido' end;
  end if;
  return new;
end $$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_origem_movimento' and tgrelid = 'public.movimentos_estoque'::regclass) then
    create trigger trg_origem_movimento before insert on public.movimentos_estoque
    for each row execute function public.origem_do_movimento();
  end if;
end $$;
revoke execute on function public.origem_do_movimento() from public, anon, authenticated;

-- Entrada com custo informado recalcula o custo médio do produto.
create or replace function public.aplicar_movimento_estoque() returns trigger
language plpgsql set search_path = public as $$
declare
  v_saldo numeric;
  v_custo numeric;
begin
  if new.tipo = 'entrada' then
    select estoque_atual, custo into v_saldo, v_custo from produtos where id = new.produto_id;
    if new.custo_unitario is not null and new.custo_unitario > 0 and new.quantidade > 0 then
      update produtos set
        custo = case when coalesce(v_saldo, 0) <= 0 or coalesce(v_custo, 0) <= 0 then new.custo_unitario
                     else round((v_saldo * v_custo + new.quantidade * new.custo_unitario) / (v_saldo + new.quantidade), 2) end,
        estoque_atual = estoque_atual + new.quantidade
      where id = new.produto_id;
    else
      update produtos set estoque_atual = estoque_atual + new.quantidade where id = new.produto_id;
    end if;
  elsif new.tipo = 'saida' then
    update produtos set estoque_atual = estoque_atual - new.quantidade where id = new.produto_id;
  else
    update produtos set estoque_atual = new.quantidade where id = new.produto_id;
  end if;
  return new;
end $$;

-- ───────────────────────── 3. Inventário ─────────────────────────
create table if not exists public.inventarios (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  descricao text not null,
  categoria text,
  status text not null default 'aberto' check (status in ('aberto', 'concluido', 'cancelado')),
  observacoes text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create table if not exists public.inventario_itens (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  saldo_sistema numeric(12,3) not null default 0,
  contado numeric(12,3) check (contado is null or contado >= 0),
  unique (inventario_id, produto_id)
);
create index if not exists inventario_itens_produto_id_idx on public.inventario_itens (produto_id);

-- Concluir: cada item contado vira um ajuste de saldo (só onde a contagem difere do sistema).
create or replace function public.concluir_inventario(p_inventario uuid) returns integer
language plpgsql set search_path = public as $$
declare
  v_numero integer;
  v_total integer := 0;
begin
  select numero into v_numero from inventarios where id = p_inventario and status = 'aberto' for update;
  if v_numero is null then raise exception 'Este inventário não está aberto.'; end if;
  insert into movimentos_estoque (produto_id, tipo, quantidade, referencia, origem)
  select i.produto_id, 'ajuste', i.contado, format('Inventário #%s', v_numero), 'inventario'
  from inventario_itens i
  join produtos p on p.id = i.produto_id
  where i.inventario_id = p_inventario and i.contado is not null and i.contado <> p.estoque_atual;
  get diagnostics v_total = row_count;
  update inventarios set status = 'concluido', concluido_em = now() where id = p_inventario;
  return v_total;
end $$;

-- ───────────────────────── 4. Compras ─────────────────────────
create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  titulo text not null,
  status text not null default 'aberta' check (status in ('aberta', 'fechada', 'cancelada')),
  responder_ate date,
  observacoes text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  unidade text not null default 'un',
  pedido_id uuid references public.pedidos(id) on delete set null,
  ordem integer not null default 0
);
create index if not exists cotacao_itens_pedido_id_idx on public.cotacao_itens (pedido_id);
create index if not exists cotacao_itens_cotacao_id_idx on public.cotacao_itens (cotacao_id);
create index if not exists cotacao_itens_produto_id_idx on public.cotacao_itens (produto_id);

create table if not exists public.cotacao_fornecedores (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  prazo_entrega_dias integer check (prazo_entrega_dias is null or prazo_entrega_dias >= 0),
  condicao_pagamento text,
  frete numeric(12,2) not null default 0 check (frete >= 0),
  observacoes text,
  unique (cotacao_id, fornecedor_id)
);
create index if not exists cotacao_fornecedores_fornecedor_id_idx on public.cotacao_fornecedores (fornecedor_id);

create table if not exists public.cotacao_precos (
  id uuid primary key default gen_random_uuid(),
  cotacao_item_id uuid not null references public.cotacao_itens(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  unique (cotacao_item_id, fornecedor_id)
);
create index if not exists cotacao_precos_fornecedor_id_idx on public.cotacao_precos (fornecedor_id);

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'parcial', 'recebido', 'cancelado')),
  emitido_em date not null default current_date,
  previsao_entrega date,
  condicao_pagamento text,
  frete numeric(12,2) not null default 0 check (frete >= 0),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  observacoes text,
  cotacao_id uuid references public.cotacoes(id) on delete set null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists compras_fornecedor_id_idx on public.compras (fornecedor_id);
create index if not exists compras_cotacao_id_idx on public.compras (cotacao_id);
create index if not exists compras_pedido_id_idx on public.compras (pedido_id);

create table if not exists public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  unidade text not null default 'un',
  preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0),
  recebido numeric(12,3) not null default 0 check (recebido >= 0),
  -- Para qual pedido (cliente) o item foi comprado. Só registro: o material entra livre no estoque.
  pedido_id uuid references public.pedidos(id) on delete set null,
  ordem integer not null default 0
);
create index if not exists compra_itens_pedido_id_idx on public.compra_itens (pedido_id);
create index if not exists compra_itens_compra_id_idx on public.compra_itens (compra_id);
create index if not exists compra_itens_produto_id_idx on public.compra_itens (produto_id);

create table if not exists public.requisicoes_compra (
  id uuid primary key default gen_random_uuid(),
  numero serial unique,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  unidade text not null default 'un',
  pedido_id uuid references public.pedidos(id) on delete set null,
  necessario_em date,
  urgente boolean not null default false,
  status text not null default 'aberta' check (status in ('aberta', 'em_cotacao', 'comprada', 'cancelada')),
  solicitante text,
  observacoes text,
  cotacao_id uuid references public.cotacoes(id) on delete set null,
  compra_id uuid references public.compras(id) on delete set null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists requisicoes_compra_produto_id_idx on public.requisicoes_compra (produto_id);
create index if not exists requisicoes_compra_pedido_id_idx on public.requisicoes_compra (pedido_id);
create index if not exists requisicoes_compra_cotacao_id_idx on public.requisicoes_compra (cotacao_id);
create index if not exists requisicoes_compra_compra_id_idx on public.requisicoes_compra (compra_id);

create table if not exists public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  recebido_em date not null default current_date,
  nota_fiscal text,
  conferido_por text,
  observacoes text,
  itens jsonb not null default '[]'::jsonb,
  lancamento_id uuid references public.lancamentos(id) on delete set null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists recebimentos_compra_id_idx on public.recebimentos (compra_id);
create index if not exists recebimentos_lancamento_id_idx on public.recebimentos (lancamento_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'movimentos_estoque_compra_id_fkey') then
    alter table public.movimentos_estoque
      add constraint movimentos_estoque_compra_id_fkey foreign key (compra_id) references public.compras(id) on delete set null;
  end if;
end $$;
create index if not exists movimentos_estoque_compra_id_idx on public.movimentos_estoque (compra_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_cotacoes_upd' and tgrelid = 'public.cotacoes'::regclass) then
    create trigger trg_cotacoes_upd before update on public.cotacoes for each row execute function set_atualizado_em();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_compras_upd' and tgrelid = 'public.compras'::regclass) then
    create trigger trg_compras_upd before update on public.compras for each row execute function set_atualizado_em();
  end if;
end $$;

-- Receber material: grava o recebimento, dá entrada no estoque com o preço da compra
-- e, se pedido (só o administrador), lança a conta a pagar no Financeiro.
-- p_itens: [{"item": "<id do item>", "quantidade": 10}, ...]
create or replace function public.receber_compra(
  p_compra uuid, p_itens jsonb, p_data date default current_date, p_nota text default null,
  p_conferido text default null, p_obs text default null, p_vencimento date default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_compra compras%rowtype;
  v_receb uuid;
  v_linha jsonb;
  v_item compra_itens%rowtype;
  v_qtd numeric;
  v_valor numeric := 0;
  v_gravados jsonb := '[]'::jsonb;
  v_lanc uuid;
  v_falta numeric;
begin
  select * into v_compra from compras where id = p_compra for update;
  if v_compra.id is null then raise exception 'Pedido de compra não encontrado.'; end if;
  if v_compra.status in ('cancelado', 'recebido') then raise exception 'Este pedido de compra já está %.', v_compra.status; end if;

  for v_linha in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_qtd := coalesce((v_linha->>'quantidade')::numeric, 0);
    continue when v_qtd <= 0;
    select * into v_item from compra_itens where id = (v_linha->>'item')::uuid and compra_id = p_compra for update;
    continue when v_item.id is null;
    update compra_itens set recebido = recebido + v_qtd where id = v_item.id;
    if v_item.produto_id is not null then
      -- sem pedido_id de propósito: a entrada fica livre no estoque (o gatilho do pedido conta entradas com pedido_id como devolução)
      insert into movimentos_estoque (produto_id, tipo, quantidade, custo_unitario, referencia, origem, compra_id, pedido_id)
      values (v_item.produto_id, 'entrada', v_qtd, nullif(v_item.preco_unitario, 0),
              concat_ws(' · ', format('Compra #%s', v_compra.numero), case when p_nota is not null then 'NF ' || p_nota end),
              'compra', p_compra, null);
    end if;
    v_valor := v_valor + v_qtd * v_item.preco_unitario;
    v_gravados := v_gravados || jsonb_build_object('item', v_item.id, 'descricao', v_item.descricao, 'quantidade', v_qtd);
  end loop;

  if jsonb_array_length(v_gravados) = 0 then raise exception 'Informe a quantidade recebida de pelo menos um item.'; end if;

  select coalesce(sum(greatest(quantidade - recebido, 0)), 0) into v_falta from compra_itens where compra_id = p_compra;
  update compras set status = case when v_falta = 0 then 'recebido' else 'parcial' end where id = p_compra;

  if p_vencimento is not null then
    if not eh_admin() then raise exception 'Só o administrador lança contas a pagar.'; end if;
    if v_falta = 0 then v_valor := v_valor + v_compra.frete - v_compra.desconto; end if;
    if v_valor > 0 then
      insert into lancamentos (tipo, descricao, categoria, valor, vencimento, fornecedor_id, pedido_id)
      values ('pagar', concat_ws(' · ', format('Compra #%s', v_compra.numero), case when p_nota is not null then 'NF ' || p_nota end),
              'Compra de material', round(v_valor, 2), p_vencimento, v_compra.fornecedor_id, v_compra.pedido_id)
      returning id into v_lanc;
    end if;
  end if;

  insert into recebimentos (compra_id, recebido_em, nota_fiscal, conferido_por, observacoes, itens, lancamento_id)
  values (p_compra, coalesce(p_data, current_date), p_nota, p_conferido, p_obs, v_gravados, v_lanc)
  returning id into v_receb;
  return v_receb;
end $$;

-- ───────────────────────── 5. Saldo com "a caminho" ─────────────────────────
create or replace view public.produtos_saldo with (security_invoker = true) as
select p.id, p.codigo, p.nome, p.tipo, p.unidade_medida, p.custo, p.preco_venda,
       p.estoque_atual, p.estoque_minimo, p.fornecedor_id, p.ativo,
       coalesce(r.reservado, 0) as reservado,
       p.estoque_atual - coalesce(r.reservado, 0) as livre,
       p.categoria, p.local,
       coalesce(c.a_caminho, 0) as a_caminho
from produtos p
left join (
  select m.produto_id, sum(m.quantidade) as reservado
  from pedido_materiais m
  join pedidos pe on pe.id = m.pedido_id
  where not m.baixado and pe.status not in ('cancelado', 'entregue')
  group by m.produto_id
) r on r.produto_id = p.id
left join (
  select i.produto_id, sum(greatest(i.quantidade - i.recebido, 0)) as a_caminho
  from compra_itens i
  join compras co on co.id = i.compra_id
  where co.status in ('enviado', 'parcial') and i.produto_id is not null
  group by i.produto_id
) c on c.produto_id = p.id;
grant select on public.produtos_saldo to authenticated;

-- ───────────────────────── Acesso (só o escritório; visitante sem login não vê nada) ─────────────────────────
do $$
declare
  v_tab text;
begin
  foreach v_tab in array array['inventarios', 'inventario_itens', 'cotacoes', 'cotacao_itens', 'cotacao_fornecedores',
                               'cotacao_precos', 'compras', 'compra_itens', 'requisicoes_compra', 'recebimentos'] loop
    execute format('alter table public.%I enable row level security', v_tab);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tab and policyname = 'escritorio_acesso_total') then
      execute format('create policy "escritorio_acesso_total" on public.%I for all to authenticated using (public.eh_escritorio()) with check (public.eh_escritorio())', v_tab);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_tab);
    execute format('revoke all on public.%I from anon', v_tab);
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;
revoke all on public.produtos_saldo from anon;
grant usage, select on sequence public.inventarios_numero_seq, public.cotacoes_numero_seq,
  public.compras_numero_seq, public.requisicoes_compra_numero_seq to authenticated;

revoke execute on function public.concluir_inventario(uuid) from public, anon;
grant execute on function public.concluir_inventario(uuid) to authenticated;
revoke execute on function public.receber_compra(uuid, jsonb, date, text, text, text, date) from public, anon;
grant execute on function public.receber_compra(uuid, jsonb, date, text, text, text, date) to authenticated;

-- ───────────────────────── Prova ─────────────────────────
do $$
begin
  if (select count(*) from information_schema.tables where table_schema = 'public' and table_name in
      ('inventarios', 'inventario_itens', 'cotacoes', 'cotacao_itens', 'cotacao_fornecedores', 'cotacao_precos',
       'compras', 'compra_itens', 'requisicoes_compra', 'recebimentos')) <> 10 then
    raise exception 'Faltou criar alguma tabela de estoque e compras';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produtos_saldo' and column_name = 'a_caminho') then
    raise exception 'Saldo sem a coluna a_caminho';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produtos' and column_name = 'categoria') then
    raise exception 'Produto sem categoria';
  end if;
end $$;

-- Rollback (só como referência, não rodar sem cópia):
-- drop function public.receber_compra(uuid, jsonb, date, text, text, text, date);
-- drop function public.concluir_inventario(uuid);
-- drop table public.recebimentos, public.requisicoes_compra, public.compra_itens, public.compras,
--   public.cotacao_precos, public.cotacao_fornecedores, public.cotacao_itens, public.cotacoes,
--   public.inventario_itens, public.inventarios;
-- alter table public.movimentos_estoque drop column origem, drop column compra_id;
-- alter table public.produtos drop column categoria, drop column local, drop column espessura_mm,
--   drop column chapa_largura_mm, drop column chapa_altura_mm, drop column prazo_reposicao_dias;
