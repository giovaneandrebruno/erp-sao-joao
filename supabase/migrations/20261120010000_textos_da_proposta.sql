-- Textos de venda da proposta online (editáveis em Configurações). Só acrescenta colunas.
alter table public.configuracoes
  add column if not exists proposta_abertura text not null default
    'Preparamos este projeto a partir do que você nos contou. Cada móvel é feito sob medida na nossa fábrica, pensado para o seu espaço e para o seu dia a dia.',
  add column if not exists proposta_incluso text not null default
    'Projeto 3D para você aprovar cada detalhe antes da produção
Fabricação própria, com material de primeira
Entrega e montagem pela nossa equipe
Prazo de entrega no contrato',
  add column if not exists proposta_garantias text not null default
    'Garantia de 5 anos
Assistência técnica própria
Prazo garantido em contrato',
  add column if not exists proposta_depoimento text;

create or replace function public.proposta_publica(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc orcamentos%rowtype;
  v jsonb;
begin
  select * into v_orc from orcamentos where token = p_token;
  if not found then return null; end if;
  -- só conta quando quem abre é o cliente (sem login)
  if auth.uid() is null then
    update orcamentos
       set visualizado_em = coalesce(visualizado_em, now()),
           aberturas = aberturas + 1,
           ultima_abertura_em = now()
     where id = v_orc.id;
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
    'empresa', (select jsonb_build_object('nome', c.nome_fantasia, 'telefone', c.telefone, 'email', c.email, 'cidade', c.cidade, 'uf', c.uf) from configuracoes c limit 1),
    'textos', (select jsonb_build_object('abertura', c.proposta_abertura, 'incluso', c.proposta_incluso, 'garantias', c.proposta_garantias, 'depoimento', c.proposta_depoimento) from configuracoes c limit 1)
  ) into v
  from orcamentos_resumo r where r.id = v_orc.id;
  return v;
end $$;
