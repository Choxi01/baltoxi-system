-- =====================================================================
-- seed.sql — DATOS DE PRUEBA INVENTADOS (tarea 0.4)
-- Solo para el proyecto `pruebas`. NUNCA en producción.
--
-- Llena el PRIMER consultorio de la base (el que creaste al ingresar) con:
-- 12 tutores (3 con dos hijos), 15 pacientes, turnos fijos que dan 25
-- sesiones por semana, las últimas 4 semanas con estados variados, las
-- próximas 4 agendadas, cargos calculados con docs/reglas-cobro.md, pagos
-- (completos, parciales, sin pagar y uno con saldo a favor), 2 notas y 1
-- anamnesis. Las fechas salen del día en que se carga.
--
-- Se puede cargar varias veces: primero BORRA los pacientes, tutores,
-- turnos, cobros, notas y anamnesis de ese consultorio. Por seguridad, se
-- niega a correr si encuentra tutores que no son de prueba (email que no
-- termina en @ejemplo.test).
--
-- Cómo cargarlo: ver docs/datos-de-prueba.md.
-- =====================================================================

do $$
declare
  c        uuid;
  hoy      date := (now() at time zone 'America/Asuncion')::date;
  lunes    date := hoy - (extract(isodow from hoy)::int - 1);   -- lunes de esta semana
  mes      date := date_trunc('month', hoy)::date;              -- primer día de este mes
  feriado  date := hoy - (extract(isodow from hoy)::int - 1) + 11; -- viernes de la semana que viene
  v_plantilla uuid;
  v_mover  record;
  v_nuevo  uuid;
