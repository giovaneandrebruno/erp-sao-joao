-- Correções de 19/11/2026: tela Análises, financeiro só do administrador,
-- reforço de segurança, índices e baixa automática do estoque.
-- Sem DROP: as versões antigas ficam guardadas com outro nome.

-- ---------------------------------------------------------------- 1. resumo do orçamento
-- O resumo foi criado antes das colunas da proposta online (visualizado_em, aceite...),
-- por isso a tela Análises não achava "visualizado_em". Recriado com todas as colunas.
alter view orcamentos_resumo rename to orcamentos_resumo_v2;
revoke all on orcamentos_resumo_v2 from authenticated;
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
grant select on orcamentos_resumo to authenticated;

-- ---------------------------------------------------------------- 3. financeiro só do administrador
-- O vendedor continua vendo e gerando as parcelas a receber do pedido (tela do pedido e contrato),
-- mas não vê nem altera contas a pagar, lançamentos avulsos, baixas ou exclusões.
alter policy "escritorio_acesso_total" on lancamentos rename to "admin_acesso_total";
alter policy "admin_acesso_total" on lancamentos to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
create policy "escritorio_ve_parcelas_do_pedido" on lancamentos for select to authenticated
  using (public.eh_escritorio() and tipo = 'receber' and pedido_id is not null);
create policy "escritorio_gera_parcelas_do_pedido" on lancamentos for insert to authenticated
  with check (public.eh_escritorio() and tipo = 'receber' and pedido_id is not null and pago_em is null);

-- ---------------------------------------------------------------- 4. segurança
-- Função interna do banco (liga a proteção em tabelas novas): ninguém precisa chamá-la pelo site.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- A regra do perfil passa a ler o usuário uma vez só por consulta (mais rápido).
alter policy "ve_o_proprio_ou_admin" on perfis
  using (user_id = (select auth.uid()) or public.eh_admin());

-- ---------------------------------------------------------------- 5. índices
create index if not exists chamados_pedido_id_idx on chamados (pedido_id);
create index if not exists chamados_responsavel_id_idx on chamados (responsavel_id);
create index if not exists movimentos_estoque_pedido_id_idx on movimentos_estoque (pedido_id);
create index if not exists negociacoes_arquiteto_id_idx on negociacoes (arquiteto_id);
create index if not exists negociacoes_orcamento_id_idx on negociacoes (orcamento_id);
create index if not exists negociacoes_vendedor_id_idx on negociacoes (vendedor_id);
create index if not exists orcamento_itens_produto_id_idx on orcamento_itens (produto_id);
create index if not exists orcamentos_arquiteto_id_idx on orcamentos (arquiteto_id);
create index if not exists orcamentos_vendedor_id_idx on orcamentos (vendedor_id);
create index if not exists pedido_itens_produto_id_idx on pedido_itens (produto_id);
create index if not exists pedido_marcos_responsavel_id_idx on pedido_marcos (responsavel_id);
create index if not exists pedidos_arquiteto_id_idx on pedidos (arquiteto_id);
create index if not exists pedidos_vendedor_id_idx on pedidos (vendedor_id);
create index if not exists perfis_parceiro_id_idx on perfis (parceiro_id);
create index if not exists visitas_parceiro_id_idx on visitas (parceiro_id);

-- ---------------------------------------------------------------- 7. baixa automática do estoque
-- Quando o pedido entra em produção, os produtos do estoque usados nele saem do saldo (uma vez só).
-- Se o pedido for cancelado depois disso, o material volta para o estoque.
create or replace function public.baixar_estoque_do_pedido() returns trigger
language plpgsql set search_path = public as $$
declare
  v_saidas integer;
  v_devolucoes integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select count(*) filter (where tipo = 'saida'), count(*) filter (where tipo = 'entrada')
    into v_saidas, v_devolucoes
    from movimentos_estoque where pedido_id = new.id;

  if new.status in ('em_producao', 'pronto', 'entregue') and v_saidas = 0 then
    insert into movimentos_estoque (produto_id, tipo, quantidade, custo_unitario, referencia, pedido_id)
    select i.produto_id, 'saida', i.quantidade, i.custo_unitario, format('Pedido #%s (baixa automática)', new.numero), new.id
    from pedido_itens i
    join produtos p on p.id = i.produto_id
    where i.pedido_id = new.id and p.tipo <> 'servico' and i.quantidade > 0;
  elsif new.status = 'cancelado' and v_saidas > 0 and v_devolucoes = 0 then
    insert into movimentos_estoque (produto_id, tipo, quantidade, custo_unitario, referencia, pedido_id)
    select m.produto_id, 'entrada', m.quantidade, m.custo_unitario, format('Pedido #%s cancelado (devolução)', new.numero), new.id
    from movimentos_estoque m
    where m.pedido_id = new.id and m.tipo = 'saida';
  end if;
  return new;
end $$;

create trigger trg_pedido_baixa_estoque after update of status on pedidos
for each row execute function public.baixar_estoque_do_pedido();
