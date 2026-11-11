-- Criar usuários de dentro do sistema, sem precisar da chave secreta do Supabase.

create function public.criar_usuario_auth(p_email text, p_senha text) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if length(coalesce(p_senha, '')) < 8 then raise exception 'A senha precisa ter pelo menos 8 caracteres.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Já existe um usuário com esse e-mail.'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  return v_id;
end $$;
revoke execute on function public.criar_usuario_auth(text, text) from public, anon, authenticated;

-- Só o administrador chama, pela tela Equipe.
create function public.admin_criar_usuario(p_email text, p_senha text, p_nome text, p_papel papel_usuario, p_parceiro uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode criar usuários.'; end if;
  v_id := public.criar_usuario_auth(p_email, p_senha);
  update perfis set nome = nullif(trim(p_nome), ''), papel = coalesce(p_papel, 'vendedor'), parceiro_id = p_parceiro
   where user_id = v_id;
  return v_id;
end $$;
revoke execute on function public.admin_criar_usuario(text, text, text, papel_usuario, uuid) from public, anon;
grant execute on function public.admin_criar_usuario(text, text, text, papel_usuario, uuid) to authenticated;
