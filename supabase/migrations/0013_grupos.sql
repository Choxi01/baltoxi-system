-- =====================================================================
-- 0013_grupos.sql — Sesiones dobles y grupales (tarea A11a)
-- Pedido 2 de docs/pedidos-daniela-2026-11.md, con las respuestas de Daniela:
-- hasta 4 chicos, duran lo mismo que una individual y cada familia paga una
-- sesión entera. Modelo: UN TURNO POR CHICO, unidos por `grupo_id`; así la
-- asistencia y el cargo siguen siendo por paciente (el motor de cobro no cambia).
-- 1) tipos_turno.cupo: cuántos chicos por sesión (1 individual, 2 doble, 3 o 4 grupal).
-- 2) turnos.grupo_id y series_turnos.grupo_id: los turnos (o turnos fijos) de la
--    misma sesión comparten el mismo uuid. NULL = sesión individual.
-- Las tablas ya tienen RLS por consultorio: las columnas nuevas quedan cubiertas.
-- =====================================================================

alter table public.tipos_turno
  add column cupo smallint not null default 1 check (cupo between 1 and 4);

alter table public.turnos add column grupo_id uuid;
alter table public.series_turnos add column grupo_id uuid;

create index turnos_grupo on public.turnos (consultorio_id, grupo_id) where grupo_id is not null;
create index series_turnos_grupo on public.series_turnos (consultorio_id, grupo_id) where grupo_id is not null;
