-- Melhorias tiradas das atas da diretoria:
--  1. Reuniões: atas com ações (responsável, prazo, situação). O que fica aberto passa para a reunião seguinte.
--  2. Comissões: regras editáveis (RT, comercial por faixa de vendas, gerência, projetos, conferente).
--  3. Calculadora de margem no orçamento: markup por perfil do cliente (baixo, médio, alto).
--  4. Prazos em dias úteis: orçamento até 5 dias úteis após o pedido do comercial e entrega até
--     60 dias úteis após a medição.
--  5. Funcionários: políticas da empresa e banco de horas.
-- Só cria tabelas e colunas novas e troca duas funções. Não apaga nada.

-- ================================================================ dias úteis
-- Domingo de Páscoa (algoritmo de Meeus), para os feriados móveis.
create or replace function public.pascoa(p_ano int) returns date
language plpgsql immutable set search_path = public as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mes int; dia int;
begin
  a := p_ano % 19; b := p_ano / 100; c := p_ano % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31; dia := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_ano, mes, dia);
end $$;

-- Feriado nacional (fixos + Carnaval, Sexta-feira Santa e Corpus Christi)
create or replace function public.eh_feriado(p_dia date) returns boolean
language plpgsql immutable set search_path = public as $$
declare v_p date := public.pascoa(extract(year from p_dia)::int);
begin
  return to_char(p_dia, 'MM-DD') in ('01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25')
      or p_dia in (v_p - 48, v_p - 47, v_p - 2, v_p + 60);
end $$;

create or replace function public.eh_dia_util(p_dia date) returns boolean
language sql immutable set search_path = public as $$
  select extract(isodow from p_dia) < 6 and not public.eh_feriado(p_dia)
$$;

-- Soma N dias úteis a uma data (N = 0 devolve a própria data, ou o próximo dia útil se cair em folga)
create or replace function public.somar_dias_uteis(p_dia date, p_n int) returns date
language plpgsql immutable set search_path = public as $$
declare v date := p_dia; v_falta int := greatest(coalesce(p_n, 0), 0);
begin
  if p_dia is null then return null; end if;
  if v_falta = 0 then
    while not public.eh_dia_util(v) loop v := v + 1; end loop;
    return v;
  end if;
  while v_falta > 0 loop
    v := v + 1;
    if public.eh_dia_util(v) then v_falta := v_falta - 1; end if;
  end loop;
  return v;
end $$;

-- ================================================================ configurações novas
alter table public.configuracoes
  add column if not exists prazo_orcamento_dias_uteis integer not null default 5,
  add column if not exists prazo_entrega_dias_uteis integer not null default 60,
  add column if not exists markup_perfil_baixo numeric(6, 3),
  add column if not exists markup_perfil_medio numeric(6, 3),
  add column if not exists markup_perfil_alto numeric(6, 3);

-- Começa com o markup padrão de hoje: baixo = padrão, médio = +10%, alto = +20% (ajustável em Configurações)
update public.configuracoes set
  markup_perfil_baixo = coalesce(markup_perfil_baixo, markup_padrao),
  markup_perfil_medio = coalesce(markup_perfil_medio, round(markup_padrao * 1.10, 3)),
  markup_perfil_alto  = coalesce(markup_perfil_alto,  round(markup_padrao * 1.20, 3));

-- ================================================================ orçamento: pedido do comercial e perfil
alter table public.orcamentos
  add column if not exists solicitado_em date default current_date,
  add column if not exists perfil_margem text check (perfil_margem in ('baixo', 'medio', 'alto'));
update public.orcamentos set solicitado_em = criado_em::date where solicitado_em is null;

-- O prazo de entrega do orçamento passa a ser em DIAS ÚTEIS, contados da medição.
comment on column public.orcamentos.prazo_entrega_dias is 'Prazo de entrega em dias úteis, contados a partir da medição do ambiente';

