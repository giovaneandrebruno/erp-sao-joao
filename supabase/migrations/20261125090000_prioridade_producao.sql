-- Prioridade de produção: lista curta, na ordem, dos próximos clientes a produzir.
-- Fica no Painel. Texto livre (é um resumo do quadro da produção, sem ligação com as OS).
-- Qualquer pessoa do escritório (administrador ou vendedor) adiciona, edita, tira e muda a ordem.

create table if not exists public.prioridade_producao (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (length(btrim(texto)) > 0),
  posicao integer not null default 0,
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists prioridade_producao_posicao_idx on public.prioridade_producao (posicao);
alter table public.prioridade_producao enable row level security;
create policy "escritorio_acesso_total" on public.prioridade_producao for all to authenticated
  using (public.eh_escritorio()) with check (public.eh_escritorio());
grant select, insert, update, delete on public.prioridade_producao to authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = 'public.prioridade_producao'::regclass) then
    create trigger auditoria after insert or update or delete on public.prioridade_producao
      for each row execute function public.registrar_auditoria();
  end if;
end $$;

-- Lista atual passada pelo dono (2026-11-25), na ordem.
insert into public.prioridade_producao (texto, posicao, criado_por_nome)
select t.texto, t.posicao, 'Sistema'
from (values
  ('Danilo chacara PT6', 1),
  ('Camila e Flavio SP PT4', 2),
  ('Kelly PT2', 3),
  ('Rafael e Carina', 4),
  ('Edmilson', 5),
  ('Luis e Rosi', 6),
  ('Douglas e Meire', 7),
  ('Rafael e Fernanda', 8),
  ('Rose e Demetrius', 9),
  ('Vladimir e Simone', 10),
  ('Matheus Oliveira', 11),
  ('Viviane casa', 12)
) as t(texto, posicao)
where not exists (select 1 from public.prioridade_producao);

-- Para desfazer (à mão, se um dia precisar): drop table public.prioridade_producao;
