-- Processo do pedido: etapas, situações com responsável e prazo, checklists, datas limite,
-- forma de pagamento combinada, motivo do cancelamento, pasta devolvida para correção,
-- ocorrências da montagem e assistência por tipo (garantia ou mau uso).
-- Só acrescenta: nenhum dado é apagado.

-- ───────────────────────── pedido: etapa e situação ─────────────────────────
alter table public.pedidos
  add column if not exists etapa text not null default 'venda',
  add column if not exists situacao text,
  add column if not exists situacao_responsavel_id uuid references public.perfis(user_id) on delete set null,
  add column if not exists situacao_prazo date,
  add column if not exists situacao_desde timestamptz,
  add column if not exists checklists jsonb not null default '{}'::jsonb,
  add column if not exists data_limite_assinatura date,
  add column if not exists data_limite_entrega date,
  add column if not exists pagamento_combinado text,
  add column if not exists cancelamento_motivo text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_etapa_check') then
    alter table public.pedidos add constraint pedidos_etapa_check check (etapa in (
      'pre_venda', 'venda', 'medicao', 'executivo', 'fabricacao', 'entrega', 'montagem',
      'pos_montagem', 'concluido', 'assistencia', 'cancelamento'
    ));
  end if;
end $$;

-- pedidos que já existiam: etapa a partir do status de hoje
update public.pedidos set etapa = case status
    when 'em_producao' then 'fabricacao'
    when 'pronto' then 'entrega'
    when 'entregue' then 'concluido'
    when 'cancelado' then 'cancelamento'
    else 'venda' end
  where etapa = 'venda' and status <> 'aberto';

create index if not exists pedidos_etapa_idx on public.pedidos (etapa);
create index if not exists pedidos_situacao_resp_idx on public.pedidos (situacao_responsavel_id) where situacao_responsavel_id is not null;

-- ───────────────────────── histórico das etapas ─────────────────────────
create table if not exists public.pedido_etapas_historico (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  etapa text not null,
  situacao text,
  observacao text,
  feito_por uuid default auth.uid(),
  feito_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now()
);
create index if not exists pedido_etapas_historico_pedido_idx on public.pedido_etapas_historico (pedido_id, criado_em desc);
alter table public.pedido_etapas_historico enable row level security;
create policy "escritorio_acesso_total" on public.pedido_etapas_historico for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.pedido_etapas_historico to authenticated;

-- ───────────────────────── pasta devolvida para correção ─────────────────────────
create table if not exists public.cliente_pasta_devolucoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  motivo text not null check (length(btrim(motivo)) > 0),
  responsavel_id uuid references public.perfis(user_id) on delete set null,
  devolvida_por uuid default auth.uid(),
  devolvida_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  corrigida_em timestamptz,
  corrigida_por_nome text
);
create index if not exists cliente_pasta_devolucoes_cliente_idx on public.cliente_pasta_devolucoes (cliente_id, criado_em desc);
create index if not exists cliente_pasta_devolucoes_abertas_idx on public.cliente_pasta_devolucoes (responsavel_id) where corrigida_em is null;
alter table public.cliente_pasta_devolucoes enable row level security;
create policy "escritorio_acesso_total" on public.cliente_pasta_devolucoes for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.cliente_pasta_devolucoes to authenticated;

-- ───────────────────────── ocorrências da montagem ─────────────────────────
create table if not exists public.pedido_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  tipo text not null default 'outro' check (tipo in (
    'embalagem_avariada', 'peca_defeito', 'peca_faltando', 'corte_extra', 'peca_extra', 'alteracao_projeto', 'outro'
  )),
  ambiente text,
  descricao text not null check (length(btrim(descricao)) > 0),
  fotos text[] not null default '{}',
  chamado_id uuid references public.chamados(id) on delete set null,
  resolvida_em timestamptz,
  criado_por uuid default auth.uid(),
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now()
);
create index if not exists pedido_ocorrencias_pedido_idx on public.pedido_ocorrencias (pedido_id, criado_em desc);
alter table public.pedido_ocorrencias enable row level security;
create policy "escritorio_acesso_total" on public.pedido_ocorrencias for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.pedido_ocorrencias to authenticated;

-- ───────────────────────── assistência por tipo ─────────────────────────
alter table public.chamados
  add column if not exists tipo text not null default 'garantia',
  add column if not exists depende_de text,
  add column if not exists taxa_visita numeric(12,2),
  add column if not exists diarias numeric(6,1),
  add column if not exists valor_diaria numeric(12,2);
update public.chamados set tipo = 'mau_uso' where not em_garantia and tipo = 'garantia';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chamados_tipo_check') then
    alter table public.chamados add constraint chamados_tipo_check check (tipo in ('garantia', 'mau_uso'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chamados_depende_de_check') then
    alter table public.chamados add constraint chamados_depende_de_check check (depende_de is null or depende_de in ('loja', 'fabrica'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chamados_diarias_check') then
    alter table public.chamados add constraint chamados_diarias_check check (diarias is null or diarias >= 1);
  end if;
end $$;

-- ───────────────────────── pasta: assinaturas novas ─────────────────────────
alter table public.cliente_documentos drop constraint if exists cliente_documentos_tipo_check;
alter table public.cliente_documentos add constraint cliente_documentos_tipo_check check (tipo in (
  'pedido_fechado', 'memorial_descritivo', 'eletrodomesticos', 'referencia', 'briefing', 'contrato', 'projeto', 'medidas',
  'isencao_eletros', 'executivo_assinado', 'liberacao_entrega', 'termo_entrega', 'termo_vistoria',
  'comprovante', 'foto', 'outro'
));

-- histórico de alterações nas tabelas novas (mesma regra das outras)
do $$
declare v_tab text;
begin
  foreach v_tab in array array['pedido_etapas_historico', 'cliente_pasta_devolucoes', 'pedido_ocorrencias'] loop
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;
