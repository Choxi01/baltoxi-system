# Agenda interna — especificación

La agenda la maneja solo la profesional. No hay reserva online de las familias.

## Bloques
- El día se arma con `horarios_atencion` (puede ser horario partido) dividido en bloques de
  `consultorios.duracion_bloque_min` (45 min). Un bloque solo existe si entra entero en el tramo.
- Ejemplo (9:00–11:15 y 13:30–17:15, 45 min): 9:00, 9:45, 10:30, 13:30, 14:15, 15:00, 15:45, 16:30.
- Días en `bloqueos` (feriados, vacaciones): sin bloques.
- **Feriados automáticos:** al abrir Agenda u Hoy, la app carga sola los feriados de ley (Ley
  7544/2025) del año actual y del siguiente, con Semana Santa calculada, y anota el último año en
  `consultorios.feriados_cargados_hasta`. Un año ya anotado no se vuelve a cargar: si se borra un
  feriado (traslado por decreto), no reaparece. Los cuatro trasladables (Héroes, Paz del Chaco, Jura,
  Boquerón) van en su fecha original con la nota "puede trasladarse por decreto". Los traslados y
  feriados extra por decreto se cargan a mano. Al cargar, se sacan los turnos fijos de esos días (igual
  que al agregar uno a mano). Código: `src/lib/agenda/feriados.ts` (con tests) y `feriados-servidor.ts`.
- Función pura con tests: `src/lib/agenda/bloquesDelDia(fecha, horarios, duracion, bloqueos)`.

## Estado de cada bloque
Un bloque está **ocupado** si algún turno vivo (no cancelado ni reprogramado) se superpone con él:

| `turnos.clase` | Significado | Se muestra |
|---|---|---|
| `turno` | Paciente con ficha | Nombre + tipo de turno; relleno del color del tipo, estado en el borde (ver "Colores") |
| `reservado` | Alguien sin ficha ("Reservado: Fulano") | Gris con el nombre; botón "Crear ficha" que lo convierte en `turno` |
| `ocupado` | Reunión, trámite, colegio | Gris con el motivo |

Estados que **liberan** el bloque: `ausente_con_aviso`, `aviso_tardio`, `cancelado_profesional`,
`reprogramado` (el turno queda en el historial y en los cobros, pero el horario vuelve a estar libre).
`presente` y `ausente_sin_aviso` no liberan (ya pasó).

Se permiten dos turnos en el mismo bloque: al crear el segundo, pedir confirmación
("Ya hay un turno a esta hora. ¿Agendar igual?").

Domicilios: si dos turnos con modalidad `domicilio` (o uno de domicilio y otro en consultorio) quedan
separados por menos de `traslado_domicilio_min`, mostrar aviso (no bloquear).

## Vistas
- **Semana** (por defecto en todos los dispositivos, pedido de la profesional): grilla lunes a viernes ×
  bloques. Entra en el ancho del iPhone sin deslizar de costado. Tocar un turno o un libre abre ese
  día con esa fila. Al entrar a Agenda desde el menú siempre se abre Semana.
  - **Franja gris** donde el horario tiene un hueco entre dos tramos del mismo día: "Almuerzo" si
    empieza entre las 11:00 y las 15:00; si no, "No disponible". Solo visual: no se reserva ni se toca.
    Si los días tienen almuerzos que se pisan, va una sola franja, pintada solo en esos días. Los
    feriados no la llevan. Función pura con tests: `src/lib/agenda/semana.ts` (`filasSemana`).
- **Día** (botón): lista de bloques del día, libres incluidos, con acciones.
- **Mes**: calendario con la cantidad de libres por día; tocar un día abre la vista Día.
- Navegación: hoy, anterior, siguiente. Colores accesibles y legibles en modo oscuro.

### Colores
- **Relleno = tipo de turno.** Cada tipo tiene un color de una paleta fija de 8 (`tipos_turno.color`,
  migración 0009): cielo, durazno, lavanda, arena, turquesa, rosa, oliva y pizarra. Se elige en
  Configuración > Tipos de turno; a un tipo nuevo se le sugiere uno que no use otro tipo (en la base,
  un trigger hace lo mismo si llega sin color). Sin color, se pinta cielo.
- **Estado = borde + ícono**, nunca solo el color: agendado, borde finito del tono del tipo; vino,
  borde verde grueso y ✓; no vino, borde rojo y ✕; con excepción de cobro, una marca "%". Los
  cancelados y movidos no ocupan la grilla: en la vista Día se ven tachados debajo del horario.
