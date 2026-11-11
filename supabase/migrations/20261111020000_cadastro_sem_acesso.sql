-- Quem se cadastrar sozinho (fora da tela Equipe) entra sem acesso a nada.
-- O primeiro usuário continua virando administrador.

create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_papel papel_usuario;
begin
  if not exists (select 1 from perfis) then
    v_papel := 'admin';
  elsif current_setting('emob.criado_pelo_admin', true) = 'sim' then
    v_papel := 'vendedor';
  else
    -- montador sem parceiro vinculado não enxerga nenhum dado
    v_papel := 'montador';
  end if;
  insert into perfis (user_id, email, papel) values (new.id, new.email, v_papel) on conflict do nothing;
  return new;
end $$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

create or replace function public.admin_criar_usuario(p_email text, p_senha text, p_nome text, p_papel papel_usuario, p_parceiro uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode criar usuários.'; end if;
  perform set_config('emob.criado_pelo_admin', 'sim', true);
  v_id := public.criar_usuario_auth(p_email, p_senha);
  update perfis set nome = nullif(trim(p_nome), ''), papel = coalesce(p_papel, 'vendedor'), parceiro_id = p_parceiro
   where user_id = v_id;
  return v_id;
end $$;
