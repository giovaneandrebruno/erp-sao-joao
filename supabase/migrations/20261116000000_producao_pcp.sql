-- Produção no formato da planilha de PCP da fábrica.
-- Cada ordem de serviço (OS) guarda as colunas da planilha, divididas em
-- Comercial, Administrativo e Operacional, e o STATUS pela legenda de siglas.
-- Só acrescenta colunas, tabela, funções e gatilhos: nada é apagado.

alter table ordens_producao
  add column if not exists os text,
  add column if not exists cliente_id uuid references clientes(id) on delete set null,
  add column if not exists cliente_nome text,
  add column if not exists ambiente text,
  add column if not exists ordem integer,
  -- Comercial
  add column if not exists consultor text,
  add column if not exists arquiteto text,
  add column if not exists data_venda date,
  add column if not exists data_venda_obs text,
  add column if not exists ambientes text,
  add column if not exists memorial text,
  add column if not exists medicao text,
  add column if not exists prazo_texto text,
  add column if not exists prazo_dias integer,
  add column if not exists prazo_limite date,
  -- Administrativo
  add column if not exists status_pcp text not null default 'VR',
  add column if not exists posicao text,
  add column if not exists inicio_ajustes text,
  add column if not exists limite_ajustes text,
  add column if not exists inicio_detalhamento text,
  add column if not exists resp_detalhamento text,
  add column if not exists limite_detalhamento text,
  add column if not exists envio_consultor text,
  add column if not exists aprovacao_cliente text,
  add column if not exists compra_materia_prima text,
  add column if not exists liberacao_corte text,
  -- Operacional
  add column if not exists inicio_pre_montagem text,
  add column if not exists resp_fabricacao text,
  add column if not exists limite_fabricacao text,
  add column if not exists agendamento_entrega text,
  add column if not exists previsao_nf text,
  add column if not exists inicio_montagem text,
  add column if not exists montador text,
  add column if not exists termino_montagem text,
  add column if not exists check_list text,
  add column if not exists pendencias text,
  add column if not exists telefone text,
  add column if not exists endereco text,
  add column if not exists status_alterado_em timestamptz not null default now();

-- Data limite de entrega = data da venda + prazo a cumprir (em dias), ou a data
-- fixa quando o prazo foi combinado com dia certo. É a "SOMA DIAS" da planilha.
alter table ordens_producao
  add column if not exists entrega_limite date
  generated always as (coalesce(prazo_limite, data_venda + prazo_dias)) stored;

do $$ begin
  alter table ordens_producao add constraint ordens_producao_status_pcp_check
    check (status_pcp in ('VR','MD','OC','MF','AP','DET','PC','CO','PM','EM','CL','FIN','IP','PP'));
exception when duplicate_object then null; end $$;

create index if not exists ordens_producao_status_pcp_idx on ordens_producao (status_pcp);
create index if not exists ordens_producao_cliente_idx on ordens_producao (cliente_id);

-- A etapa antiga (usada em pedidos e análises) acompanha o STATUS da planilha.
create or replace function sincronizar_etapa_pcp() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status_pcp is distinct from old.status_pcp then
    new.etapa := case new.status_pcp
      when 'PC' then 'corte'
      when 'CO' then 'corte'
      when 'PM' then 'montagem'
      when 'EM' then 'instalacao'
      when 'CL' then 'instalacao'
      when 'IP' then 'instalacao'
      when 'FIN' then 'concluido'
      else 'aguardando'
    end::etapa_producao;
    if tg_op = 'UPDATE' then new.status_alterado_em := now(); end if;
  end if;
  return new;
end $$;

create or replace trigger trg_ordens_etapa_pcp before insert or update on ordens_producao
  for each row execute function sincronizar_etapa_pcp();

-- Histórico de mudanças de STATUS e POSIÇÃO de cada OS.
create table if not exists producao_historico (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references ordens_producao(id) on delete cascade,
  status_de text,
  status_para text,
  posicao text,
  nota text,
  usuario_id uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists producao_historico_ordem_idx on producao_historico (ordem_id, criado_em desc);

alter table producao_historico enable row level security;
do $$ begin
  create policy escritorio_acesso_total on producao_historico for all
    using (eh_escritorio()) with check (eh_escritorio());
exception when duplicate_object then null; end $$;

create or replace function registrar_historico_pcp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into producao_historico (ordem_id, status_para, posicao) values (new.id, new.status_pcp, new.posicao);
  elsif new.status_pcp is distinct from old.status_pcp or new.posicao is distinct from old.posicao then
    insert into producao_historico (ordem_id, status_de, status_para, posicao)
    values (new.id, old.status_pcp, new.status_pcp, new.posicao);
  end if;
  return new;
end $$;
revoke execute on function registrar_historico_pcp() from public, anon, authenticated;

create or replace trigger trg_ordens_historico_pcp after insert or update on ordens_producao
  for each row execute function registrar_historico_pcp();
