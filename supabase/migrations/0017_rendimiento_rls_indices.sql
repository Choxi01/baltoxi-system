-- 0017: arreglos de rendimiento que marca el asesor de Supabase.
-- No cambia qué puede ver o hacer cada usuario.

-- 1) miembro_ver: con (select ...) Postgres calcula el usuario y la verificación
--    UNA vez por consulta en vez de una vez por fila. Mismo permiso que antes.
alter policy miembro_ver on public.miembros
  using (user_id = (select auth.uid()) and (select public.sesion_verificada()));

-- 2) Índices para las foreign keys sin índice (mismas columnas, mismo orden).
--    Las FK de una sola columna consultorio_id en anamnesis, documentos, notas,
--    paciente_tutores y reglamento_firmas quedan cubiertas por los índices
--    compuestos que empiezan con consultorio_id, así que no llevan uno propio.
create index if not exists anamnesis_consultorio_paciente on public.anamnesis (consultorio_id, paciente_id);
create index if not exists anamnesis_consultorio_plantilla on public.anamnesis (consultorio_id, plantilla_id);
create index if not exists bloqueos_consultorio on public.bloqueos (consultorio_id);
create index if not exists cargos_consultorio_paciente on public.cargos (consultorio_id, paciente_id);
create index if not exists cargos_consultorio_turno on public.cargos (consultorio_id, turno_id);
create index if not exists documentos_consultorio_paciente on public.documentos (consultorio_id, paciente_id);
create index if not exists documentos_consultorio_tutor on public.documentos (consultorio_id, tutor_id);
create index if not exists facturas_consultorio_tutor on public.facturas (consultorio_id, tutor_id);
create index if not exists horarios_atencion_consultorio on public.horarios_atencion (consultorio_id);
create index if not exists mensajes_enviados_consultorio_tutor on public.mensajes_enviados (consultorio_id, tutor_id);
create index if not exists miembros_user on public.miembros (user_id);
create index if not exists notas_consultorio_paciente on public.notas (consultorio_id, paciente_id);
create index if not exists notas_consultorio_turno on public.notas (consultorio_id, turno_id);
create index if not exists paciente_tutores_consultorio_paciente on public.paciente_tutores (consultorio_id, paciente_id);
create index if not exists paciente_tutores_consultorio_tutor on public.paciente_tutores (consultorio_id, tutor_id);
create index if not exists pacientes_consultorio_responsable_pago on public.pacientes (consultorio_id, responsable_pago_id);
create index if not exists pacientes_consultorio_tarifa on public.pacientes (consultorio_id, tarifa_id);
create index if not exists pagos_consultorio_factura on public.pagos (consultorio_id, factura_id);
create index if not exists reglamento_firmas_consultorio_tutor on public.reglamento_firmas (consultorio_id, tutor_id);
create index if not exists reglas_cobro_consultorio_paciente on public.reglas_cobro (consultorio_id, paciente_id);
create index if not exists series_turnos_consultorio_paciente on public.series_turnos (consultorio_id, paciente_id);
create index if not exists series_turnos_consultorio_tipo_turno on public.series_turnos (consultorio_id, tipo_turno_id);
create index if not exists sesiones_confianza_dispositivo on public.sesiones_confianza (dispositivo_id);
create index if not exists sesiones_confianza_user on public.sesiones_confianza (user_id);
create index if not exists tipos_turno_consultorio_tarifa on public.tipos_turno (consultorio_id, tarifa_id);
create index if not exists turnos_consultorio_paciente on public.turnos (consultorio_id, paciente_id);
create index if not exists turnos_consultorio_serie on public.turnos (consultorio_id, serie_id);
create index if not exists turnos_consultorio_tipo_turno on public.turnos (consultorio_id, tipo_turno_id);
create index if not exists turnos_repone_a on public.turnos (repone_a);
create index if not exists turnos_reprogramado_a on public.turnos (reprogramado_a);
