-- =====================================================================
-- 0015_feriados_automaticos.sql — La app carga sola los feriados del año
-- Al abrir Agenda u Hoy, el servidor carga los feriados de ley del año actual
-- y del siguiente (src/lib/agenda/feriados*.ts) y anota hasta qué año lo hizo.
-- La marca evita volver a cargar un año: si la profesional borra un feriado
-- porque se trasladó por decreto, no reaparece.
-- null = todavía no se cargó ningún año.
-- =====================================================================

alter table public.consultorios
  add column feriados_cargados_hasta smallint
  check (feriados_cargados_hasta between 2000 and 2200);

comment on column public.consultorios.feriados_cargados_hasta is
  'Último año cuyos feriados de ley ya cargó la app sola (ver src/lib/agenda/feriados-servidor.ts).';