begin
  select id into c from public.consultorios order by creado_en limit 1;
  if c is null then
    raise notice 'No hay consultorio: primero ingresá a la app y creá el consultorio.';
    return;
  end if;

  if exists (select 1 from public.tutores
             where consultorio_id = c and coalesce(email, '') not like '%@ejemplo.test') then
    raise exception 'Este consultorio tiene tutores que no son de prueba. El seed no se carga.';
  end if;

  -- ---------------------------------------------------------------
  -- 1. Borrar los datos de prueba anteriores (en orden, por las relaciones)
  -- ---------------------------------------------------------------
  delete from public.cierres where consultorio_id = c;          -- antes que cargos (meses cerrados)
  delete from public.mensajes_enviados where consultorio_id = c;
  delete from public.cargos where consultorio_id = c;
  delete from public.pagos where consultorio_id = c;
  delete from public.facturas where consultorio_id = c;
  delete from public.notas where consultorio_id = c;
  delete from public.anamnesis where consultorio_id = c;
  delete from public.plantillas_anamnesis where consultorio_id = c;
  delete from public.documentos where consultorio_id = c;
  delete from public.reglamento_firmas where consultorio_id = c;
  update public.turnos set repone_a = null, reprogramado_a = null where consultorio_id = c;
  delete from public.turnos where consultorio_id = c;
  delete from public.series_turnos where consultorio_id = c;
  delete from public.bloqueos where consultorio_id = c;
  delete from public.reglas_cobro where consultorio_id = c and paciente_id is not null;
  delete from public.paciente_tutores where consultorio_id = c;
  delete from public.pacientes where consultorio_id = c;
  delete from public.tutores where consultorio_id = c;

  -- ---------------------------------------------------------------
  -- 2. Consultorio y tarifas (el nombre del consultorio no se toca)
  -- ---------------------------------------------------------------
  update public.consultorios set
    profesional = 'Lic. Ana Prueba',
    ruc = '80000000', dv = '5', razon_social = 'Ana Prueba',
    direccion = 'Calle Inventada 123, Asunción',
    telefono_wa = '595981000000',
    datos_pago = 'Alias 000000 (dato de prueba)',
    reglamento_texto = 'Reglamento de prueba: avisá las cancelaciones con 24 horas de anticipación. Las sesiones se abonan hasta el día 10 del mes siguiente.',
    reglamento_version = 1,
    horas_aviso_minimas = 24   -- como trabaja la profesional (la base trae 48 por defecto)
  where id = c;

  update public.tarifas t set monto_gs = v.monto
  from (values ('Regular', 290000), ('Económica', 280000), ('Domicilio', 350000),
               ('Evaluación', 280000), ('Colegio', 350000)) v(nombre, monto)
  where t.consultorio_id = c and t.nombre = v.nombre;

  -- ---------------------------------------------------------------
  -- 3. Tutores (12) — nombres, documentos y teléfonos inventados
  -- ---------------------------------------------------------------
  insert into public.tutores (consultorio_id, nombre, apellido, telefono_wa, email, doc_tipo, doc_numero, dv, razon_social)
  select c, v.nombre, v.apellido, '5959810000' || lpad(v.n::text, 2, '0'),
         lower(v.nombre || '.' || v.apellido) || '@ejemplo.test',
         v.doc_tipo, v.doc, v.dv, v.razon
  from (values
    ( 1, 'María',  'Benitez',  'RUC', '1000001', '1', 'María Benitez'),
    ( 2, 'Carlos', 'Gimenez',  'CI',  '1000002', null, null),
    ( 3, 'Laura',  'Ortiz',    'RUC', '1000003', '8', 'Comercial Ortiz S.A. (prueba)'),
    ( 4, 'Ana',    'Duarte',   'CI',  '1000004', null, null),
    ( 5, 'Jorge',  'Rolon',    'RUC', '1000005', '4', 'Jorge Rolon'),
    ( 6, 'Sofia',  'Cabrera',  'CI',  '1000006', null, null),
    ( 7, 'Diego',  'Acosta',   'CI',  '1000007', null, null),
    ( 8, 'Paula',  'Ramirez',  'RUC', '1000008', '9', 'Paula Ramirez'),
    ( 9, 'Lucia',  'Villalba', 'CI',  '1000009', null, null),
    (10, 'Miguel', 'Ayala',    'CI',  '1000010', null, null),
    (11, 'Rosa',   'Franco',   'RUC', '1000011', '9', 'Rosa Franco'),
    (12, 'Andres', 'Nunez',    'CI',  '1000012', null, null)
  ) v(n, nombre, apellido, doc_tipo, doc, dv, razon);

  -- ---------------------------------------------------------------
  -- 4. Pacientes (15) — 3 familias con dos hermanos (tutores 1, 2 y 3)
  -- ---------------------------------------------------------------
  create temp table seed_pac on commit drop as
  select * from (values
    -- n, nombre, apellido, años, meses, colegio, plan, tarifa, precio especial, tutor, parentesco
    ( 1, 'Mateo',     'Benitez',  6, 3, 'Colegio Inventado',   'mensual',    'Regular',   null::bigint, 1, 'madre'),
    ( 2, 'Valentina', 'Benitez',  4, 8, 'Jardín Arcoíris',     'mensual',    'Regular',   null,          1, 'madre'),
    ( 3, 'Thiago',    'Gimenez',  7, 1, 'Escuela de Prueba',   'semanal',    'Regular',   null,          2, 'padre'),
    ( 4, 'Emma',      'Gimenez',  5, 5, 'Escuela de Prueba',   'semanal',    'Regular',   null,          2, 'padre'),
    ( 5, 'Benjamin',  'Ortiz',    8, 0, 'Colegio Inventado',   'mensual',    'Económica', null,          3, 'madre'),
    ( 6, 'Martina',   'Ortiz',    3, 10, null,                 'mensual',    'Económica', null,          3, 'madre'),
    ( 7, 'Lucas',     'Duarte',   5, 2, 'Jardín Arcoíris',     'por_sesion', 'Regular',   null,          4, 'madre'),
    ( 8, 'Sofia',     'Rolon',    9, 6, 'Colegio Inventado',   'mensual',    'Regular',   250000,        5, 'padre'),
    ( 9, 'Joaquin',   'Cabrera',  4, 0, null,                  'semanal',    'Regular',   null,          6, 'madre'),
    (10, 'Isabella',  'Acosta',   6, 9, 'Escuela de Prueba',   'mensual',    'Regular',   null,          7, 'padre'),
    (11, 'Santiago',  'Ramirez', 10, 4, 'Colegio Inventado',   'por_sesion', 'Regular',   null,          8, 'madre'),
    (12, 'Camila',    'Villalba', 7, 7, 'Escuela de Prueba',   'mensual',    'Regular',   null,          9, 'madre'),
    (13, 'Gael',      'Ayala',    3, 2, null,                  'semanal',    'Regular',   null,         10, 'padre'),
    (14, 'Renata',    'Franco',   8, 11, 'Colegio Inventado',  'por_sesion', 'Regular',   null,         11, 'abuela'),
    (15, 'Tomas',     'Nunez',    6, 0, 'Jardín Arcoíris',     'mensual',    'Regular',   null,         12, 'padre')
  ) v(n, nombre, apellido, anios, meses, colegio, plan, tarifa, especial, tutor, parentesco);

  insert into public.pacientes (consultorio_id, nombre, apellido, fecha_nacimiento, colegio, derivado_por,
                                motivo_consulta, responsable_pago_id, tarifa_id, monto_override_gs, plan_cobro)
  select c, p.nombre, p.apellido,
         (hoy - make_interval(years => p.anios, months => p.meses))::date,
         p.colegio, 'Pediatra (dato de prueba)',
         'Dato de prueba: dificultades del lenguaje',
         t.id, ta.id, p.especial, p.plan
  from seed_pac p
  join public.tutores t on t.consultorio_id = c and t.telefono_wa = '5959810000' || lpad(p.tutor::text, 2, '0')
  join public.tarifas ta on ta.consultorio_id = c and ta.nombre = p.tarifa;

  create temp table seed_pid on commit drop as
  select p.n, pa.id as paciente_id, pa.responsable_pago_id as tutor_id
  from seed_pac p
  join public.pacientes pa on pa.consultorio_id = c and pa.nombre = p.nombre and pa.apellido = p.apellido;

  insert into public.paciente_tutores (consultorio_id, paciente_id, tutor_id, parentesco)
  select c, i.paciente_id, i.tutor_id, p.parentesco
  from seed_pid i join seed_pac p using (n);

  -- Excepción por paciente: a Benjamin el aviso tardío se le cobra 50%.
  insert into public.reglas_cobro (consultorio_id, estado, porcentaje, paciente_id)
  select c, 'aviso_tardio', 50, paciente_id from seed_pid where n = 5;

  -- ---------------------------------------------------------------
  -- 5. Turnos fijos: 25 sesiones por semana (bloques de 45 min)
  --    10 pacientes van 2 veces por semana y 5 van 1 vez.
  --    Joaquin (9) tiene sesiones a domicilio.
  -- ---------------------------------------------------------------
  create temp table seed_serie on commit drop as
  select * from (values
    -- paciente, día (1 = lunes), hora, tipo de turno
    ( 1, 1, time '09:00', 'Sesión'), ( 3, 1, '09:45', 'Sesión'), ( 5, 1, '10:30', 'Sesión'),
    ( 7, 1, '13:30', 'Sesión'),      ( 8, 1, '14:15', 'Sesión'),
    ( 2, 2, '09:00', 'Sesión'),      ( 4, 2, '09:45', 'Sesión'), ( 9, 2, '13:30', 'Sesión a domicilio'),
    (10, 2, '14:15', 'Sesión'),      (11, 2, '15:00', 'Sesión'),
    ( 1, 3, '09:00', 'Sesión'),      ( 3, 3, '09:45', 'Sesión'), ( 6, 3, '10:30', 'Sesión'),
    (12, 3, '13:30', 'Sesión'),      (13, 3, '14:15', 'Sesión'),
    ( 2, 4, '09:00', 'Sesión'),      ( 4, 4, '09:45', 'Sesión'), ( 5, 4, '10:30', 'Sesión'),
    ( 9, 4, '13:30', 'Sesión a domicilio'), (14, 4, '15:00', 'Sesión'),
    ( 6, 5, '09:00', 'Sesión'),      ( 8, 5, '09:45', 'Sesión'), (10, 5, '10:30', 'Sesión'),
    (13, 5, '13:30', 'Sesión'),      (15, 5, '14:15', 'Sesión')
  ) v(n, dia, hora, tipo);

  insert into public.series_turnos (consultorio_id, paciente_id, tipo_turno_id, dia_semana, hora, duracion_min, desde)
  select c, i.paciente_id, tt.id, s.dia, s.hora, 45, lunes - 28
  from seed_serie s
  join seed_pid i using (n)
  join public.tipos_turno tt on tt.consultorio_id = c and tt.nombre = s.tipo;

  -- Feriado de prueba: viernes de la semana que viene (sin turnos ese día).
  insert into public.bloqueos (consultorio_id, desde, hasta, motivo)
  values (c, feriado, feriado, 'Feriado de prueba');

  -- Turnos: 4 semanas para atrás y 4 para adelante (8 semanas, como la materialización).
  insert into public.turnos (consultorio_id, clase, paciente_id, tipo_turno_id, serie_id, inicio, fin)
  select c, 'turno', st.paciente_id, st.tipo_turno_id, st.id,
         ((d + st.hora) at time zone 'America/Asuncion'),
         ((d + st.hora) at time zone 'America/Asuncion') + make_interval(mins => st.duracion_min)
  from public.series_turnos st
  cross join lateral (
    select (lunes + (semana * 7) + (st.dia_semana - 1))::date as d
    from generate_series(-4, 3) semana
  ) dias
  where st.consultorio_id = c and d <> feriado;

  -- ---------------------------------------------------------------
  -- 6. Estados de los turnos que ya pasaron (mayoría "vino")
  --    Se elige con un número fijo por turno, así cada carga da lo mismo.
  -- ---------------------------------------------------------------
  update public.turnos t set
    estado = x.estado,
    aviso_en = case x.estado when 'ausente_con_aviso' then t.inicio - interval '72 hours'
                             when 'aviso_tardio' then t.inicio - interval '20 hours' end,
    reponer = (x.estado = 'cancelado_profesional'),
    marcado_en = t.inicio + interval '45 minutes'
  from (
    -- "Azar" fijo: depende del paciente, del día (contado desde este lunes) y la hora.
    select tu.id,
           case abs(hashtext(pa.nombre || pa.apellido
                             || ((tu.inicio at time zone 'America/Asuncion')::date - lunes)::text
                             || ((tu.inicio at time zone 'America/Asuncion')::time)::text)) % 20
             when 0 then 'ausente_con_aviso'
             when 1 then 'aviso_tardio'
             when 2 then 'ausente_sin_aviso'
             when 3 then 'cancelado_profesional'
             else 'presente' end as estado
    from public.turnos tu join public.pacientes pa on pa.id = tu.paciente_id
    where tu.consultorio_id = c and tu.fin < now()
  ) x
  where t.id = x.id;

  -- Que haya al menos uno de cada estado (por si el azar no los dio).
  update public.turnos set estado = v.estado,
         aviso_en = case v.estado when 'ausente_con_aviso' then inicio - interval '72 hours'
                                  when 'aviso_tardio' then inicio - interval '20 hours' end,
         reponer = (v.estado = 'cancelado_profesional')
  from (values (1, 'ausente_con_aviso'), (2, 'aviso_tardio'), (3, 'ausente_sin_aviso'),
               (4, 'cancelado_profesional')) v(orden, estado)
  where id = (select id from public.turnos
              where consultorio_id = c and fin < now() and estado = 'presente'
              order by inicio offset v.orden * 7 limit 1)
    and not exists (select 1 from public.turnos where consultorio_id = c and estado = v.estado);

  -- Una excepción "a criterio": un aviso tardío que no se cobra (0%, con motivo).
  update public.turnos set porcentaje_manual = 0, motivo_excepcion = 'Enfermedad con certificado (dato de prueba)'
  where id = (select id from public.turnos where consultorio_id = c and estado = 'aviso_tardio'
              order by inicio limit 1);

  -- Un turno movido: el de Lucas (7) de hace dos lunes pasa al martes 16:30.
  select t.* into v_mover from public.turnos t
  join seed_pid i on i.paciente_id = t.paciente_id and i.n = 7
  where t.consultorio_id = c and (t.inicio at time zone 'America/Asuncion')::date = lunes - 14;
  if found then
    insert into public.turnos (consultorio_id, clase, paciente_id, tipo_turno_id, inicio, fin, estado, marcado_en)
    values (c, 'turno', v_mover.paciente_id, v_mover.tipo_turno_id,
            (((lunes - 13) + time '16:30') at time zone 'America/Asuncion'),
            (((lunes - 13) + time '16:30') at time zone 'America/Asuncion') + interval '45 minutes',
            'presente', (((lunes - 13) + time '17:15') at time zone 'America/Asuncion'))
    returning id into v_nuevo;
    update public.turnos set estado = 'reprogramado', aviso_en = null, reponer = false,
           porcentaje_manual = null, motivo_excepcion = null, reprogramado_a = v_nuevo
    where id = v_mover.id;
  end if;

  -- Otros bloques de la agenda (próxima semana): un reservado y una reunión.
  insert into public.turnos (consultorio_id, clase, nombre_reserva, inicio, fin)
  values (c, 'reservado', 'Fulano de Prueba',
          (((lunes + 9) + time '15:00') at time zone 'America/Asuncion'),
          (((lunes + 9) + time '15:00') at time zone 'America/Asuncion') + interval '45 minutes');
  insert into public.turnos (consultorio_id, clase, motivo_ocupado, tipo_turno_id, inicio, fin)
  select c, 'ocupado', 'Reunión de equipo (prueba)', tt.id,
         (((lunes + 10) + time '16:30') at time zone 'America/Asuncion'),
         (((lunes + 10) + time '16:30') at time zone 'America/Asuncion') + interval '45 minutes'
  from public.tipos_turno tt where tt.consultorio_id = c and tt.nombre = 'Reunión de equipo';

  -- Sesiones dobles y grupales (A11a): un turno por chico, unidos por grupo_id.
  -- Los tipos no se borran al recargar: se crean si faltan y se les pone el cupo.
  insert into public.tipos_turno (consultorio_id, nombre, cupo)
  select c, v.nombre, v.cupo
  from (values ('Sesión doble', 2), ('Sesión grupal', 4)) v(nombre, cupo)
  where not exists (select 1 from public.tipos_turno tt where tt.consultorio_id = c and tt.nombre = v.nombre);
  update public.tipos_turno set cupo = 2 where consultorio_id = c and nombre = 'Sesión doble';
  update public.tipos_turno set cupo = 4 where consultorio_id = c and nombre = 'Sesión grupal';

  -- Doble del jueves pasado a las 14:15 (Lucas vino, el otro no: en la grilla se ve "½").
  -- La próxima semana: una doble el lunes 15:00 y una grupal de 3 el martes 15:45.
  with grupos (dia, hora, tipo, ninos, estados) as (
    values (lunes - 4, time '14:15', 'Sesión doble', array[7, 12], array['presente', 'ausente_sin_aviso']),
           (lunes + 7, time '15:00', 'Sesión doble', array[11, 14], array['agendado', 'agendado']),
           (lunes + 8, time '15:45', 'Sesión grupal', array[1, 7, 15], array['agendado', 'agendado', 'agendado'])
  ), con_id as (
    select g.*, gen_random_uuid() as grupo_id from grupos g
  )
  insert into public.turnos (consultorio_id, clase, paciente_id, tipo_turno_id, grupo_id, inicio, fin, estado, marcado_en)
  select c, 'turno', i.paciente_id, tt.id, g.grupo_id,
         ((g.dia + g.hora) at time zone 'America/Asuncion'),
         ((g.dia + g.hora) at time zone 'America/Asuncion') + interval '45 minutes',
         g.estados[k.orden],
         case when g.estados[k.orden] <> 'agendado' then ((g.dia + g.hora) at time zone 'America/Asuncion') + interval '45 minutes' end
  from con_id g
  cross join lateral unnest(g.ninos) with ordinality k(n, orden)
  join seed_pid i on i.n = k.n
  join public.tipos_turno tt on tt.consultorio_id = c and tt.nombre = g.tipo;

  -- ---------------------------------------------------------------
  -- 7. Cargos de los turnos que ya pasaron (docs/reglas-cobro.md, 2 a 4)
  --    monto base: tarifa del tipo > precio especial > tarifa del paciente
  --    porcentaje: manual > regla del paciente > regla del consultorio
  -- ---------------------------------------------------------------
  insert into public.cargos (consultorio_id, tutor_id, paciente_id, turno_id, tipo, fecha, periodo, concepto, monto_gs, snapshot)
  select c, pa.responsable_pago_id, pa.id, t.id, 'sesion', f.fecha, date_trunc('month', f.fecha)::date,
         tt.nombre || ' ' || to_char(f.fecha, 'DD/MM'),
         round(b.base * r.porcentaje / 100.0)::bigint,
         jsonb_build_object('tarifa', b.tarifa, 'monto_base', b.base, 'estado', t.estado,
                            'porcentaje', r.porcentaje, 'origen_regla', r.origen)
  from public.turnos t
  join public.pacientes pa on pa.id = t.paciente_id
  join public.tipos_turno tt on tt.id = t.tipo_turno_id
  cross join lateral (select (t.inicio at time zone 'America/Asuncion')::date as fecha) f
  cross join lateral (
    select case when tt.tarifa_id is not null then tipo_tar.nombre
                when pa.monto_override_gs is not null then 'Precio especial'
                else pac_tar.nombre end as tarifa,
           case when tt.tarifa_id is not null then tipo_tar.monto_gs
                when pa.monto_override_gs is not null then pa.monto_override_gs
                else pac_tar.monto_gs end as base
    from (select 1) uno
    left join public.tarifas tipo_tar on tipo_tar.id = tt.tarifa_id
    left join public.tarifas pac_tar on pac_tar.id = pa.tarifa_id
  ) b
  cross join lateral (
    select coalesce(t.porcentaje_manual, rp.porcentaje, rc.porcentaje) as porcentaje,
           case when t.porcentaje_manual is not null then 'manual'
                when rp.porcentaje is not null then 'paciente'
                else 'consultorio' end as origen
    from (select 1) uno
    left join public.reglas_cobro rp on rp.consultorio_id = c and rp.paciente_id = pa.id and rp.estado = t.estado
    left join public.reglas_cobro rc on rc.consultorio_id = c and rc.paciente_id is null and rc.estado = t.estado
  ) r
  where t.consultorio_id = c and t.clase = 'turno' and tt.genera_cobro and t.estado <> 'agendado';

  -- ---------------------------------------------------------------
  -- 8. Pagos
  --    Tutores 1, 4, 6, 7, 9, 12: pagaron completo el mes anterior.
  --    Tutor 2 (semanal): pagó todo hasta la semana pasada.
  --    Tutor 3: pagó una parte del mes anterior (pago parcial).
  --    Tutor 5: no pagó nada (queda en atraso).
  --    Tutores 8 y 11 (por sesión): pagaron cada sesión menos la última.
  --    Tutor 10: pagó todo y un poco más (saldo a favor).
  -- ---------------------------------------------------------------
  insert into public.pagos (consultorio_id, tutor_id, fecha, monto_gs, medio, referencia)
  select c, t.id, least(mes + 4, hoy), s.total, 'transferencia', 'Transf. de prueba'
  from public.tutores t
  cross join lateral (select coalesce(sum(monto_gs), 0) as total from public.cargos
                      where tutor_id = t.id and periodo < mes) s
  where t.consultorio_id = c and s.total > 0
    and t.telefono_wa in ('595981000001', '595981000004', '595981000006', '595981000007', '595981000009', '595981000012');

  insert into public.pagos (consultorio_id, tutor_id, fecha, monto_gs, medio, referencia)
  select c, t.id, lunes - 1, s.total, 'efectivo', null
  from public.tutores t
  cross join lateral (select coalesce(sum(monto_gs), 0) as total from public.cargos
                      where tutor_id = t.id and fecha < lunes) s
  where t.consultorio_id = c and t.telefono_wa = '595981000002' and s.total > 0;

  insert into public.pagos (consultorio_id, tutor_id, fecha, monto_gs, medio, referencia)
  select c, t.id, least(mes + 6, hoy), (round(s.total * 0.6 / 10000) * 10000)::bigint, 'transferencia', 'Pago parcial de prueba'
  from public.tutores t
  cross join lateral (select coalesce(sum(monto_gs), 0) as total from public.cargos
                      where tutor_id = t.id and periodo < mes) s
  where t.consultorio_id = c and t.telefono_wa = '595981000003' and s.total >= 20000;

  insert into public.pagos (consultorio_id, tutor_id, fecha, monto_gs, medio, referencia)
  select c, cg.tutor_id, cg.fecha, cg.monto_gs, 'qr', 'QR de prueba'
  from public.cargos cg
  join public.tutores t on t.id = cg.tutor_id
  where cg.consultorio_id = c and cg.monto_gs > 0
    and t.telefono_wa in ('595981000008', '595981000011')
    and cg.fecha < (select max(fecha) from public.cargos x where x.tutor_id = cg.tutor_id and x.monto_gs > 0);

  insert into public.pagos (consultorio_id, tutor_id, fecha, monto_gs, medio, referencia)
  select c, t.id, least(mes + 3, hoy), s.total + 290000, 'transferencia', 'Pago adelantado de prueba'
  from public.tutores t
  cross join lateral (select coalesce(sum(monto_gs), 0) as total from public.cargos where tutor_id = t.id) s
  where t.consultorio_id = c and t.telefono_wa = '595981000010';

  -- ---------------------------------------------------------------
  -- 9. Expediente: 2 notas y 1 anamnesis (todo inventado)
  -- ---------------------------------------------------------------
  insert into public.notas (consultorio_id, paciente_id, fecha, texto, fijada)
  select c, paciente_id, hoy - 7, 'Dato de prueba: practicar en casa los sonidos trabajados en la sesión.', true
  from seed_pid where n = 1;

  insert into public.notas (consultorio_id, paciente_id, turno_id, fecha, texto)
  select c, t.paciente_id, t.id, (t.inicio at time zone 'America/Asuncion')::date,
         'Dato de prueba: buena atención durante la sesión; seguimos con el plan.'
  from public.turnos t join seed_pid i on i.paciente_id = t.paciente_id and i.n = 3
  where t.consultorio_id = c and t.estado = 'presente'
  order by t.inicio desc limit 1;

  insert into public.plantillas_anamnesis (consultorio_id, nombre, estructura)
  values (c, 'Anamnesis de prueba', '{"secciones":[
    {"titulo":"Embarazo y parto","campos":[
      {"id":"embarazo","etiqueta":"¿Cómo fue el embarazo?","tipo":"largo"},
      {"id":"parto_tipo","etiqueta":"Tipo de parto","tipo":"opciones","opciones":["Natural","Cesárea"]},
      {"id":"semanas","etiqueta":"Semanas de gestación","tipo":"texto"}]},
    {"titulo":"Desarrollo","campos":[
      {"id":"primeras_palabras","etiqueta":"Edad de las primeras palabras","tipo":"texto"},
      {"id":"jardin","etiqueta":"¿Va al jardín o escuela?","tipo":"si_no"}]},
    {"titulo":"Entrevista","campos":[
      {"id":"fecha_entrevista","etiqueta":"Fecha de la entrevista","tipo":"fecha"}]}]}'::jsonb)
  returning id into v_plantilla;

  insert into public.anamnesis (consultorio_id, paciente_id, plantilla_id, estructura, respuestas, fecha)
  select c, i.paciente_id, v_plantilla, pl.estructura,
         ('{"embarazo":"Dato de prueba: sin complicaciones.","parto_tipo":"Natural","semanas":"39","primeras_palabras":"14 meses","jardin":true,"fecha_entrevista":"' || (lunes - 28) || '"}')::jsonb,
         lunes - 28
  from seed_pid i, public.plantillas_anamnesis pl
  where i.n = 1 and pl.id = v_plantilla;

  -- La auditoría de esta carga no sirve: se limpia.
  delete from public.auditoria where consultorio_id = c;

  raise notice 'Datos de prueba cargados en el consultorio %.', c;
end $$;
