-- Organograma: cargos/pessoas com quem responde a quem, funções (tarefas do dia a dia)
-- com horas por semana e quem faz cada uma. Serve para ver quem está sobrecarregado
-- e onde falta gente (função sem ninguém ou vaga em aberto).
-- Começa vazio: a equipe cadastra as pessoas e as funções pela tela.
-- Qualquer pessoa do escritório (administrador ou vendedor) vê e altera.

create table if not exists public.organograma_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text,                                   -- vazio = vaga em aberto (cargo sem ninguém)
  cargo text not null check (length(btrim(cargo)) > 0),
  setor text,
  chefe_id uuid references public.organograma_pessoas(id) on delete set null,
  horas_semana numeric(5,1) not null default 44 check (horas_semana >= 0 and horas_semana <= 168),
  observacoes text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (chefe_id is null or chefe_id <> id)
);
-- Posição, tamanho, cor e texto livre do quadro na tela quadriculada.
alter table public.organograma_pessoas add column if not exists pos_x numeric(8,1) not null default 0;
alter table public.organograma_pessoas add column if not exists pos_y numeric(8,1) not null default 0;
alter table public.organograma_pessoas add column if not exists largura numeric(6,1) not null default 240 check (largura between 120 and 1200);
alter table public.organograma_pessoas add column if not exists altura numeric(6,1) not null default 150 check (altura between 80 and 1200);
alter table public.organograma_pessoas add column if not exists cor text not null default 'branco';
alter table public.organograma_pessoas add column if not exists texto text;
create index if not exists organograma_pessoas_chefe_idx on public.organograma_pessoas (chefe_id);

create table if not exists public.organograma_funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  setor text,
  horas_semana numeric(5,1) not null default 0 check (horas_semana >= 0 and horas_semana <= 168),
  descricao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.organograma_atribuicoes (
  id uuid primary key default gen_random_uuid(),
  funcao_id uuid not null references public.organograma_funcoes(id) on delete cascade,
  pessoa_id uuid not null references public.organograma_pessoas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (funcao_id, pessoa_id)
);
create index if not exists organograma_atribuicoes_pessoa_idx on public.organograma_atribuicoes (pessoa_id);

do $$
declare v_tab text;
begin
  foreach v_tab in array array['organograma_pessoas', 'organograma_funcoes', 'organograma_atribuicoes'] loop
    execute format('alter table public.%I enable row level security', v_tab);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tab and policyname = 'escritorio_acesso_total') then
      execute format('create policy "escritorio_acesso_total" on public.%I for all to authenticated using (public.eh_escritorio()) with check (public.eh_escritorio())', v_tab);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_tab);
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;

-- Ao alterar: guarda a hora.
create or replace function public.organograma_alterado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

do $$
declare v_tab text;
begin
  foreach v_tab in array array['organograma_pessoas', 'organograma_funcoes'] loop
    if not exists (select 1 from pg_trigger where tgname = 'organograma_alterado' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger organograma_alterado before update on public.%I for each row execute function public.organograma_alterado()', v_tab);
    end if;
  end loop;
end $$;

-- Para desfazer (à mão, se um dia precisar):
-- drop table public.organograma_atribuicoes; drop table public.organograma_funcoes; drop table public.organograma_pessoas;
-- drop function public.organograma_alterado();
