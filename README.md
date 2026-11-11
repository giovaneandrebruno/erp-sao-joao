# Emob Pro · ERP da São João Móveis

Sistema de gestão da marcenaria e da loja São João Móveis, feito sob medida.

## Módulos

| Área | Módulo | O que faz |
|---|---|---|
| Vendas | Painel | Vendido no mês com lucro, funil, prazos atrasados, contas da semana, retornos do dia |
| Vendas | Funil de vendas | Negociações por etapa (novo contato → negociação → ganho/perdido), próxima ação, origem, histórico, atalho de WhatsApp |
| Vendas | Clientes | Cadastro com histórico de orçamentos e pedidos |
| Vendas | Orçamentos | Itens por ambiente com custo e venda, markup automático, comissões, forma de pagamento, previsão de lucro e PDF; importação dos itens do programa de projeto (planilha CSV ou texto copiado) |
| Vendas | Proposta online | Link para o cliente ver a proposta no celular e aceitar; o sistema mostra quando ele abriu e quando aceitou |
| Operação | Pedidos | Nasce da aprovação do orçamento: resultado (lucro), marcos de prazo, ordens de produção, parcelas e contrato em PDF |
| Operação | Agenda | Calendário do mês com medições, entregas, montagens, assistência e retornos de venda, por pessoa |
| Operação | Prazos | Marcos atrasados e dos próximos 21 dias de todos os pedidos |
| Operação | Produção | Quadro por etapa: corte, fita de borda, montagem, acabamento, pronto, instalação |
| Operação | Assistência técnica | Chamados de pós-venda com visita, montador e garantia |
| Operação | App do montador | Tela de celular com os serviços do dia, como chegar, WhatsApp, check-in com localização, fotos e conclusão |
| Gestão | Financeiro | Contas a pagar e a receber por mês, vencidos e saldo previsto |
| Gestão | Relatórios | Vendas e lucro do mês, caixa, últimos 12 meses, vendas por vendedor, despesas por categoria, origem dos clientes e motivos de perda |
| Gestão | Comissões | Comissão de vendedores e RT de arquitetos por mês |
| Gestão | Estoque | Matéria-prima e produtos, movimentações e alerta de mínimo |
| Gestão | Fornecedores, Equipe e parceiros | Cadastros de fornecedores, vendedores, arquitetos e montadores; usuários e perfis de acesso |
| Gestão | Configurações | Dados da empresa, impostos, taxas de cartão, comissões padrão, markup, margem mínima, cláusulas do contrato e mensagens prontas de WhatsApp |

## Configuração em produção

### 1. Supabase

1. Em **SQL Editor**, rode, nesta ordem, os arquivos de `supabase/migrations/`.
2. Em **Authentication > Sign In / Providers**, desligue "Allow new users to sign up".
3. Em **Authentication > Users > Add user**, crie o **seu** acesso (marque "Auto Confirm User"). O primeiro usuário vira administrador.
4. Entre no sistema e preencha **Configurações** com os dados da empresa.
5. Em **Equipe e parceiros**, crie o acesso dos funcionários e escolha o perfil de cada um.

### Perfis de acesso

| Perfil | O que vê |
|---|---|
| Administrador | Tudo |
| Escritório / vendas | Tudo, menos financeiro, comissões, relatórios, equipe e configurações |
| Montador | Só o app de campo, com os serviços em que ele é o responsável |

> `supabase/seed.sql` tem dados de demonstração. **Não** rode em produção.

### 2. Vercel

O projeto já vem configurado (`vercel.json`): Next.js, servidor em São Paulo (`gru1`), perto do banco.

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `erp-sao-joao`. Não mude nada em Build Settings.
2. Em **Environment Variables**, adicione:

   | Nome | Onde pegar no Supabase | Obrigatória |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings › API Keys (ou Data API) › Project URL | Sim |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings › API Keys › Publishable key (`sb_publishable_…`) | Sim |
   | `NEXT_PUBLIC_SITE_URL` | O endereço do site no Vercel, ex.: `https://emob-pro.vercel.app` | Recomendada (links da proposta) |

3. Clique em **Deploy**. Cada alteração aprovada no GitHub publica sozinha.
4. No Supabase, em **Authentication › URL Configuration**, coloque o endereço do Vercel em **Site URL**.

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
- O montador só enxerga, no próprio banco, os pedidos, clientes e chamados em que ele é o responsável.
- A proposta online só abre com o link (código aleatório) e mostra apenas itens, valores de venda e condições. Custos e lucro nunca saem.
- As fotos de campo ficam num espaço privado do Supabase Storage e só abrem para usuários logados.
- Nunca coloque chaves secretas no código. O `.env.local` não vai para o GitHub.
