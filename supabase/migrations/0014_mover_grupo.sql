-- =====================================================================
-- 0014_mover_grupo.sql — Mover una sesión doble o grupal entera (tarea A11b)
-- Una sesión = los turnos con el mismo grupo_id y la misma hora de inicio
-- (un turno fijo grupal usa el mismo grupo_id todas las semanas).
-- Igual que mover_turno (0007), pero para todos los chicos de la sesión que
-- siguen 'agendado': cada original queda 'reprogramado' con reprogramado_a y se
-- crea uno nuevo por chico en el horario nuevo, todos con un grupo_id nuevo y
-- fuera del turno fijo. Todo pasa junto o nada.
-- Devuelve (original, nuevo) por chico: el servidor anota el cobro de Gs. 0 de
-- cada original y arma el mensaje de cada familia.
-- SECURITY INVOKER: RLS sigue filtrando por consultorio.
-- =====================================================================

create or replace function public.mover_grupo(
  p_grupo uuid,
  p_inicio_actual timestamptz,
  p_inicio timestamptz,
  p_fin timestamptz
)
returns table (original uuid, nuevo uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.turnos;
  v_grupo uuid := gen_random_uuid();
  v_nuevo uuid;
  v_cantidad integer := 0;
begin
  for t in
    select * from public.turnos
    where grupo_id = p_grupo and inicio = p_inicio_actual and clase = 'turno' and estado = 'agendado'
    order by id
    for update
  loop
    insert into public.turnos (consultorio_id, clase, paciente_id, tipo_turno_id, grupo_id, inicio, fin, repone_a)
    values (t.consultorio_id, 'turno', t.paciente_id, t.tipo_turno_id, v_grupo, p_inicio, p_fin, t.repone_a)
    returning id into v_nuevo;

    update public.turnos
    set estado = 'reprogramado', reprogramado_a = v_nuevo, reponer = false
    where id = t.id;

    original := t.id;
    nuevo := v_nuevo;
    v_cantidad := v_cantidad + 1;
    return next;
  end loop;

  if v_cantidad = 0 then
    raise exception 'No hay turnos agendados en esa sesión';
  end if;
end;
$$;

-- Solo usuarios con sesión (Supabase da EXECUTE a anon por defecto, ver 0003).
revoke all on function public.mover_grupo(uuid, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.mover_grupo(uuid, timestamptz, timestamptz, timestamptz) to authenticated;
