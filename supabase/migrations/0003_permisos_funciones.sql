-- =====================================================================
-- 0003_permisos_funciones.sql — Ajustes del revisor de seguridad de Supabase
-- Supabase da EXECUTE a `anon` y `authenticated` en toda función nueva de
-- `public`, así que el `revoke ... from public` de 0001 no alcanzaba:
-- cualquiera sin sesión podía llamar a estas funciones por /rest/v1/rpc.
-- =====================================================================

-- Sin sesión no se llama a nada (anon no tiene políticas ni consultorio).
revoke execute on function public.crear_consultorio(text) from anon;
revoke execute on function public.mis_consultorios() from anon;

-- Función de trigger: se ejecuta sola al escribir, nadie la llama por RPC.
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

-- mis_consultorios() sigue habilitada para `authenticated`: la usan todas
-- las políticas RLS y las del bucket `documentos`.

-- search_path fijo, igual que el resto de las funciones.
alter function public.bloquear_periodo_cerrado() set search_path = public;