-- ================================================================ aprovar orçamento (marcos em dias úteis)
create or replace function public.aprovar_orcamento(p_orcamento_id uuid)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orc orcamentos%rowtype;
  v_pedido_id uuid;
  v_prazo integer;
  v_med date;
  v_entrega date;
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

  -- prazo em dias úteis contados da medição (padrão nas configurações: 60)
  v_prazo := coalesce(v_orc.prazo_entrega_dias, (select prazo_entrega_dias_uteis from configuracoes limit 1), 60);
  v_med := public.somar_dias_uteis(current_date, greatest(1, round(v_prazo * 0.07)::int));
  v_entrega := public.somar_dias_uteis(v_med, v_prazo);

  insert into pedidos (orcamento_id, cliente_id, unidade, desconto, observacoes, data_entrega_prevista,
                       vendedor_id, arquiteto_id, comissao_vendedor_pct, comissao_arquiteto_pct,
                       forma_pagamento, parcelas, taxa_pagamento_pct, imposto_pct)
  values (v_orc.id, v_orc.cliente_id, v_orc.unidade, v_orc.desconto, v_orc.observacoes, v_entrega,
          v_orc.vendedor_id, v_orc.arquiteto_id, v_orc.comissao_vendedor_pct, v_orc.comissao_arquiteto_pct,
          v_orc.forma_pagamento, v_orc.parcelas, v_orc.taxa_pagamento_pct, v_orc.imposto_pct)
  returning id into v_pedido_id;

  insert into pedido_itens (pedido_id, produto_id, ambiente, descricao, quantidade, preco_unitario, custo_unitario, ordem)
  select v_pedido_id, produto_id, ambiente, descricao, quantidade, preco_unitario, custo_unitario, ordem
  from orcamento_itens where orcamento_id = p_orcamento_id;

  insert into pedido_marcos (pedido_id, tipo, previsto) values
    (v_pedido_id, 'medicao',           v_med),
    (v_pedido_id, 'projeto_executivo', public.somar_dias_uteis(v_med, greatest(1, round(v_prazo * 0.08)::int))),
    (v_pedido_id, 'compra_material',   public.somar_dias_uteis(v_med, greatest(2, round(v_prazo * 0.18)::int))),
    (v_pedido_id, 'producao',          public.somar_dias_uteis(v_med, greatest(3, round(v_prazo * 0.80)::int))),
    (v_pedido_id, 'entrega',           v_entrega),
    (v_pedido_id, 'montagem',          public.somar_dias_uteis(v_entrega, 3)),
    (v_pedido_id, 'vistoria',          public.somar_dias_uteis(v_entrega, 7));

  return v_pedido_id;
end $function$;

-- Quando a medição é feita, os marcos que ainda faltam são recalculados a partir dela
-- (entrega = medição + prazo em dias úteis). Marco já feito não muda.
create or replace function public.recalcular_marcos_da_medicao() returns trigger
language plpgsql set search_path = public as $$
declare
  v_prazo int;
  v_entrega date;
begin
  if new.tipo <> 'medicao' or new.realizado is null or new.realizado is not distinct from old.realizado then
    return new;
  end if;
  select coalesce(o.prazo_entrega_dias, c.prazo_entrega_dias_uteis, 60) into v_prazo
    from pedidos p left join orcamentos o on o.id = p.orcamento_id cross join (select prazo_entrega_dias_uteis from configuracoes limit 1) c
   where p.id = new.pedido_id;
  v_prazo := coalesce(v_prazo, 60);
  v_entrega := public.somar_dias_uteis(new.realizado, v_prazo);

  update pedido_marcos m set previsto = case m.tipo
      when 'projeto_executivo' then public.somar_dias_uteis(new.realizado, greatest(1, round(v_prazo * 0.08)::int))
      when 'compra_material'   then public.somar_dias_uteis(new.realizado, greatest(2, round(v_prazo * 0.18)::int))
      when 'producao'          then public.somar_dias_uteis(new.realizado, greatest(3, round(v_prazo * 0.80)::int))
      when 'entrega'           then v_entrega
      when 'montagem'          then public.somar_dias_uteis(v_entrega, 3)
      when 'vistoria'          then public.somar_dias_uteis(v_entrega, 7)
      else m.previsto end
   where m.pedido_id = new.pedido_id and m.realizado is null and m.id <> new.id
     and m.tipo in ('projeto_executivo', 'compra_material', 'producao', 'entrega', 'montagem', 'vistoria');

  update pedidos set data_entrega_prevista = v_entrega
   where id = new.pedido_id and status not in ('entregue', 'cancelado');
  return new;
