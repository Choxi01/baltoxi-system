-- =====================================================================
-- 0001_inicial.sql — Agenda interna, expediente y cobros
-- Herramienta de uso interno de la profesional. Multi-consultorio: TODAS
-- las tablas de datos llevan consultorio_id y Row Level Security (RLS).
-- Un usuario solo ve los consultorios donde figura en `miembros`.
-- La única página pública es la ficha de la familia (/ficha/<token>):
-- corre en el servidor con la service role y valida el token.
-- Montos: SIEMPRE enteros en guaraníes (bigint). Nunca decimales.
-- Una migración aplicada NUNCA se edita: los cambios van en otro archivo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Consultorio y miembros
-- ---------------------------------------------------------------------
create table public.consultorios (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,           -- como aparece en mensajes
  profesional            text,                    -- ej. Lic. ... (fonoaudióloga)
  ruc                    text,
  dv                     text,
  razon_social           text,
  direccion              text,
  telefono_wa            text,
  datos_pago             text,                    -- ej. "Alias 820518"
  horas_aviso_minimas    integer not null default 48 check (horas_aviso_minimas >= 0),
  duracion_bloque_min    integer not null default 45 check (duracion_bloque_min > 0),
  traslado_domicilio_min integer not null default 30 check (traslado_domicilio_min >= 0),
  dia_limite_pago        integer not null default 10 check (dia_limite_pago between 1 and 28),
  concepto_factura       text not null default 'Servicios de fonoaudiología',
  reglamento_texto       text,
  reglamento_version     integer not null default 1,
  zona_horaria           text not null default 'America/Asuncion',
  creado_en              timestamptz not null default now()
);

create table public.miembros (
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  rol            text not null default 'duenio' check (rol in ('duenio')),
  creado_en      timestamptz not null default now(),
  primary key (consultorio_id, user_id)
);

create or replace function public.mis_consultorios()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select consultorio_id from public.miembros where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Tutores (madre, padre, abuela...) y pacientes
-- ---------------------------------------------------------------------
create table public.tutores (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  nombre         text not null,
  apellido       text,
  telefono_wa    text,              -- internacional sin +, ej. 595981123456
  email          text,
  doc_tipo       text check (doc_tipo in ('RUC', 'CI')),
  doc_numero     text,
  dv             text,
  razon_social   text,              -- para la factura; si falta, nombre y apellido
  token_ficha    uuid not null default gen_random_uuid() unique,  -- link de la ficha online
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  unique (consultorio_id, id)
);

create table public.tarifas (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  nombre         text not null,     -- Regular, Económica, Domicilio, Evaluación, Colegio
  monto_gs       bigint not null check (monto_gs >= 0),  -- IVA incluido
  activa         boolean not null default true,
  creado_en      timestamptz not null default now(),
  unique (consultorio_id, id)
);

create table public.pacientes (
  id                  uuid primary key default gen_random_uuid(),
  consultorio_id      uuid not null references public.consultorios(id) on delete cascade,
  nombre              text not null,
  apellido            text,
  fecha_nacimiento    date,
  colegio             text,
  derivado_por        text,          -- médico, colegio, otro profesional
  motivo_consulta     text,          -- DATO CLÍNICO: nunca en mensajes ni facturas
  estado              text not null default 'activo' check (estado in ('activo', 'pausa', 'alta')),
  responsable_pago_id uuid,
  tarifa_id           uuid,          -- tarifa habitual de sus sesiones
  monto_override_gs   bigint check (monto_override_gs >= 0),
  plan_cobro          text not null default 'mensual'
                      check (plan_cobro in ('por_sesion', 'semanal', 'mensual')),
  creado_en           timestamptz not null default now(),
  unique (consultorio_id, id),
  foreign key (consultorio_id, responsable_pago_id) references public.tutores (consultorio_id, id),
  foreign key (consultorio_id, tarifa_id) references public.tarifas (consultorio_id, id)
);

