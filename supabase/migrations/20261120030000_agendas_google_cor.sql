-- Cada agenda do Google ganha uma cor, escolhida pelo administrador.
alter table public.agendas_google
  add column if not exists cor text not null default '#2563eb'
  check (cor ~ '^#[0-9a-fA-F]{6}$');
