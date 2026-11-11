-- Ajustes de segurança apontados pelo verificador do Supabase.

-- Funções com caminho de busca fixo.
alter function public.set_atualizado_em() set search_path = public;
alter function public.aplicar_movimento_estoque() set search_path = public;
alter function public.orcamento_padroes() set search_path = public;

-- Funções internas: ninguém de fora chama diretamente.
revoke execute on function public.criar_perfil() from public, anon, authenticated;

-- Funções de permissão: só usuários logados (usadas nas regras de acesso).
revoke execute on function public.papel_atual() from public, anon;
revoke execute on function public.meu_parceiro() from public, anon;
revoke execute on function public.eh_escritorio() from public, anon;
revoke execute on function public.eh_admin() from public, anon;
grant execute on function public.papel_atual() to authenticated;
grant execute on function public.meu_parceiro() to authenticated;
grant execute on function public.eh_escritorio() to authenticated;
grant execute on function public.eh_admin() to authenticated;

-- proposta_publica e aceitar_proposta continuam abertas de propósito:
-- o cliente abre a proposta pelo link, sem login, e só com o código secreto do link.
