-- Pasta do cliente: tipos novos "Eletrodomésticos" e "Referência do cliente". Nenhum dado é apagado.
alter table public.cliente_documentos drop constraint if exists cliente_documentos_tipo_check;
alter table public.cliente_documentos add constraint cliente_documentos_tipo_check check (tipo in (
  'pedido_fechado', 'memorial_descritivo', 'eletrodomesticos', 'referencia', 'briefing', 'contrato', 'projeto', 'medidas', 'comprovante', 'foto', 'outro'
));
