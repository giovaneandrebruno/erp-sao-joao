-- Dados de demonstração (somente para o ambiente local / demonstração).
-- NÃO rode este arquivo no banco de produção.
do $$
declare
  v_vend1 uuid; v_vend2 uuid; v_arq1 uuid; v_arq2 uuid; v_mont1 uuid; v_mont2 uuid;
  v_forn1 uuid; v_forn2 uuid;
  c uuid[];
  o uuid; p uuid; i int;
begin
  update configuracoes set razao_social = 'São João Móveis Ltda', cnpj = '00.000.000/0001-00',
    endereco = 'Av. Brasil, 1000', cidade = 'São João', uf = 'PR', telefone = '(00) 0000-0000',
    email = 'contato@saojoaomoveis.com.br';

  insert into parceiros (nome, tipo, telefone, comissao_padrao) values ('Carla Mendes', 'vendedor', '(00) 99999-0001', 3) returning id into v_vend1;
  insert into parceiros (nome, tipo, telefone, comissao_padrao) values ('Rafael Souza', 'vendedor', '(00) 99999-0002', 3) returning id into v_vend2;
  insert into parceiros (nome, tipo, telefone, comissao_padrao, chave_pix) values ('Arq. Juliana Prado', 'arquiteto', '(00) 99999-0003', 10, 'juliana@pix') returning id into v_arq1;
  insert into parceiros (nome, tipo, telefone, comissao_padrao) values ('Estúdio Linha Design', 'arquiteto', '(00) 99999-0004', 8) returning id into v_arq2;
  insert into parceiros (nome, tipo, telefone) values ('Marcos (montador)', 'montador', '(00) 99999-0005') returning id into v_mont1;
  insert into parceiros (nome, tipo, telefone) values ('Equipe Paulo', 'montador', '(00) 99999-0006') returning id into v_mont2;

  insert into fornecedores (nome, contato, telefone) values ('Distribuidora de Chapas Sul', 'Fernanda', '(00) 3333-1000') returning id into v_forn1;
  insert into fornecedores (nome, contato, telefone) values ('Ferragens Norte', 'Jorge', '(00) 3333-2000') returning id into v_forn2;

  insert into produtos (codigo, nome, tipo, unidade_medida, custo, preco_venda, estoque_minimo, fornecedor_id) values
    ('MDF-BR18', 'MDF branco 18mm (chapa 2,75x1,85)', 'materia_prima', 'chapa', 289, 0, 20, v_forn1),
    ('MDF-AM18', 'MDF amadeirado 18mm (chapa)', 'materia_prima', 'chapa', 389, 0, 10, v_forn1),
    ('MDF-BR06', 'MDF branco 6mm fundo (chapa)', 'materia_prima', 'chapa', 129, 0, 10, v_forn1),
    ('FITA-BR', 'Fita de borda branca 22mm', 'materia_prima', 'rolo', 45, 0, 5, v_forn1),
    ('DOB-35', 'Dobradiça 35mm com amortecedor', 'materia_prima', 'un', 9.5, 0, 100, v_forn2),
    ('CORR-45', 'Corrediça telescópica 45cm', 'materia_prima', 'par', 28, 0, 30, v_forn2),
    ('PUX-PERF', 'Puxador perfil alumínio (barra 3m)', 'materia_prima', 'barra', 62, 0, 10, v_forn2),
    ('LOJA-MESA6', 'Mesa de jantar 6 lugares', 'produto', 'un', 1450, 3290, 2, null),
    ('LOJA-CAD', 'Cadeira estofada', 'produto', 'un', 210, 489, 12, null),
    ('SERV-MONT', 'Montagem e instalação', 'servico', 'serviço', 0, 450, 0, null);

  insert into movimentos_estoque (produto_id, tipo, quantidade, referencia)
  select id, 'ajuste', q, 'Inventário inicial' from (values
    ('MDF-BR18', 34), ('MDF-AM18', 6), ('MDF-BR06', 18), ('FITA-BR', 9), ('DOB-35', 240),
    ('CORR-45', 22), ('PUX-PERF', 14), ('LOJA-MESA6', 3), ('LOJA-CAD', 20)) v(cod, q)
  join produtos on produtos.codigo = v.cod;

  with novos as (
    insert into clientes (nome, telefone, email, cidade, uf, cpf_cnpj) values
      ('Ana Paula Ribeiro', '(00) 98888-1001', 'ana@email.com', 'São João', 'PR', '111.111.111-11'),
      ('Bruno e Letícia Alves', '(00) 98888-1002', null, 'São João', 'PR', null),
      ('Clínica Sorriso', '(00) 3222-1003', 'adm@clinica.com', 'Vila Nova', 'PR', '22.222.222/0001-22'),
      ('Daniela Costa', '(00) 98888-1004', null, 'São João', 'PR', null),
      ('Eduardo Martins', '(00) 98888-1005', 'edu@email.com', 'Vila Nova', 'PR', null),
      ('Fernanda Lima', '(00) 98888-1006', null, 'São João', 'PR', null),
      ('Gustavo Henrique', '(00) 98888-1007', null, 'Campo Alegre', 'PR', null),
      ('Helena Duarte', '(00) 98888-1008', null, 'São João', 'PR', null)
    returning id
  )
  select array_agg(id) into c from novos;

  -- Funil de vendas
  insert into negociacoes (cliente_id, titulo, etapa, origem, valor_estimado, vendedor_id, arquiteto_id, proxima_acao, proxima_acao_data) values
    (c[4], 'Dormitório casal com closet', 'novo', 'Instagram', 18000, v_vend1, null, 'Ligar para agendar visita', current_date),
    (c[5], 'Cozinha completa', 'contato', 'Indicação', 32000, v_vend2, null, 'Enviar fotos de projetos', current_date + 1),
    (c[6], 'Home office', 'medicao', 'Site', 9500, v_vend1, null, 'Medição no apartamento', current_date + 2),
    (c[7], 'Apartamento inteiro', 'projeto', 'Arquiteto', 85000, v_vend2, v_arq2, 'Apresentar projeto 3D', current_date + 4),
    (c[8], 'Banheiro e lavanderia', 'negociacao', 'Loja (visita)', 14500, v_vend1, null, 'Retornar sobre desconto', current_date - 1);

  -- Orçamento em negociação (proposta enviada)
  insert into orcamentos (cliente_id, status, prazo_entrega_dias, vendedor_id, arquiteto_id, comissao_vendedor_pct, comissao_arquiteto_pct, forma_pagamento, parcelas, taxa_pagamento_pct, condicoes_pagamento)
  values (c[1], 'enviado', 45, v_vend1, v_arq1, 3, 10, 'cartao_credito', 10, 3.5, '20% de entrada e saldo em 10x no cartão') returning id into o;
  insert into orcamento_itens (orcamento_id, ambiente, descricao, quantidade, custo_unitario, preco_unitario, ordem) values
    (o, 'Cozinha', 'Armários inferiores em MDF branco com puxador perfil', 1, 4200, 9800, 1),
    (o, 'Cozinha', 'Armários aéreos com portas basculantes', 1, 2600, 6200, 2),
    (o, 'Cozinha', 'Torre quente para forno e micro-ondas', 1, 1500, 3600, 3),
    (o, 'Área de serviço', 'Armário sobre tanque e nicho para máquina', 1, 1300, 3100, 4);
  insert into negociacoes (cliente_id, titulo, etapa, origem, valor_estimado, vendedor_id, arquiteto_id, orcamento_id, proxima_acao, proxima_acao_data)
  values (c[1], 'Cozinha + área de serviço', 'proposta', 'Arquiteto', 22700, v_vend1, v_arq1, o, 'Confirmar aprovação do orçamento', current_date + 1);

  -- Pedido 1: aprovado há algumas semanas, em produção
  insert into orcamentos (cliente_id, prazo_entrega_dias, vendedor_id, comissao_vendedor_pct, forma_pagamento, parcelas, desconto, condicoes_pagamento)
  values (c[2], 30, v_vend2, 3, 'pix', 1, 500, '50% de entrada e 50% na entrega') returning id into o;
  insert into orcamento_itens (orcamento_id, ambiente, descricao, quantidade, custo_unitario, preco_unitario, ordem) values
    (o, 'Dormitório casal', 'Guarda-roupa 6 portas de correr com espelho', 1, 4900, 11200, 1),
    (o, 'Dormitório casal', 'Cabeceira painel ripado com criados-mudos', 1, 1700, 3900, 2),
    (o, 'Dormitório solteiro', 'Guarda-roupa 3 portas + escrivaninha', 1, 2100, 4800, 3);
  p := aprovar_orcamento(o);
  update pedidos set status = 'em_producao', criado_em = now() - interval '18 days' where id = p;
  update pedido_marcos set previsto = previsto - 18, realizado = previsto - 18 where pedido_id = p and tipo in ('medicao', 'projeto_executivo', 'compra_material');
  update pedido_marcos set previsto = previsto - 18 where pedido_id = p and tipo not in ('medicao', 'projeto_executivo', 'compra_material');
  update pedido_marcos set responsavel_id = v_mont1 where pedido_id = p and tipo = 'montagem';
  update pedidos set data_entrega_prevista = data_entrega_prevista - 18 where id = p;
  insert into ordens_producao (pedido_id, descricao, etapa, responsavel, prazo) values
    (p, 'Guarda-roupa casal', 'montagem', 'Zé da bancada', current_date + 5),
    (p, 'Cabeceira e criados', 'acabamento', 'Zé da bancada', current_date + 6),
    (p, 'Quarto solteiro', 'corte', 'Toninho', current_date + 8);
  insert into lancamentos (tipo, descricao, categoria, valor, vencimento, pago_em, forma_pagamento, cliente_id, pedido_id) values
    ('receber', 'Pedido — entrada', 'Venda', 9700, current_date - 18, current_date - 18, 'Pix', c[2], p),
    ('receber', 'Pedido — parcela 1/1', 'Venda', 9700, current_date + 12, null, 'Pix', c[2], p);
  update lancamentos set descricao = replace(descricao, 'Pedido', 'Pedido #' || (select numero from pedidos where id = p)) where pedido_id = p;

  -- Pedido 2: aprovado agora, com arquiteto (RT), marcos novos
  insert into orcamentos (cliente_id, prazo_entrega_dias, vendedor_id, arquiteto_id, comissao_vendedor_pct, comissao_arquiteto_pct, forma_pagamento, parcelas, taxa_pagamento_pct)
  values (c[3], 40, v_vend1, v_arq1, 3, 10, 'boleto', 4, 0) returning id into o;
  insert into orcamento_itens (orcamento_id, ambiente, descricao, quantidade, custo_unitario, preco_unitario, ordem) values
    (o, 'Recepção', 'Balcão de atendimento em MDF amadeirado com tampo branco', 1, 3800, 8900, 1),
    (o, 'Consultórios', 'Armários de apoio com gavetas (consultório)', 3, 1450, 3400, 2),
    (o, 'Copa', 'Armário de copa com nicho para frigobar', 1, 900, 2300, 3);
  p := aprovar_orcamento(o);
  update pedidos set criado_em = now() - interval '2 days' where id = p;
  insert into ordens_producao (pedido_id, descricao, etapa, responsavel, prazo) values (p, 'Balcão da recepção', 'aguardando', 'Toninho', current_date + 25);
  insert into lancamentos (tipo, descricao, categoria, valor, vencimento, forma_pagamento, cliente_id, pedido_id)
  select 'receber', 'Pedido #' || pe.numero || ' — parcela ' || g || '/4', 'Venda', 5175, current_date + (g * 30 - 28), 'Boleto', c[3], p
  from generate_series(1, 4) g, pedidos pe where pe.id = p;

  -- Pedido 3: venda da loja, entregue
  insert into orcamentos (cliente_id, unidade, prazo_entrega_dias, vendedor_id, comissao_vendedor_pct, forma_pagamento, parcelas, taxa_pagamento_pct)
  values (c[5], 'loja', 7, v_vend2, 3, 'cartao_debito', 1, 1.5) returning id into o;
  insert into orcamento_itens (orcamento_id, produto_id, descricao, quantidade, custo_unitario, preco_unitario, ordem)
  select o, id, nome, q, custo, preco_venda, 1 from produtos, (values ('LOJA-MESA6', 1), ('LOJA-CAD', 6)) v(cod, q) where codigo = v.cod;
  p := aprovar_orcamento(o);
  update pedidos set status = 'entregue', criado_em = now() - interval '5 days' where id = p;
  update pedido_marcos set realizado = previsto where pedido_id = p;
  insert into lancamentos (tipo, unidade, descricao, categoria, valor, vencimento, pago_em, forma_pagamento, cliente_id, pedido_id)
  select 'receber', 'loja', 'Pedido #' || numero || ' — à vista', 'Venda', 6224, current_date - 5, current_date - 5, 'Cartão de débito', c[5], p from pedidos where id = p;
  insert into movimentos_estoque (produto_id, tipo, quantidade, referencia, pedido_id)
  select id, 'saida', q, 'Venda loja', p from produtos, (values ('LOJA-MESA6', 1), ('LOJA-CAD', 6)) v(cod, q) where codigo = v.cod;

  -- Contas a pagar
  insert into lancamentos (tipo, descricao, categoria, valor, vencimento, pago_em, fornecedor_id) values
    ('pagar', 'Compra de 40 chapas MDF', 'Matéria-prima', 11560, current_date - 10, current_date - 10, v_forn1),
    ('pagar', 'Ferragens (dobradiças e corrediças)', 'Ferragens', 2380, current_date + 3, null, v_forn2),
    ('pagar', 'Aluguel do galpão', 'Aluguel', 4500, current_date + 5, null, null),
    ('pagar', 'Energia elétrica', 'Energia', 1870, current_date - 2, null, null),
    ('pagar', 'Folha de pagamento', 'Salários', 18400, current_date + 8, null, null);

  -- Assistência técnica
  insert into chamados (cliente_id, descricao, status, prioridade, data_agendada, responsavel_id)
  values (c[6], 'Porta do armário da cozinha desalinhada e batendo', 'agendado', 'normal', current_date + 2, v_mont2),
         (c[8], 'Corrediça da gaveta do banheiro travando', 'aberto', 'alta', null, null);
end $$;

-- Fase 4: endereço de exemplo e serviços atribuídos ao montador (para testar o app de campo)
update clientes set endereco = 'Rua das Palmeiras, 120', cidade = 'São José do Rio Preto', uf = 'SP'
 where nome like 'Bruno%' and endereco is null;
update pedido_marcos m set responsavel_id = (select id from parceiros where nome like 'Marcos%' limit 1)
  from pedidos p where p.id = m.pedido_id and p.numero = 1 and m.tipo in ('entrega', 'montagem');
