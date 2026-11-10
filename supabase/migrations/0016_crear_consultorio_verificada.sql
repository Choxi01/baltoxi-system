-- =====================================================================
-- 0016_crear_consultorio_verificada.sql — Crear consultorio solo con sesión verificada
-- Antes alcanzaba con estar logueado. Una sesión sin código (o con una marca de
-- confianza que la base ya no reconoce) no ve sus consultorios, la app creía que
-- no tenía ninguno y llegó a crear un segundo consultorio vacío (10/11/2026).
-- Ahora exige lo mismo que para ver datos: public.sesion_verificada() (0006).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.crear_consultorio(p_nombre text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión'; end if;
  if not public.sesion_verificada() then raise exception 'Falta el código del Autenticador'; end if;
  insert into public.consultorios (nombre) values (p_nombre) returning id into v_id;
  insert into public.miembros (consultorio_id, user_id) values (v_id, auth.uid());

  insert into public.reglas_cobro (consultorio_id, estado, porcentaje) values
    (v_id, 'presente', 100), (v_id, 'ausente_con_aviso', 0), (v_id, 'aviso_tardio', 100),
    (v_id, 'ausente_sin_aviso', 100), (v_id, 'cancelado_profesional', 0), (v_id, 'reprogramado', 0);

  insert into public.tarifas (consultorio_id, nombre, monto_gs) values
    (v_id, 'Regular', 0), (v_id, 'Económica', 0), (v_id, 'Domicilio', 0),
    (v_id, 'Evaluación', 0), (v_id, 'Colegio', 0);

  insert into public.tipos_turno (consultorio_id, nombre, modalidad, tarifa_id, cobra_en_el_momento, requiere_paciente, genera_cobro)
  select v_id, x.nombre, x.modalidad, t.id, x.momento, x.req, x.cobra
  from (values
    ('Sesión',                 'consultorio', null,         false, true,  true),
    ('Sesión a domicilio',     'domicilio',   'Domicilio',  false, true,  true),
    ('Sesión online',          'online',      null,         false, true,  true),
    ('Evaluación',             'consultorio', 'Evaluación', false, true,  true),
    ('Entrevista y anamnesis', 'consultorio', 'Evaluación', true,  true,  true),
    ('Visita al colegio',      'colegio',     'Colegio',    false, true,  true),
    ('Reunión de equipo',      'online',      null,         false, false, false)
  ) as x(nombre, modalidad, tarifa, momento, req, cobra)
  left join public.tarifas t on t.consultorio_id = v_id and t.nombre = x.tarifa;

  insert into public.plantillas_mensaje (consultorio_id, clave, texto) values
    (v_id, 'recordatorio_sesion', 'Hola {tutor}, te recuerdo la sesión de {paciente} {cuando} a las {hora}. ¡Nos vemos!'),
    (v_id, 'monto_periodo', 'Hola {tutor}, ¿cómo estás? Te paso el monto de las sesiones de {periodo}: {total}. {datos_pago}. ¡Gracias!'),
    (v_id, 'recordatorio_pago', 'Hola {tutor}, ¿cómo estás? Te recuerdo que quedó pendiente el pago de {periodo}: {total}. {datos_pago}. ¡Gracias!'),
    (v_id, 'horarios_libres', E'Horarios disponibles {rango}:\n{libres}'),
    (v_id, 'cambio_turno', 'Hola {tutor}, te confirmo el cambio: la sesión de {paciente} pasa al {dia} a las {hora}.'),
    (v_id, 'cancelacion_turno', 'Hola {tutor}, te aviso que la sesión de {paciente} del {dia} a las {hora} queda cancelada.'),
    (v_id, 'bienvenida', 'Hola {tutor}, ¿cómo estás? Desde ahora organizo los turnos y pagos con un sistema, y algunos mensajes (como los recordatorios) te van a llegar automáticamente. Te pido que completes o actualices los datos de {paciente} y leas el reglamento en este link: {link_ficha}. ¡Gracias!');

  insert into public.horarios_atencion (consultorio_id, dia_semana, desde, hasta)
  select v_id, d, h.desde, h.hasta
  from generate_series(1, 5) d,
       (values (time '09:00', time '11:15'), (time '13:30', time '17:15')) as h(desde, hasta);

  return v_id;
end;
$function$

;