- Reservado y ocupado: gris.
- Leyenda abajo de las vistas Semana y Día: los tipos que aparecen y qué significa cada borde.
- Código: `src/lib/agenda/colores.ts` (`estiloTurno`, `colorSugerido`, `leyendaTipos`, con tests).
  Si se agrega un color, cambiar `COLORES_TIPO` y el check de la migración (con una migración nueva).

## Sesiones dobles y grupales
Pedido 2 de `docs/pedidos-daniela-2026-11.md`. Respuestas de la profesional: hasta 4 chicos, duran lo
mismo que una individual, cada familia paga una sesión entera (no se reparte) y la doble nunca es de
hermanos (son compañeritos, cada uno con su familia y su cobro).
- **Modelo:** un turno por chico, unidos por `turnos.grupo_id` (migración 0013). Cada chico tiene su
  propio estado (vino, no vino, canceló) y su propio cargo: el motor de cobro no cambia.
- **Una sesión** = los turnos con el mismo `grupo_id` **y la misma hora de inicio**: un turno fijo
  grupal usa el mismo `grupo_id` todas las semanas.
- **Tipo de turno:** `tipos_turno.cupo` = chicos por sesión (1 individual, 2 doble, 3 o 4 grupal). Se
  elige en Configuración > Tipos de turno ("Chicos por sesión"). Un tipo sin paciente es siempre de 1.
- **Reservar:** con un tipo de cupo mayor a 1 se eligen entre 2 y `cupo` pacientes distintos, todos con
  ficha ("Agregá otro chico"). Se guardan todos los turnos en un solo insert (o todos o ninguno) con el
  mismo `grupo_id`. Un nombre suelto (sin ficha) o una reposición son siempre individuales.
- **Turno fijo doble o grupal:** igual que Reservar, con 2 a `cupo` chicos. Se crea una serie por chico
  (`series_turnos.grupo_id` igual para todas) y cada turno que se materializa copia el `grupo_id` de su
  serie, así todas las semanas se ven como un solo rectángulo.
- **Grilla (Día y Semana):** los turnos con el mismo `grupo_id`, fecha y hora de inicio son un solo
  rectángulo. El texto depende de cuántos chicos quedan en ese horario (no del cupo): 2 → "Juan + Pedro"
  (nombres de pila; si se llaman igual, con apellido), 3 o 4 → "Grupal · 3". Si queda uno solo (los
  otros cancelaron), se ve como individual. Relleno del color del tipo; borde e ícono: todos vinieron ✓,
  ninguno vino ✕, mezclado (o algunos sin marcar) "½"; "%" si alguno tiene excepción.
- **Al tocarlo:** el panel muestra "Sesión doble" o "Sesión grupal", arriba las acciones de la sesión
  entera y abajo a cada chico con sus acciones de siempre (asistencia, cobrar, ver expediente, nota de
  la sesión).
- **Acciones de la sesión entera** (con 2 o más chicos agendados; `accionesDeLaSesion`):
  - **Mover sesión:** los chicos agendados pasan juntos al horario nuevo (función `mover_grupo`,
    migración 0014): cada original queda reprogramado con su cargo de Gs. 0 y se crea uno nuevo por
    chico, en un grupo nuevo y fuera del turno fijo. Se ofrece el mensaje de cada familia.
  - **Cancelar sesión:** solo "Cancelé yo" (todos quedan en «Para reponer», cada uno con su cargo; si
    algún cargo falla, la sesión entera vuelve a agendado). Si cancela una familia, se cancela solo a
    su chico.
  - **Finalizar turno fijo de la sesión:** terminan las series de todos los chicos.
- **Sacar a un solo chico:** con sus botones de siempre. Mover lo saca de la sesión (el nuevo turno no
  tiene grupo); Cancelar lo cancela solo a él; "Sacar del turno fijo" termina solo su serie. Los demás
  siguen, aunque quede uno solo (entonces se ve como individual).
- **Reportes:** una sesión grupal cuenta una sola vez en las horas trabajadas (persona B,
  `src/lib/cobro/criterios-reportes.ts`).
- Código: `src/lib/agenda/grupos.ts` (`validarGrupo`, `turnosDelGrupo`, `agruparTurnos`, `textoGrupo`,
  `encabezadoGrupo`, `agendadosDeLaSesion`, `accionesDeLaSesion`, `nombresDeLaSesion`), `estiloGrupo` en
  `colores.ts` y los casos `agregar_grupo`, `mover_grupo` y `cancelar_grupo` de `aplicarCambio`, con
  tests. Servidor: `moverGrupo`, `cancelarGrupo` y `finalizarSeriesDelGrupo` en `acciones-turnos.ts`.