end $$;

drop trigger if exists recalcular_marcos_da_medicao on public.pedido_marcos;
create trigger recalcular_marcos_da_medicao after update of realizado on public.pedido_marcos
  for each row execute function public.recalcular_marcos_da_medicao();

-- ================================================================ reuniões e ações
create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  data date not null default current_date,
  tipo text not null default 'reuniao' check (tipo in ('pre', 'reuniao', 'pos')),
  assunto text,
  participantes text,
  local text,
  inicio time,
  termino time,
  anotacoes text,
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists reunioes_data_idx on public.reunioes (data desc, numero desc);

create table if not exists public.reuniao_acoes (
  id uuid primary key default gen_random_uuid(),
  reuniao_id uuid not null references public.reunioes(id) on delete cascade,
  descricao text not null check (length(btrim(descricao)) > 0),
  responsavel text,
  prazo date,
  situacao text not null default 'novo' check (situacao in ('novo', 'pendente', 'ok')),
  concluida_em date,
  observacao text,
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists reuniao_acoes_reuniao_idx on public.reuniao_acoes (reuniao_id, criado_em);
create index if not exists reuniao_acoes_abertas_idx on public.reuniao_acoes (situacao) where situacao <> 'ok';

-- Reunião nova: as ações "novas" das reuniões anteriores que não foram resolvidas viram "pendentes"
create or replace function public.reuniao_passar_pendencias() returns trigger
language plpgsql set search_path = public as $$
begin
  update reuniao_acoes a set situacao = 'pendente'
    from reunioes r
   where r.id = a.reuniao_id and a.situacao = 'novo' and r.id <> new.id
     and (r.data < new.data or (r.data = new.data and r.numero < new.numero));
  return new;
end $$;
drop trigger if exists reuniao_passar_pendencias on public.reunioes;
create trigger reuniao_passar_pendencias after insert on public.reunioes
  for each row execute function public.reuniao_passar_pendencias();

-- Marcar "ok" guarda a data; reabrir apaga
create or replace function public.reuniao_acao_alterada() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if new.situacao = 'ok' and new.concluida_em is null then new.concluida_em := current_date; end if;
  if new.situacao <> 'ok' then new.concluida_em := null; end if;
  return new;
end $$;
drop trigger if exists reuniao_acao_alterada on public.reuniao_acoes;
create trigger reuniao_acao_alterada before insert or update on public.reuniao_acoes
  for each row execute function public.reuniao_acao_alterada();

-- ================================================================ comissões
-- tipo: rt = % de cada pedido com arquiteto/indicador; comercial = % das vendas do mês de cada vendedor,
-- pela faixa; equipe = % das vendas do mês da loja inteira para uma pessoa ou função.
create table if not exists public.comissao_regras (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('rt', 'comercial', 'equipe')),
  nome text not null check (length(btrim(nome)) > 0),
  percentual numeric(6, 3) not null default 0 check (percentual >= 0 and percentual <= 100),
  minimo_mes numeric(14, 2) not null default 0 check (minimo_mes >= 0),
  pessoa text,
  observacao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists comissao_regras_rt_unica on public.comissao_regras (tipo) where tipo in ('rt', 'comercial');

-- Faixas do comercial: a partir de quanto vendido no mês vale cada %. Vale a % da maior faixa atingida.
create table if not exists public.comissao_faixas (
  id uuid primary key default gen_random_uuid(),
  a_partir_de numeric(14, 2) not null check (a_partir_de >= 0),
  percentual numeric(6, 3) not null check (percentual >= 0 and percentual <= 100),
  criado_em timestamptz not null default now(),
  unique (a_partir_de)
);

-- Valores da última ata (ainda "em discussão": tudo pode ser alterado na tela de regras)
insert into public.comissao_regras (tipo, nome, percentual, minimo_mes, observacao, ordem)
select * from (values
  ('rt', 'RT de arquiteto / indicador', 10::numeric, 0::numeric, 'Sobre cada pedido com arquiteto. Se o pedido tiver uma % própria, vale a do pedido.', 1),
  ('comercial', 'Comercial (vendedores)', 0::numeric, 75000::numeric, 'Sobre o total vendido por cada vendedor no mês, pela faixa atingida.', 2),
  ('equipe', 'Gerência comercial', 3::numeric, 250000::numeric, 'Sobre as vendas gerais do mês, quando passar da meta.', 3),
  ('equipe', 'Projetos (projeto)', 0.5::numeric, 0::numeric, 'Sobre as vendas do mês.', 4),
  ('equipe', 'Projetos (venda)', 1.5::numeric, 0::numeric, 'Sobre as vendas do mês.', 5),
  ('equipe', 'Conferente', 1::numeric, 0::numeric, 'Sobre as vendas do mês.', 6)
) v(tipo, nome, percentual, minimo_mes, observacao, ordem)
where not exists (select 1 from public.comissao_regras);

insert into public.comissao_faixas (a_partir_de, percentual)
select * from (values (75000::numeric, 1::numeric), (200000::numeric, 2::numeric), (300000::numeric, 3::numeric)) v(a, p)
where not exists (select 1 from public.comissao_faixas);

-- ================================================================ políticas da empresa
create table if not exists public.politicas_empresa (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) > 0),
  texto text,
  ordem integer not null default 0,
  alterado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