create table public.paciente_tutores (
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  paciente_id    uuid not null,
  tutor_id       uuid not null,
  parentesco     text not null,     -- madre, padre, abuela, tutor legal...
  primary key (paciente_id, tutor_id),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------
create table public.horarios_atencion (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  dia_semana     smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo
  desde          time not null,
  hasta          time not null,
  check (hasta > desde)
);

create table public.tipos_turno (
  id                  uuid primary key default gen_random_uuid(),
  consultorio_id      uuid not null references public.consultorios(id) on delete cascade,
  nombre              text not null,
  modalidad           text not null default 'consultorio'
                      check (modalidad in ('consultorio', 'domicilio', 'online', 'colegio')),
  tarifa_id           uuid,          -- NULL = usa la tarifa del paciente
  cobra_en_el_momento boolean not null default false,  -- entrevista y anamnesis
  requiere_paciente   boolean not null default true,   -- false: reunión de equipo
  genera_cobro        boolean not null default true,
  activo              boolean not null default true,
  unique (consultorio_id, id),
  foreign key (consultorio_id, tarifa_id) references public.tarifas (consultorio_id, id)
);

-- Feriados y vacaciones: días sin agenda.
create table public.bloqueos (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  desde          date not null,
  hasta          date not null,
  motivo         text,
  check (hasta >= desde)
);

create table public.series_turnos (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  paciente_id    uuid not null,
  tipo_turno_id  uuid not null,
  dia_semana     smallint not null check (dia_semana between 0 and 6),
  hora           time not null,
  duracion_min   integer not null default 45 check (duracion_min > 0),
  desde          date not null,
  hasta          date,
  estado         text not null default 'activa' check (estado in ('activa', 'finalizada')),
  creado_en      timestamptz not null default now(),
  unique (consultorio_id, id),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  foreign key (consultorio_id, tipo_turno_id) references public.tipos_turno (consultorio_id, id),
  check (hasta is null or hasta >= desde)
);

-- Un bloque ocupado de la agenda.
--   clase 'turno'     -> paciente con ficha (genera cobro al marcar estado)
--   clase 'reservado' -> "Reservado para Fulano" (alguien sin ficha todavía)
--   clase 'ocupado'   -> reunión, trámite, colegio sin paciente, etc.
-- Se permiten superposiciones (a veces atiende a dos a la vez): la app avisa.
create table public.turnos (
  id                uuid primary key default gen_random_uuid(),
  consultorio_id    uuid not null references public.consultorios(id) on delete cascade,
  clase             text not null default 'turno' check (clase in ('turno', 'reservado', 'ocupado')),
  paciente_id       uuid,
  nombre_reserva    text,
  motivo_ocupado    text,
  tipo_turno_id     uuid,
  serie_id          uuid,
  inicio            timestamptz not null,
  fin               timestamptz not null,
  estado            text not null default 'agendado' check (estado in (
                      'agendado', 'presente', 'ausente_con_aviso', 'aviso_tardio',
                      'ausente_sin_aviso', 'cancelado_profesional', 'reprogramado')),
  aviso_en          timestamptz,     -- cuándo avisó la familia
  porcentaje_manual integer check (porcentaje_manual between 0 and 100),  -- excepción "a criterio"
  motivo_excepcion  text,
  reponer           boolean not null default false,  -- canceló la profesional: falta reponer
  repone_a          uuid references public.turnos(id),  -- este turno repone a otro
  reprogramado_a    uuid references public.turnos(id),
  marcado_en        timestamptz,
  creado_en         timestamptz not null default now(),
  unique (consultorio_id, id),
  unique (serie_id, inicio),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  foreign key (consultorio_id, tipo_turno_id) references public.tipos_turno (consultorio_id, id),
  foreign key (consultorio_id, serie_id) references public.series_turnos (consultorio_id, id) on delete set null (serie_id),
  check (fin > inicio),
  check (clase <> 'turno' or paciente_id is not null),
  check (clase <> 'reservado' or nombre_reserva is not null),
  check (porcentaje_manual is null or motivo_excepcion is not null)
);
create index turnos_consultorio_inicio on public.turnos (consultorio_id, inicio);

-- ---------------------------------------------------------------------
-- Expediente clínico (DATOS SENSIBLES)
-- ---------------------------------------------------------------------
create table public.notas (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  paciente_id    uuid not null,
  turno_id       uuid,
  fecha          date not null default current_date,
  texto          text not null,
  fijada         boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  foreign key (consultorio_id, turno_id) references public.turnos (consultorio_id, id) on delete set null (turno_id)
);

-- Plantilla de anamnesis en JSON:
-- {"secciones":[{"titulo":"...","campos":[{"id":"...","etiqueta":"...",
--   "tipo":"texto|largo|si_no|opciones|fecha","opciones":["..."]}]}]}
create table public.plantillas_anamnesis (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  nombre         text not null,
  estructura     jsonb not null,
  activa         boolean not null default true,
  unique (consultorio_id, id)
);

create table public.anamnesis (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  paciente_id    uuid not null,
  plantilla_id   uuid not null,
  estructura     jsonb not null,   -- copia de la plantilla usada (por si la plantilla cambia)
  respuestas     jsonb not null default '{}'::jsonb,   -- {campo_id: valor}
  fecha          date not null default current_date,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  foreign key (consultorio_id, plantilla_id) references public.plantillas_anamnesis (consultorio_id, id)
);

-- Archivos en el bucket privado `documentos` (ver 0002).
-- storage_path = <consultorio_id>/<paciente_id o tutor_id>/<uuid>.<ext>
create table public.documentos (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  paciente_id    uuid,
  tutor_id       uuid,
  tipo           text not null check (tipo in ('cedula', 'analisis', 'informe', 'certificado', 'otro')),
  titulo         text not null,
  fecha          date,
  storage_path   text not null unique,
  mime           text not null,
  tamano_bytes   bigint not null check (tamano_bytes > 0),
  creado_en      timestamptz not null default now(),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id) on delete cascade,
  check (paciente_id is not null or tutor_id is not null),
  check (storage_path like consultorio_id::text || '/%')
);

