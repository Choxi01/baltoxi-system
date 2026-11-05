-- =====================================================================
-- 0009_tipos_turno_color.sql — Color por tipo de turno (tarea A12b)
-- Pedido 5 de docs/pedidos-daniela-2026-11.md: en la agenda, cada turno se pinta
-- del color de su tipo; la asistencia se ve con el borde y un ícono.
-- 1) Columna `color` con una paleta fija (la misma que COLORES_TIPO en
--    src/lib/agenda/colores.ts: si se agrega un color, cambiar los dos lugares).
-- 2) Al crear un tipo sin color (ej. los que crea crear_consultorio), un trigger
--    le pone el primer color de la paleta que no usa otro tipo del consultorio.
-- 3) Los tipos que ya existen reciben un color cada uno, en orden de nombre.
-- La columna queda NULL-able: la app pinta NULL con el color por defecto.
-- =====================================================================

alter table public.tipos_turno
  add column color text
  check (color in ('cielo', 'durazno', 'lavanda', 'arena', 'turquesa', 'rosa', 'oliva', 'pizarra'));

create or replace function public.color_tipo_turno()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  paleta constant text[] := array['cielo', 'durazno', 'lavanda', 'arena', 'turquesa', 'rosa', 'oliva', 'pizarra'];
  libre text;
  cantidad integer;
begin
  if new.color is not null then
    return new;
  end if;
  -- Ve también los tipos que el mismo insert ya agregó (crear_consultorio agrega varios juntos).
  select p.c into libre
  from unnest(paleta) with ordinality as p(c, orden)
  where not exists (
    select 1 from public.tipos_turno t
    where t.consultorio_id = new.consultorio_id and t.color = p.c
  )
  order by p.orden
  limit 1;
  if libre is null then
    select count(*) into cantidad from public.tipos_turno where consultorio_id = new.consultorio_id;
    libre := paleta[1 + cantidad % array_length(paleta, 1)];
  end if;
  new.color := libre;
  return new;
end;
$$;

-- Solo la usa el trigger (igual que registrar_auditoria en 0003).
revoke execute on function public.color_tipo_turno() from public, anon, authenticated;

create trigger tipos_turno_color
  before insert on public.tipos_turno
  for each row execute function public.color_tipo_turno();

-- Tipos que ya existen: un color cada uno, en orden de nombre, dentro de cada consultorio.
update public.tipos_turno t
set color = (array['cielo', 'durazno', 'lavanda', 'arena', 'turquesa', 'rosa', 'oliva', 'pizarra'])[1 + (x.n - 1) % 8]
from (
  select id, row_number() over (partition by consultorio_id order by nombre, id) as n
  from public.tipos_turno
) x
where x.id = t.id and t.color is null;
