-- Cópia de segurança (quando foi baixada e por quem) e mensagem de cobrança de parcela vencida.
alter table configuracoes
  add column if not exists ultima_copia_em timestamptz,
  add column if not exists ultima_copia_por text,
  add column if not exists msg_cobranca_vencida text not null default
    'Olá, {cliente}! Aqui é da {empresa}. A {parcela} de {valor}, com vencimento em {data}, ainda está em aberto. Se já pagou, pode desconsiderar. Qualquer dúvida, estamos à disposição!';
