-- =====================================================================
-- 0012_facturas.sql — Marcar facturado (tarea B7)
-- 1. Se saca "una factura por tutor y mes": si una familia paga después de
--    facturar, ese pago también tiene que poder facturarse. Lo normal sigue
--    siendo una por familia y mes, porque la pantalla junta todos los pagos
--    del mes que todavía no tienen factura.
-- 2. El número de factura no se repite dentro de un consultorio.
-- 3. crear_factura: crea la factura y vincula los pagos de una sola vez.
--    Las dos cosas pasan juntas o ninguna: nunca queda una factura sin pagos
--    ni pagos a medio vincular.
--    SECURITY INVOKER: corre con los permisos del usuario, así que RLS sigue
--    filtrando por consultorio (no se pueden tocar pagos de otro).
-- =====================================================================

alter table public.facturas
  drop constraint facturas_consultorio_id_tutor_id_mes_cobro_key;

alter table public.facturas
  add constraint facturas_consultorio_id_numero_key unique (consultorio_id, numero);

-- p_emitida_en viene de la app (día en Asunción): `current_date` usa la hora del
-- servidor (UTC), que a la noche del último día del mes ya es el mes siguiente.
create or replace function public.crear_factura(
  p_tutor uuid,
  p_mes date,
  p_numero text,
  p_concepto text,
  p_emitida_en date,
  p_pagos uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_consultorio uuid;
  v_cantidad integer;
  v_monto bigint;
  v_factura uuid;
begin
  -- Se bloquean los pagos: dos pedidos a la vez no pueden facturar el mismo pago.
  perform 1 from public.pagos where id = any(p_pagos) order by id for update;

  select consultorio_id into v_consultorio
  from public.pagos where id = any(p_pagos) limit 1;
  if not found then
    raise exception 'Los pagos cambiaron';
  end if;

  -- El monto sale de los pagos, no de lo que mande la pantalla.
  select count(*), coalesce(sum(monto_gs), 0) into v_cantidad, v_monto
  from public.pagos
  where id = any(p_pagos)
    and consultorio_id = v_consultorio
    and tutor_id = p_tutor
    and factura_id is null
    and date_trunc('month', fecha)::date = p_mes;

  if v_cantidad <> cardinality(p_pagos) then
    raise exception 'Los pagos cambiaron';
  end if;

  insert into public.facturas (consultorio_id, tutor_id, mes_cobro, monto_gs, concepto, numero, emitida_en)
  values (v_consultorio, p_tutor, p_mes, v_monto, p_concepto, p_numero, p_emitida_en)
  returning id into v_factura;

  update public.pagos set factura_id = v_factura where id = any(p_pagos);

  return v_factura;
end;
$$;

-- Solo usuarios con sesión (Supabase da EXECUTE a anon por defecto, ver 0003).
revoke all on function public.crear_factura(uuid, date, text, text, date, uuid[]) from public, anon;
grant execute on function public.crear_factura(uuid, date, text, text, date, uuid[]) to authenticated;
