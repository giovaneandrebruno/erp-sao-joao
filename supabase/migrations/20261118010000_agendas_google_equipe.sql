-- As agendas do Google passam a ser da empresa: o administrador liga e desliga,
-- e toda a equipe do escritório vê os compromissos na tela Agenda.
alter policy "so_o_dono" on public.agendas_google rename to "admin_altera";
alter policy "admin_altera" on public.agendas_google
  using (public.eh_admin()) with check (public.eh_admin());
create policy "escritorio_le" on public.agendas_google
  for select to authenticated using (public.eh_escritorio());