-- Firmas del reglamento desde la ficha online.
create table public.reglamento_firmas (
  id              uuid primary key default gen_random_uuid(),
  consultorio_id  uuid not null references public.consultorios(id) on delete cascade,
  tutor_id        uuid not null,
  version         integer not null,
  texto_firmado   text not null,   -- copia exacta de lo que aceptó
  nombre_firmante text not null,
  doc_firmante    text not null,
  aceptado_en     timestamptz not null default now(),
  ip_hash         text,
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Cobros
-- ---------------------------------------------------------------------
create table public.reglas_cobro (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  estado         text not null check (estado in (
                   'presente', 'ausente_con_aviso', 'aviso_tardio',
                   'ausente_sin_aviso', 'cancelado_profesional', 'reprogramado')),
  porcentaje     integer not null check (porcentaje between 0 and 100),
  paciente_id    uuid,
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id) on delete cascade,
  unique nulls not distinct (consultorio_id, estado, paciente_id)
);

create table public.cierres (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  periodo        date not null check (extract(day from periodo) = 1),
  estado         text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  cerrado_en     timestamptz,
  unique (consultorio_id, periodo)
);

create table public.cargos (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  tutor_id       uuid not null,     -- responsable de pago
  paciente_id    uuid,
  turno_id       uuid unique,
  tipo           text not null check (tipo in ('sesion', 'ajuste')),
  fecha          date not null,     -- fecha de la sesión (para semanas y meses)
  periodo        date not null check (extract(day from periodo) = 1),  -- mes de servicio
  concepto       text not null,
  monto_gs       bigint not null,
  snapshot       jsonb not null default '{}'::jsonb,
  motivo         text,
  creado_en      timestamptz not null default now(),
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id),
  foreign key (consultorio_id, paciente_id) references public.pacientes (consultorio_id, id),
  foreign key (consultorio_id, turno_id) references public.turnos (consultorio_id, id),
  check (tipo = 'ajuste' or monto_gs >= 0),
  check (tipo <> 'ajuste' or motivo is not null),
  check (date_trunc('month', fecha)::date = periodo)
);
create index cargos_tutor on public.cargos (consultorio_id, tutor_id, fecha);

