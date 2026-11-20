-- Situação do cliente ganha "ocioso" (já comprou, mas está parado).
-- "cliente" continua sendo o valor gravado para quem está ativo; nenhum dado muda.
alter table clientes drop constraint if exists clientes_situacao_check;
alter table clientes add constraint clientes_situacao_check check (situacao in ('lead', 'cliente', 'ocioso', 'inativo'));

-- Prova
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_situacao_check' and pg_get_constraintdef(oid) like '%ocioso%') then
    raise exception 'regra da situação sem ocioso';
  end if;
end $$;

-- Rollback (referência): voltar a regra sem 'ocioso' só depois de trocar quem estiver ocioso.
-- alter table clientes drop constraint if exists clientes_situacao_check;
-- alter table clientes add constraint clientes_situacao_check check (situacao in ('lead', 'cliente', 'inativo'));