insert into public.politicas_empresa (titulo, texto, ordem)
select * from (values
  ('Horário de entrada e saída', null::text, 1),
  ('Intervalos e almoço', null::text, 2),
  ('Local de almoço e descanso', null::text, 3),
  ('Uso do celular', null::text, 4),
  ('Banco de horas', null::text, 5)
) v(titulo, texto, ordem)
where not exists (select 1 from public.politicas_empresa);

-- ================================================================ banco de horas
alter table public.funcionarios
  add column if not exists banco_horas_inicio date,
  add column if not exists banco_horas_saldo_inicial integer not null default 0; -- em minutos (pode ser negativo)

-- ================================================================ acesso: só administrador
do $$
declare v_tab text;
begin
  foreach v_tab in array array['reunioes', 'reuniao_acoes', 'comissao_regras', 'comissao_faixas', 'politicas_empresa'] loop
    execute format('alter table public.%I enable row level security', v_tab);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tab and policyname = 'so_admin') then
      execute format('create policy "so_admin" on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', v_tab);
    end if;
    execute format('revoke all on public.%I from anon', v_tab);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_tab);
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;
grant usage, select on sequence public.reunioes_numero_seq to authenticated;

-- updated_at das tabelas simples
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_table_name = 'politicas_empresa' then new.alterado_por_nome := public.nome_do_usuario_atual(); end if;
  return new;
end $$;
do $$
declare v_tab text;
begin
  foreach v_tab in array array['reunioes', 'comissao_regras', 'politicas_empresa'] loop
    if not exists (select 1 from pg_trigger where tgname = 'tocar_atualizado_em' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger tocar_atualizado_em before update on public.%I for each row execute function public.tocar_atualizado_em()', v_tab);
    end if;
  end loop;
end $$;

-- funções de dias úteis: qualquer usuário logado pode usar
revoke all on function public.pascoa(int), public.eh_feriado(date), public.eh_dia_util(date), public.somar_dias_uteis(date, int) from anon;
grant execute on function public.pascoa(int), public.eh_feriado(date), public.eh_dia_util(date), public.somar_dias_uteis(date, int) to authenticated;
revoke all on function public.recalcular_marcos_da_medicao(), public.reuniao_passar_pendencias(), public.reuniao_acao_alterada(), public.tocar_atualizado_em() from anon, authenticated;

-- Para desfazer (à mão, se um dia precisar):
-- drop table public.reuniao_acoes, public.reunioes, public.comissao_faixas, public.comissao_regras, public.politicas_empresa;
-- drop trigger recalcular_marcos_da_medicao on public.pedido_marcos;
-- alter table public.funcionarios drop column banco_horas_inicio, drop column banco_horas_saldo_inicial;
-- alter table public.orcamentos drop column solicitado_em, drop column perfil_margem;
-- (aprovar_orcamento: voltar a versão de 20261107010000_vendas_lucro_prazos.sql)
