# Emob Pro · ERP da São João Móveis

Sistema de gestão da marcenaria e da loja São João Móveis, feito sob medida.

## Módulos

| Área | Módulo | O que faz |
|---|---|---|
| Vendas | Painel | Vendido no mês com lucro, funil, prazos atrasados, contas da semana, retornos do dia |
| Vendas | Funil de vendas | Negociações por etapa (novo contato → negociação → ganho/perdido), próxima ação, origem, histórico, atalho de WhatsApp |
| Vendas | Clientes | Cadastro com histórico de orçamentos e pedidos |
| Vendas | Orçamentos | Itens por ambiente com custo e venda, markup automático, comissões, forma de pagamento, previsão de lucro e PDF |
| Operação | Pedidos | Nasce da aprovação do orçamento: resultado (lucro), marcos de prazo, ordens de produção, parcelas e contrato em PDF |
| Operação | Prazos | Marcos atrasados e dos próximos 21 dias de todos os pedidos |
| Operação | Produção | Quadro por etapa: corte, fita de borda, montagem, acabamento, pronto, instalação |
| Operação | Assistência técnica | Chamados de pós-venda com visita, montador e garantia |
| Gestão | Financeiro | Contas a pagar e a receber por mês, vencidos e saldo previsto |
| Gestão | Comissões | Comissão de vendedores e RT de arquitetos por mês |
| Gestão | Estoque | Matéria-prima e produtos, movimentações e alerta de mínimo |
| Gestão | Fornecedores, Equipe e parceiros | Cadastros de fornecedores, vendedores, arquitetos e montadores |
| Gestão | Configurações | Dados da empresa, impostos, taxas de cartão, comissões padrão, markup, margem mínima e cláusulas do contrato |

## Configuração em produção

### 1. Supabase

1. Em **SQL Editor**, rode, nesta ordem, os arquivos de `supabase/migrations/`.
2. Em **Authentication > Sign In / Providers**, desligue "Allow new users to sign up".
3. Em **Authentication > Users > Add user**, crie o acesso de cada funcionário (marque "Auto Confirm User").
4. Entre no sistema e preencha **Configurações** com os dados da empresa.

> `supabase/seed.sql` tem dados de demonstração. **Não** rode em produção.

### 2. Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório.
2. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Clique em **Deploy**.

## Desenvolvimento local

Requer Node 20+ e Docker.

```bash
npm install
npx supabase start            # sobe banco, login e API locais e aplica as migrações
npx supabase db reset         # opcional: recria o banco com os dados de demonstração
cp .env.example .env.local    # preencha com a API URL e a chave publishable do "supabase status"
npm run dev                   # http://localhost:3000
```

## Segurança

- Só usuários logados acessam os dados (Row Level Security em todas as tabelas). Visitantes não veem nada.
- Nunca coloque chaves secretas no código. O `.env.local` não vai para o GitHub.