-- Una factura por familia por mes, sobre lo cobrado en ese mes.
create table public.facturas (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  tutor_id       uuid not null,
  mes_cobro      date not null check (extract(day from mes_cobro) = 1),
  monto_gs       bigint not null check (monto_gs > 0),
  concepto       text not null,
  numero         text not null,     -- ej. 001-001-0000123
  emitida_en     date not null default current_date,
  creado_en      timestamptz not null default now(),
  unique (consultorio_id, id),
  unique (consultorio_id, tutor_id, mes_cobro),
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id)
);

create table public.pagos (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  tutor_id       uuid not null,
  fecha          date not null default current_date,
  monto_gs       bigint not null check (monto_gs > 0),
  medio          text not null check (medio in ('efectivo', 'transferencia', 'qr', 'tarjeta', 'otro')),
  referencia     text,
  factura_id     uuid,
  creado_en      timestamptz not null default now(),
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id),
  foreign key (consultorio_id, factura_id) references public.facturas (consultorio_id, id) on delete set null (factura_id)
);
create index pagos_tutor on public.pagos (consultorio_id, tutor_id, fecha);

-- ---------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------
create table public.plantillas_mensaje (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  clave          text not null check (clave in (
                   'recordatorio_sesion', 'monto_periodo', 'recordatorio_pago',
                   'horarios_libres', 'cambio_turno', 'cancelacion_turno', 'bienvenida')),
  texto          text not null,
  unique (consultorio_id, clave)
);

-- Lo que ya se mandó (para tachar en "Mensajes de hoy" y no repetir).
create table public.mensajes_enviados (
  id             uuid primary key default gen_random_uuid(),
  consultorio_id uuid not null references public.consultorios(id) on delete cascade,
  tutor_id       uuid,
  clave          text not null,
  referencia     text not null,     -- id del turno, 'YYYY-MM' o 'YYYY-Www'
  canal          text not null check (canal in ('copiado', 'whatsapp_link', 'automatico')),
  enviado_en     timestamptz not null default now(),
  unique nulls not distinct (consultorio_id, clave, referencia, tutor_id),
  foreign key (consultorio_id, tutor_id) references public.tutores (consultorio_id, id) on delete cascade
);

-- Límite de intentos en la ficha pública. SIN políticas: solo el servidor.
create table public.intentos_publicos (
  id    bigint generated always as identity primary key,
  clave text not null,
  en    timestamptz not null default now()
);
create index intentos_publicos_clave on public.intentos_publicos (clave, en);

-- ---------------------------------------------------------------------
-- Meses cerrados: los cargos no se pueden tocar.
-- ---------------------------------------------------------------------
create or replace function public.bloquear_periodo_cerrado()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
       select 1 from public.cierres
       where consultorio_id = old.consultorio_id and periodo = old.periodo and estado = 'cerrado') then
    raise exception 'El período % está cerrado', to_char(old.periodo, 'MM/YYYY');
  end if;
  if tg_op in ('INSERT', 'UPDATE') and exists (
       select 1 from public.cierres
       where consultorio_id = new.consultorio_id and periodo = new.periodo and estado = 'cerrado') then
    raise exception 'El período % está cerrado', to_char(new.periodo, 'MM/YYYY');
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger cargos_periodo_cerrado
before insert or update or delete on public.cargos
for each row execute function public.bloquear_periodo_cerrado();

