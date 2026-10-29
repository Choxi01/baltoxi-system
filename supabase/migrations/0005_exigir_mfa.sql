-- =====================================================================
-- 0005_exigir_mfa.sql — La base exige el código del Autenticador
-- Sin esto, con solo la contraseña (sesión "aal1") se podía consultar la
-- API de Supabase directamente y saltear la pantalla del código.
-- Ahora los datos solo se ven con sesión "aal2" (contraseña + código).
-- =====================================================================

-- Todas las políticas RLS (y las del bucket `documentos`) pasan por esta
-- función: si la sesión no tiene el código, no devuelve ningún consultorio.
create or replace function public.mis_consultorios()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select consultorio_id from public.miembros
  where user_id = auth.uid()
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

alter policy miembro_ver on public.miembros
  using (user_id = auth.uid() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2');
