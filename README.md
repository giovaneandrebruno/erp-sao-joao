# ERP São João

Sistema de gestão da Marcenaria São João e da loja São João Móveis.

**Módulos:** clientes, orçamentos (com impressão em PDF), pedidos, produção (quadro por etapa),
estoque e produtos, financeiro (contas a pagar e a receber) e fornecedores.

**Tecnologia:** Next.js (site) + Supabase (banco de dados e login) + Vercel (publicação).

## Fluxo principal

1. Cadastre o **cliente**.
2. Crie o **orçamento**, adicione os itens por ambiente e imprima/salve em PDF para enviar.
3. Quando o cliente aprovar, clique em **Aprovar e gerar pedido**.
4. No **pedido**, crie as **ordens de produção** e gere as **parcelas a receber**.
5. Acompanhe a produção no quadro **Produção** (corte → fita de borda → montagem → acabamento → pronto → instalação).
6. Dê baixa nos recebimentos e pagamentos no **Financeiro**.

## Configuração

### 1. Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. Em **SQL Editor**, rode o arquivo `supabase/migrations/20261107000000_schema_inicial.sql`.
3. Em **Authentication > Sign In / Providers**, desative "Allow new users to sign up".
4. Em **Authentication > Users**, clique em **Add user** para criar o acesso de cada funcionário.

### 2. Rodar no computador

```bash
cp .env.example .env.local   # preencha com a URL e a chave publishable do Supabase
npm install
npm run dev                  # abre em http://localhost:3000
```

### 3. Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório.
2. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Clique em **Deploy**. A cada alteração aprovada no GitHub, o Vercel publica de novo.

## Segurança

- Somente usuários logados acessam os dados (Row Level Security em todas as tabelas).
- Nunca coloque senhas ou chaves secretas (`service_role`) no código. O `.env.local` não vai para o GitHub.
