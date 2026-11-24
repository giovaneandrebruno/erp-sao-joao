-- Cliente novo (lead): situação do atendimento com responsável e prazo
-- (qualificar, projeto de venda, em negociação, carteira futura). Só acrescenta.
-- O pedido fechado segue a etapa SCRUM da ordem de serviço (quadro da Produção).
alter table public.clientes
  add column if not exists atendimento_situacao text,
  add column if not exists atendimento_responsavel_id uuid references public.perfis(user_id) on delete set null,
  add column if not exists atendimento_prazo date,
  add column if not exists atendimento_desde timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_atendimento_situacao_check') then
    alter table public.clientes add constraint clientes_atendimento_situacao_check check (
      atendimento_situacao is null or atendimento_situacao in ('qualificar', 'projeto_venda', 'em_negociacao', 'carteira_futura')
    );
  end if;
end $$;
create index if not exists clientes_atendimento_prazo_idx on public.clientes (atendimento_prazo) where atendimento_prazo is not null;
