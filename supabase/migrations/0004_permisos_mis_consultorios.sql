-- =====================================================================
-- 0004_permisos_mis_consultorios.sql — Completa 0003
-- En Postgres toda función nueva tiene EXECUTE para PUBLIC, y `anon` lo
-- hereda de ahí: sacarlo solo de `anon` no alcanzaba. Se lo quitamos a
-- PUBLIC y se lo damos explícitamente a `authenticated` (lo usan las
-- políticas RLS y las del bucket `documentos`).
-- =====================================================================

revoke execute on function public.mis_consultorios() from public, anon;
grant execute on function public.mis_consultorios() to authenticated;
