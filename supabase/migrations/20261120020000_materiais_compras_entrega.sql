-- Melhorias da pesquisa de 2026-11-20 (só acrescenta, nada é apagado):
-- 1. Lista de materiais do pedido (chapas, fita, ferragens) com reserva no estoque.
-- 2. Baixa automática desses materiais quando o pedido entra em produção.
-- 3. Saldo livre de cada produto (estoque menos o que está reservado).
-- 4. Sobras de chapa (retalhos).
-- 5. Checklist, fotos e termo de entrega; pesquisa de satisfação no pedido.
-- 6. Textos novos em Configurações (checklist, pesquisa, dias de orçamento parado).

-- ───────────────────────── 1. Materiais do pedido ─────────────────────────
create table if not exists public.pedido_materiais (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade numeric(12,3) not null check (quantidade > 0),
  observacoes text,
  baixado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists pedido_materiais_pedido_id_idx on public.pedido_materiais (pedido_id);
create index if not exists pedido_materiais_produto_id_idx on public.pedido_materiais (produto_id);
alter table public.pedido_materiais enable row level security;
drop policy if exists "escritorio_acesso_total" on public.pedido_materiais;
create policy "escritorio_acesso_total" on public.pedido_materiais for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.pedido_materiais to authenticated;

-- Material lançado num pedido que já está em produção sai do estoque na hora.
create or replace function public.material_novo_do_pedido() returns trigger
language plpgsql set search_path = public as $$
declare
  v_status status_pedido;
  v_numero integer;
begin
  select status, numero into v_status, v_numero from pedidos where id = new.pedido_id;
  if v_status in ('em_producao', 'pronto', 'entregue') and not new.baixado then
    insert into movimentos_estoque (produto_id, tipo, quantidade, custo_unitario, referencia, pedido_id)
    select new.produto_id, 'saida', new.quantidade, p.custo, format('Pedido #%s (material)', v_numero), new.pedido_id
    from produtos p where p.id = new.produto_id;
    new.baixado := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_material_novo on public.pedido_materiais;
create trigger trg_material_novo before insert on public.pedido_materiais
for each row execute function public.material_novo_do_pedido();

-- Material que já saiu do estoque não é tirado da lista pelo site (o ajuste é feito no Estoque).

-- ───────────────────────── 2. Baixa quando o pedido entra em produção ─────────────────────────
-- Roda depois da baixa dos itens do pedido (gatilho trg_pedido_baixa_estoque).
-- Se o pedido for cancelado, a devolução de tudo o que saiu já é feita por aquele gatilho.
create or replace function public.baixar_materiais_do_pedido() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status in ('em_producao', 'pronto', 'entregue') then
    insert into movimentos_estoque (produto_id, tipo, quantidade, custo_unitario, referencia, pedido_id)
    select m.produto_id, 'saida', m.quantidade, p.custo, format('Pedido #%s (material)', new.numero), new.id
    from pedido_materiais m
    join produtos p on p.id = m.produto_id
    where m.pedido_id = new.id and not m.baixado;
    update pedido_materiais set baixado = true where pedido_id = new.id and not baixado;
  end if;
  return new;
end $$;

drop trigger if exists trg_pedido_baixa_materiais on public.pedidos;
create trigger trg_pedido_baixa_materiais after update of status on public.pedidos
for each row execute function public.baixar_materiais_do_pedido();

-- ───────────────────────── 3. Saldo livre ─────────────────────────
create or replace view public.produtos_saldo with (security_invoker = true) as
select p.id, p.codigo, p.nome, p.tipo, p.unidade_medida, p.custo, p.preco_venda,
       p.estoque_atual, p.estoque_minimo, p.fornecedor_id, p.ativo,
       coalesce(r.reservado, 0) as reservado,
       p.estoque_atual - coalesce(r.reservado, 0) as livre
from produtos p
left join (
  select m.produto_id, sum(m.quantidade) as reservado
  from pedido_materiais m
  join pedidos pe on pe.id = m.pedido_id
  where not m.baixado and pe.status not in ('cancelado', 'entregue')
  group by m.produto_id
) r on r.produto_id = p.id;
grant select on public.produtos_saldo to authenticated;

-- ───────────────────────── 4. Sobras de chapa ─────────────────────────
create table if not exists public.retalhos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) on delete set null,
  material text not null,
  largura_mm integer not null check (largura_mm > 0),
  altura_mm integer not null check (altura_mm > 0),
  quantidade integer not null default 1 check (quantidade > 0),
  local text,
  pedido_origem_id uuid references public.pedidos(id) on delete set null,
  usado_em date,
  usado_pedido_id uuid references public.pedidos(id) on delete set null,
  observacoes text,
  criado_em timestamptz not null default now()
);
create index if not exists retalhos_produto_id_idx on public.retalhos (produto_id);
create index if not exists retalhos_pedido_origem_id_idx on public.retalhos (pedido_origem_id);
create index if not exists retalhos_usado_pedido_id_idx on public.retalhos (usado_pedido_id);
alter table public.retalhos enable row level security;
drop policy if exists "escritorio_acesso_total" on public.retalhos;
create policy "escritorio_acesso_total" on public.retalhos for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.retalhos to authenticated;

