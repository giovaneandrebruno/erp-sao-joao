-- Currículos: arquivos de candidatos (PDF, foto, Word...) com anotações da equipe.
-- Os arquivos ficam na mesma pasta privada "documentos" do Storage, dentro de curriculos/<id>/.
-- Qualquer pessoa da equipe do escritório (administrador ou vendedor) envia, troca, exclui e anota.

create table if not exists public.curriculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  vaga text,
  telefone text,
  email text,
  nome_arquivo text not null,
  caminho text not null unique,
  tamanho bigint,
  tipo_arquivo text,
  enviado_por uuid default auth.uid(),
  enviado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists curriculos_criado_em_idx on public.curriculos (criado_em desc);
alter table public.curriculos enable row level security;
create policy "escritorio_acesso_total" on public.curriculos for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.curriculos to authenticated;

create table if not exists public.curriculo_anotacoes (
  id uuid primary key default gen_random_uuid(),
  curriculo_id uuid not null references public.curriculos(id) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  criado_por uuid default auth.uid(),
  criado_por_nome text default public.nome_do_usuario_atual(),
  alterado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists curriculo_anotacoes_curriculo_id_idx on public.curriculo_anotacoes (curriculo_id, criado_em desc);
alter table public.curriculo_anotacoes enable row level security;
create policy "escritorio_acesso_total" on public.curriculo_anotacoes for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.curriculo_anotacoes to authenticated;

-- Ao alterar: guarda a hora e quem alterou (mesma função da pasta do cliente).
create or replace function public.curriculo_alterado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_table_name = 'curriculo_anotacoes' then
    new.alterado_por_nome := public.nome_do_usuario_atual();
  end if;
  return new;
end $$;

do $$
declare v_tab text;
begin
  foreach v_tab in array array['curriculos', 'curriculo_anotacoes'] loop
    if not exists (select 1 from pg_trigger where tgname = 'curriculo_alterado' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger curriculo_alterado before update on public.%I for each row execute function public.curriculo_alterado()', v_tab);
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;

-- Para desfazer (à mão, se um dia precisar):
-- drop table public.curriculo_anotacoes; drop table public.curriculos; drop function public.curriculo_alterado();
-- (os arquivos ficam no Storage, pasta "documentos/curriculos")
