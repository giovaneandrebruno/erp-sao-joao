-- Funcionários: cadastro completo (dados pessoais, trabalho, banco), arquivos, anotações,
-- atestados e marcações do relógio ponto (importadas de planilha .xlsx ou lançadas à mão).
-- São dados pessoais sensíveis: SÓ O ADMINISTRADOR vê e altera (tabelas e arquivos).
-- Os arquivos ficam numa pasta privada própria do Storage ("funcionarios"), separada da pasta "documentos".

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  apelido text,
  situacao text not null default 'ativo' check (situacao in ('ativo', 'ferias', 'afastado', 'desligado')),
  -- dados pessoais
  cpf text,
  rg text,
  rg_orgao text,
  data_nascimento date,
  estado_civil text,
  escolaridade text,
  nome_mae text,
  nome_pai text,
  pis text,
  ctps text,
  titulo_eleitor text,
  cnh text,
  cnh_categoria text,
  cnh_validade date,
  -- contato e endereço
  telefone text,
  telefone2 text,
  email text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  contato_emergencia_nome text,
  contato_emergencia_parentesco text,
  contato_emergencia_telefone text,
  -- trabalho
  matricula text,
  cargo text,
  setor text,
  tipo_contrato text,
  data_admissao date,
  data_demissao date,
  motivo_demissao text,
  salario numeric(12, 2),
  horas_semana numeric(5, 2),
  horario text,
  -- banco
  banco text,
  agencia text,
  conta text,
  pix text,
  -- saúde
  tipo_sanguineo text,
  alergias text,
  ultimo_exame date,
  proximo_exame date,
  tamanho_camisa text,
  tamanho_calca text,
  tamanho_calcado text,
  observacoes text,
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists funcionarios_nome_idx on public.funcionarios (nome);

create table if not exists public.funcionario_documentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  tipo text not null default 'outro',
  descricao text,
  nome_arquivo text not null,
  caminho text not null unique,
  tamanho bigint,
  tipo_arquivo text,
  enviado_por uuid default auth.uid(),
  enviado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists funcionario_documentos_func_idx on public.funcionario_documentos (funcionario_id, criado_em desc);

create table if not exists public.funcionario_anotacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  criado_por uuid default auth.uid(),
  criado_por_nome text default public.nome_do_usuario_atual(),
  alterado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists funcionario_anotacoes_func_idx on public.funcionario_anotacoes (funcionario_id, criado_em desc);

-- Atestados e afastamentos (o arquivo do atestado é opcional)
create table if not exists public.funcionario_atestados (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  tipo text not null default 'atestado_medico',
  data_inicio date not null,
  data_fim date not null,
  horas numeric(5, 2),
  cid text,
  profissional text,
  observacao text,
  nome_arquivo text,
  caminho text unique,
  tamanho bigint,
  tipo_arquivo text,
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (data_fim >= data_inicio)
);
create index if not exists funcionario_atestados_func_idx on public.funcionario_atestados (funcionario_id, data_inicio desc);

-- Relógio ponto: um registro por funcionário e dia, com as marcações do dia (ex.: {07:30,11:30,13:00,17:18})
create table if not exists public.funcionario_ponto (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  dia date not null,
  marcacoes text[] not null default '{}',
  minutos_trabalhados integer,
  observacao text,
  origem text not null default 'importado' check (origem in ('importado', 'manual')),
  arquivo_origem text,
  criado_por_nome text default public.nome_do_usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (funcionario_id, dia)
);
create index if not exists funcionario_ponto_dia_idx on public.funcionario_ponto (dia);

-- Acesso: só administrador
do $$
declare v_tab text;
begin
  foreach v_tab in array array['funcionarios', 'funcionario_documentos', 'funcionario_anotacoes', 'funcionario_atestados', 'funcionario_ponto'] loop
    execute format('alter table public.%I enable row level security', v_tab);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tab and policyname = 'so_admin') then
      execute format('create policy "so_admin" on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', v_tab);
    end if;
    execute format('revoke all on public.%I from anon', v_tab);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_tab);
  end loop;
end $$;

-- Ao alterar: guarda a hora e quem alterou a anotação
create or replace function public.funcionario_alterado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_table_name = 'funcionario_anotacoes' then
    new.alterado_por_nome := public.nome_do_usuario_atual();
  end if;
  return new;
end $$;

do $$
declare v_tab text;
begin
  foreach v_tab in array array['funcionarios', 'funcionario_documentos', 'funcionario_anotacoes', 'funcionario_atestados', 'funcionario_ponto'] loop
    if not exists (select 1 from pg_trigger where tgname = 'funcionario_alterado' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger funcionario_alterado before update on public.%I for each row execute function public.funcionario_alterado()', v_tab);
    end if;
    -- o ponto importado não entra no histórico de alterações (seriam centenas de linhas por planilha)
    if v_tab <> 'funcionario_ponto' and not exists (select 1 from pg_trigger where tgname = 'auditoria' and tgrelid = format('public.%I', v_tab)::regclass) then
      execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', v_tab);
    end if;
  end loop;
end $$;

-- Pasta privada dos arquivos dos funcionários (50 MB por arquivo), só para o administrador
insert into storage.buckets (id, name, public, file_size_limit)
values ('funcionarios', 'funcionarios', false, 52428800)
on conflict (id) do nothing;

create policy "funcionarios_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'funcionarios' and public.eh_admin());
create policy "funcionarios_ver" on storage.objects for select to authenticated
  using (bucket_id = 'funcionarios' and public.eh_admin());
create policy "funcionarios_trocar" on storage.objects for update to authenticated
  using (bucket_id = 'funcionarios' and public.eh_admin())
  with check (bucket_id = 'funcionarios' and public.eh_admin());
create policy "funcionarios_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'funcionarios' and public.eh_admin());

-- Para desfazer (à mão, se um dia precisar):
-- drop table public.funcionario_ponto, public.funcionario_atestados, public.funcionario_anotacoes, public.funcionario_documentos, public.funcionarios;
-- drop function public.funcionario_alterado();
-- (os arquivos ficam no Storage, pasta "funcionarios")