-- ───────────────────────── 5. Entrega e satisfação no pedido ─────────────────────────
alter table public.pedidos
  add column if not exists checklist_entrega jsonb not null default '{}'::jsonb,
  add column if not exists entrega_fotos text[] not null default '{}',
  add column if not exists entrega_recebido_por text,
  add column if not exists entrega_observacoes text,
  add column if not exists satisfacao_nota smallint check (satisfacao_nota between 0 and 10),
  add column if not exists satisfacao_comentario text,
  add column if not exists satisfacao_em date;

-- ───────────────────────── 6. Configurações ─────────────────────────
alter table public.configuracoes
  add column if not exists checklist_entrega_itens text not null default
    'Todos os móveis entregues
Móveis montados e nivelados
Portas e gavetas reguladas
Puxadores e acessórios instalados
Ambiente limpo e sem sobras
Cliente conferiu e aprovou',
  add column if not exists msg_satisfacao text not null default
    'Olá, {cliente}! Aqui é da {empresa}. De 0 a 10, quanto você recomendaria a gente para um amigo? Se quiser, conte o que achou dos seus móveis. Sua opinião ajuda muito!',
  add column if not exists orcamento_parado_dias integer not null default 7 check (orcamento_parado_dias between 1 and 90);

-- ───────────────────────── Histórico de alterações nas tabelas novas ─────────────────────────
do $$
declare
  v_tab text;
begin
  foreach v_tab in array array['pedido_materiais', 'retalhos'] loop
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;

-- Visitante sem login não vê nada das tabelas novas
revoke all on public.pedido_materiais, public.retalhos, public.produtos_saldo from anon;

-- ───────────────────────── Prova ─────────────────────────
do $$
begin
  if to_regclass('public.pedido_materiais') is null then raise exception 'pedido_materiais não foi criada'; end if;
  if to_regclass('public.retalhos') is null then raise exception 'retalhos não foi criada'; end if;
  if to_regclass('public.produtos_saldo') is null then raise exception 'produtos_saldo não foi criada'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'satisfacao_nota') then
    raise exception 'pedidos.satisfacao_nota não foi criada';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'msg_satisfacao') then
    raise exception 'configuracoes.msg_satisfacao não foi criada';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_pedido_baixa_materiais') then
    raise exception 'gatilho da baixa de materiais não foi criado';
  end if;
end $$;

-- Rollback (só como referência, não rodar sem cópia):
-- drop trigger trg_pedido_baixa_materiais on public.pedidos;
-- drop view public.produtos_saldo;
-- drop table public.retalhos; drop table public.pedido_materiais;
-- alter table public.pedidos drop column checklist_entrega, drop column entrega_fotos, drop column entrega_recebido_por,
--   drop column entrega_observacoes, drop column satisfacao_nota, drop column satisfacao_comentario, drop column satisfacao_em;
-- alter table public.configuracoes drop column checklist_entrega_itens, drop column msg_satisfacao, drop column orcamento_parado_dias;
