-- Fase 4: perfis de acesso, registro de campo (montador), proposta online e mensagens de WhatsApp.

-- ---------------------------------------------------------------- perfis de acesso
create type papel_usuario as enum ('admin', 'vendedor', 'montador');

create table perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  papel papel_usuario not null default 'vendedor',
  parceiro_id uuid references parceiros(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Quem já existe vira administrador; o primeiro usuário criado depois também.
insert into perfis (user_id, email, papel)
select id, email, 'admin' from auth.users
on conflict do nothing;

create function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (user_id, email, papel)
  values (new.id, new.email, case when exists (select 1 from perfis) then 'vendedor'::papel_usuario else 'admin'::papel_usuario end)
  on conflict do nothing;
  return new;
end $$;
create trigger trg_criar_perfil after insert on auth.users for each row execute function public.criar_perfil();

create function public.papel_atual() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where user_id = auth.uid()
$$;

create function public.meu_parceiro() returns uuid
language sql stable security definer set search_path = public as $$
  select parceiro_id from perfis where user_id = auth.uid()
$$;

create function public.eh_escritorio() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('admin', 'vendedor') from perfis where user_id = auth.uid()), false)
$$;

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' from perfis where user_id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- registro de campo
create table visitas (
  id uuid primary key default gen_random_uuid(),
  marco_id uuid references pedido_marcos(id) on delete cascade,
  chamado_id uuid references chamados(id) on delete cascade,
  parceiro_id uuid references parceiros(id) on delete set null,
  usuario_id uuid default auth.uid(),
  checkin_em timestamptz not null default now(),
  checkout_em timestamptz,
  latitude numeric(9,6),
  longitude numeric(9,6),
  observacoes text,
  fotos text[] not null default '{}',
  check (marco_id is not null or chamado_id is not null)
);
create index on visitas (marco_id);
create index on visitas (chamado_id);

-- ---------------------------------------------------------------- proposta online
alter table orcamentos
  add column token uuid not null default gen_random_uuid() unique,
  add column visualizado_em timestamptz,
  add column aceite_em timestamptz,
  add column aceite_nome text;

-- ---------------------------------------------------------------- mensagens prontas de WhatsApp
alter table configuracoes
  add column msg_orcamento text not null default 'Olá, {cliente}! Aqui é da {empresa}. Segue a sua proposta de {valor}: {link}
Qualquer dúvida, estou à disposição.',
  add column msg_agendamento text not null default 'Olá, {cliente}! Aqui é da {empresa}. Confirmando a {etapa} no dia {data}. Podemos contar com o local liberado?',
  add column msg_cobranca text not null default 'Olá, {cliente}! Aqui é da {empresa}. Lembrete da parcela de {valor} com vencimento em {data}. Obrigado!',
  add column msg_pos_venda text not null default 'Olá, {cliente}! Aqui é da {empresa}. Como estão os seus móveis? Ficou alguma coisa para ajustarmos?';

-- ---------------------------------------------------------------- permissões
-- Escritório (admin e vendedor) mantém acesso total; montador só enxerga o próprio serviço.
-- A regra antiga (todo usuário logado vê tudo) é ajustada no lugar, sem apagar nada.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not in ('perfis', 'configuracoes')
  loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'funcionarios_acesso_total') then
      execute format('alter policy "funcionarios_acesso_total" on %I rename to "escritorio_acesso_total"', t);
      execute format('alter policy "escritorio_acesso_total" on %I to authenticated using (public.eh_escritorio()) with check (public.eh_escritorio())', t);
    else
      execute format('create policy "escritorio_acesso_total" on %I for all to authenticated using (public.eh_escritorio()) with check (public.eh_escritorio())', t);
    end if;
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Configurações: todos os funcionários leem; só o administrador altera.
alter policy "funcionarios_acesso_total" on configuracoes rename to "admin_altera";
alter policy "admin_altera" on configuracoes to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "escritorio_le" on configuracoes for select to authenticated using (true);

alter table perfis enable row level security;
create policy "ve_o_proprio_ou_admin" on perfis for select to authenticated using (user_id = auth.uid() or public.eh_admin());
create policy "admin_altera" on perfis for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
grant select, update on perfis to authenticated;

