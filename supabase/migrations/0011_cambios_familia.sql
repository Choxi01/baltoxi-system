-- =====================================================================
-- 0011_cambios_familia.sql — Marca "Actualizado por la familia" (tarea A8a)
-- Cuando la familia cambia datos desde la ficha online (/ficha/<token>), se
-- guarda cuándo, para que el expediente lo avise hasta que la profesional toque
-- "Visto" (vuelve a NULL). El detalle del cambio queda en `auditoria`
-- (con user_id NULL: lo hizo la ficha pública, no una profesional).
-- =====================================================================

alter table public.tutores add column cambios_familia_en timestamptz;
alter table public.pacientes add column cambios_familia_en timestamptz;

comment on column public.tutores.cambios_familia_en is
  'Última vez que la familia cambió algo desde la ficha online; NULL = la profesional ya lo vio.';
comment on column public.pacientes.cambios_familia_en is
  'Última vez que la familia cambió algo desde la ficha online; NULL = la profesional ya lo vio.';
