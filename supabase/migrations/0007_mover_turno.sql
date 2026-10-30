-- =====================================================================
-- 0007_mover_turno.sql — Mover un turno de una sola vez (tarea A3b)
-- Mover un turno con paciente crea el turno nuevo y marca el original
-- 'reprogramado' con reprogramado_a (sin costo, queda en el historial).
-- Las dos cosas pasan juntas o ninguna: nunca queda un turno duplicado
-- ni uno perdido. Reservados y ocupados se mueven en el lugar.
-- SECURITY INVOKER: corre con los permisos del usuario, así que RLS sigue
-- filtrando por consultorio (no se puede mover un turno de otro).
-- =====================================================================

create or replace function public.mover_turno(p_turno uuid, p_inicio timestamptz, p_fin timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.turnos;
  v_nuevo uuid;
begin
  select * into t from public.turnos where id = p_turno for update;
  if not found then
    raise exception 'Turno no encontrado';
  end if;
  if t.estado <> 'agendado' then
    raise exception 'Solo se puede mover un turno agendado';
  end if;

  -- Reservado u ocupado: no generan cobros, se cambia la hora y listo.
  if t.clase <> 'turno' then
    update public.turnos set inicio = p_inicio, fin = p_fin where id = p_turno;
    return p_turno;
  end if;

  -- El nuevo no es parte de la serie (la serie sigue con su día y hora).
  -- Si el original reponía a otro, el nuevo sigue reponiéndolo.
  insert into public.turnos (consultorio_id, clase, paciente_id, tipo_turno_id, inicio, fin, repone_a)
  values (t.consultorio_id, 'turno', t.paciente_id, t.tipo_turno_id, p_inicio, p_fin, t.repone_a)
  returning id into v_nuevo;

  update public.turnos
  set estado = 'reprogramado', reprogramado_a = v_nuevo, reponer = false
  where id = p_turno;

  return v_nuevo;
end;
$$;

-- Solo usuarios con sesión (Supabase da EXECUTE a anon por defecto, ver 0003).
revoke all on function public.mover_turno(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.mover_turno(uuid, timestamptz, timestamptz) to authenticated;