-- Montador
create policy "montador_ve_seus_marcos" on pedido_marcos for select to authenticated using (responsavel_id = public.meu_parceiro());
create policy "montador_conclui_seus_marcos" on pedido_marcos for update to authenticated
  using (responsavel_id = public.meu_parceiro()) with check (responsavel_id = public.meu_parceiro());
create policy "montador_ve_seus_chamados" on chamados for select to authenticated using (responsavel_id = public.meu_parceiro());
create policy "montador_atualiza_seus_chamados" on chamados for update to authenticated
  using (responsavel_id = public.meu_parceiro()) with check (responsavel_id = public.meu_parceiro());
create policy "montador_ve_seus_pedidos" on pedidos for select to authenticated using (
  exists (select 1 from pedido_marcos m where m.pedido_id = pedidos.id and m.responsavel_id = public.meu_parceiro())
  or exists (select 1 from chamados ch where ch.pedido_id = pedidos.id and ch.responsavel_id = public.meu_parceiro()));
create policy "montador_ve_itens" on pedido_itens for select to authenticated using (
  exists (select 1 from pedido_marcos m where m.pedido_id = pedido_itens.pedido_id and m.responsavel_id = public.meu_parceiro()));
create policy "montador_ve_seus_clientes" on clientes for select to authenticated using (
  exists (select 1 from pedidos p join pedido_marcos m on m.pedido_id = p.id where p.cliente_id = clientes.id and m.responsavel_id = public.meu_parceiro())
  or exists (select 1 from chamados ch where ch.cliente_id = clientes.id and ch.responsavel_id = public.meu_parceiro()));
create policy "montador_ve_parceiros" on parceiros for select to authenticated using (id = public.meu_parceiro());
create policy "montador_registra_visitas" on visitas for all to authenticated
  using (parceiro_id = public.meu_parceiro()) with check (parceiro_id = public.meu_parceiro());

-- ---------------------------------------------------------------- fotos (Storage)
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false) on conflict do nothing;
create policy "fotos_enviar" on storage.objects for insert to authenticated with check (bucket_id = 'fotos');
create policy "fotos_ver" on storage.objects for select to authenticated using (bucket_id = 'fotos');

-- ---------------------------------------------------------------- funções da proposta online (acesso sem login, pelo token)
create function public.proposta_publica(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_orc orcamentos%rowtype;
  v jsonb;
begin
  select * into v_orc from orcamentos where token = p_token;
  if not found then return null; end if;
  -- só conta a visualização quando quem abre é o cliente (sem login)
  if v_orc.visualizado_em is null and auth.uid() is null then
    update orcamentos set visualizado_em = now() where id = v_orc.id;
  end if;
  select jsonb_build_object(
    'numero', r.numero, 'status', r.status, 'validade', r.validade, 'criado_em', r.criado_em,
    'observacoes', r.observacoes, 'prazo_entrega_dias', r.prazo_entrega_dias,
    'forma_pagamento', r.forma_pagamento, 'parcelas', r.parcelas, 'condicoes_pagamento', r.condicoes_pagamento,
    'subtotal', r.subtotal, 'desconto', r.desconto, 'total', r.total,
    'aceite_em', v_orc.aceite_em, 'aceite_nome', v_orc.aceite_nome,
    'cliente', r.cliente_nome,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('ambiente', i.ambiente, 'descricao', i.descricao, 'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario) order by i.ordem, i.id)
                       from orcamento_itens i where i.orcamento_id = v_orc.id), '[]'::jsonb),
    'empresa', (select jsonb_build_object('nome', c.nome_fantasia, 'telefone', c.telefone, 'email', c.email, 'cidade', c.cidade, 'uf', c.uf) from configuracoes c limit 1)
  ) into v
  from orcamentos_resumo r where r.id = v_orc.id;
  return v;
end $$;

create function public.aceitar_proposta(p_token uuid, p_nome text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_nome), '') = '' then return false; end if;
  update orcamentos set aceite_em = now(), aceite_nome = left(trim(p_nome), 120)
   where token = p_token and aceite_em is null and status in ('rascunho', 'enviado')
     and (validade is null or validade >= current_date);
  return found;
end $$;

revoke all on function public.proposta_publica(uuid) from public;
revoke all on function public.aceitar_proposta(uuid, text) from public;
grant execute on function public.proposta_publica(uuid) to anon, authenticated;
grant execute on function public.aceitar_proposta(uuid, text) to anon, authenticated;