-- ---------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------
create table public.auditoria (
  id             bigint generated always as identity primary key,
  consultorio_id uuid not null,
  user_id        uuid,
  tabla          text not null,
  registro_id    text,
  accion         text not null,
  antes          jsonb,
  despues        jsonb,
  en             timestamptz not null default now()
);
create index auditoria_consultorio on public.auditoria (consultorio_id, en desc);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.auditoria (consultorio_id, user_id, tabla, registro_id, accion, antes, despues)
  values ((fila->>'consultorio_id')::uuid, auth.uid(), tg_table_name,
          coalesce(fila->>'id', fila->>'paciente_id'), tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['tutores', 'pacientes', 'turnos', 'notas', 'anamnesis', 'documentos',
                           'cargos', 'pagos', 'facturas', 'cierres', 'reglamento_firmas']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.registrar_auditoria()', 'aud_' || t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Vista de saldos por responsable de pago (respeta RLS)
-- ---------------------------------------------------------------------
create view public.saldos_tutores
with (security_invoker = true) as
select t.consultorio_id,
       t.id as tutor_id,
       trim(t.nombre || ' ' || coalesce(t.apellido, '')) as nombre,
       coalesce(c.total, 0) as total_cargos_gs,
       coalesce(p.total, 0) as total_pagos_gs,
       coalesce(c.total, 0) - coalesce(p.total, 0) as saldo_gs   -- > 0 debe; < 0 a favor
from public.tutores t
left join (select tutor_id, sum(monto_gs) as total from public.cargos group by 1) c on c.tutor_id = t.id
left join (select tutor_id, sum(monto_gs) as total from public.pagos group by 1) p on p.tutor_id = t.id;

-- ---------------------------------------------------------------------
-- Alta de consultorio con valores por defecto
-- ---------------------------------------------------------------------
create or replace function public.crear_consultorio(p_nombre text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión'; end if;
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
    (v_id, 'recordatorio_sesion', 'Hola {tutor}, te recuerdo la sesión de {paciente} mañana {dia} a las {hora}. ¡Nos vemos!'),
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
$$;

revoke all on function public.crear_consultorio(text) from public;
grant execute on function public.crear_consultorio(text) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['consultorios', 'miembros', 'tutores', 'tarifas', 'pacientes', 'paciente_tutores',
                           'horarios_atencion', 'tipos_turno', 'bloqueos', 'series_turnos', 'turnos',
                           'notas', 'plantillas_anamnesis', 'anamnesis', 'documentos', 'reglamento_firmas',
                           'reglas_cobro', 'cierres', 'cargos', 'facturas', 'pagos',
                           'plantillas_mensaje', 'mensajes_enviados', 'intentos_publicos', 'auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy consultorio_ver on public.consultorios
  for select to authenticated using (id in (select public.mis_consultorios()));
create policy consultorio_editar on public.consultorios
  for update to authenticated
  using (id in (select public.mis_consultorios()))
  with check (id in (select public.mis_consultorios()));

create policy miembro_ver on public.miembros
  for select to authenticated using (user_id = auth.uid());

create policy auditoria_ver on public.auditoria
  for select to authenticated using (consultorio_id in (select public.mis_consultorios()));

-- Firmas: la profesional las lee; solo el servidor (ficha pública) las crea.
create policy firmas_ver on public.reglamento_firmas
  for select to authenticated using (consultorio_id in (select public.mis_consultorios()));

do $$
declare t text;
begin
  foreach t in array array['tutores', 'tarifas', 'pacientes', 'paciente_tutores', 'horarios_atencion',
                           'tipos_turno', 'bloqueos', 'series_turnos', 'turnos', 'notas',
                           'plantillas_anamnesis', 'anamnesis', 'documentos', 'reglas_cobro',
                           'cierres', 'cargos', 'facturas', 'pagos', 'plantillas_mensaje',
                           'mensajes_enviados']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (consultorio_id in (select public.mis_consultorios()))
         with check (consultorio_id in (select public.mis_consultorios()))',
      t || '_del_consultorio', t);
  end loop;
end $$;