- La pantalla Hoy sigue mostrando una tarjeta por chico.

## Acciones
- Bloque libre → **Reservar** (buscar paciente o escribir un nombre suelto; con un tipo doble o grupal,
  varios pacientes), **Marcar ocupado**
  (motivo), **Turno fijo** (crea `series_turnos` y materializa 8 semanas).
- Turno → **Marcar asistencia** (ver reglas-cobro.md), **Mover** (crea turno nuevo y marca el original
  `reprogramado` con `reprogramado_a`; sin costo), **Cancelar** (pide quién canceló y cuándo avisó; si la
  familia avisó tarde, pregunta "¿Se cobra?", ver reglas-cobro.md sección 3),
  **Ver expediente**, **Copiar mensaje** (cambio o cancelación).
- Turno cancelado por la profesional → queda `reponer = true` y aparece en una lista "Para reponer este
  mes" hasta que se agende otro turno con `repone_a`.

### Acciones optimistas (la pantalla cambia al tocar)
- Vino, No vino, Volver a agendado, Quitar excepción, Excepción, Quitar, Cancelar, Mover, Reservar,
  Marcar ocupado y Cobrar ahora se ven **al instante** en la Agenda y en Hoy; el guardado sigue por
  detrás. La tarjeta dice «Guardando…». Los formularios validan antes de cerrarse (mismas funciones
  que el servidor: `validarReserva`, `validarPago`), así los errores de los campos se ven ahí mismo.
- Si el servidor no puede, la tarjeta vuelve sola a como estaba y se muestra el error.
- Reservar una sesión doble o grupal agrega todos los turnos juntos (`agregar_grupo`, armados con
  `turnosNuevosDelGrupo`).
- Cómo: `aplicarCambio` (`src/lib/agenda/optimista.ts`, con tests) copia lo que hace el servidor en
  cada acción; `useTurnosOptimistas` (`src/app/(app)/agenda/turnos-optimistas.ts`) lo aplica con
  `useOptimistic` y vive en la pantalla (el formulario se cierra enseguida).
- **Una acción nueva** sobre un turno: sumá su caso en `aplicarCambio` (con test) y llamala con
  `ejecutar(cambio, () => accion(...), "Aviso ✓")`.
- Mover y Cancelar la sesión doble o grupal entera también son optimistas (`mover_grupo` y
  `cancelar_grupo`).
- Todavía esperan al servidor: crear o finalizar un turno fijo (crean o borran 8 semanas de turnos).
  Registrar un pago desde las pantallas de Cobros también espera (`FormularioPago` sin `enviarOptimista`).
- Reservar: si otro dispositivo agendó en ese horario justo antes, el turno nuevo desaparece y se
  avisa que se abra el horario de nuevo para agendar igual.

## Copiar libres
Botones en la vista: **Copiar libres de hoy / de esta semana / de este mes**. Filtros opcionales:
solo mañana, solo tarde, desde mañana (no mostrar horarios de hoy que ya pasaron).

Formato (plantilla `horarios_libres`):
```
Horarios disponibles esta semana:
• Lunes 3/11: 10:30, 15:45
• Martes 4/11: 9:00, 16:30
• Jueves 6/11: 13:30, 14:15
```
- Días sin libres no aparecen. Si no hay ninguno: "No tengo horarios libres {rango}".
- Función pura con tests: `src/lib/agenda/textoLibres(bloquesLibresPorDia, rango, plantilla)`.
- "Mañana" = bloques que **empiezan antes de las 12:00**; "tarde" = desde las 12:00.
- Hoy / semana / mes son los del día que se está mirando en la agenda. `{rango}`: "hoy", "esta semana",
  "este mes" si es el período actual; si no, "el jueves 5/11", "la semana del 9 al 13/11", "en diciembre".
- Lo que ya pasó nunca se ofrece (días anteriores ni horarios de hoy que ya empezaron).
- Código: `src/lib/agenda/libres.ts` (`libresPorDia`, `textoLibres`, `textoRango`) y el panel
  `src/app/(app)/agenda/copiar-libres.tsx`.

## Turnos fijos
- `series_turnos` con día, hora, tipo y desde/hasta. Se materializan las próximas 8 semanas (job diario
  o al abrir la agenda), sin duplicar (`unique (serie_id, inicio)`) y salteando `bloqueos`.
- Finalizar una serie borra solo los turnos futuros en estado `agendado`.
