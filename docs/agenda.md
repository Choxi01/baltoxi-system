# Agenda interna — especificación

La agenda la maneja solo la profesional. No hay reserva online de las familias.

## Bloques
- El día se arma con `horarios_atencion` (puede ser horario partido) dividido en bloques de
  `consultorios.duracion_bloque_min` (45 min). Un bloque solo existe si entra entero en el tramo.
- Ejemplo (9:00–11:15 y 13:30–17:15, 45 min): 9:00, 9:45, 10:30, 13:30, 14:15, 15:00, 15:45, 16:30.
- Días en `bloqueos` (feriados, vacaciones): sin bloques.
- Función pura con tests: `src/lib/agenda/bloquesDelDia(fecha, horarios, duracion, bloqueos)`.

## Estado de cada bloque
Un bloque está **ocupado** si algún turno vivo (no cancelado ni reprogramado) se superpone con él:

| `turnos.clase` | Significado | Se muestra |
|---|---|---|
| `turno` | Paciente con ficha | Nombre + tipo de turno + color por estado |
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
- **Día** (por defecto en iPhone): lista de bloques del día, libres incluidos, con acciones.
- **Semana** (por defecto en iPad y Mac): grilla lunes a viernes × bloques.
- **Mes**: calendario con la cantidad de libres por día; tocar un día abre la vista Día.
- Navegación: hoy, anterior, siguiente. Colores accesibles y legibles en modo oscuro.

## Acciones
- Bloque libre → **Reservar** (buscar paciente o escribir un nombre suelto), **Marcar ocupado**
  (motivo), **Turno fijo** (crea `series_turnos` y materializa 8 semanas).
- Turno → **Marcar asistencia** (ver reglas-cobro.md), **Mover** (crea turno nuevo y marca el original
  `reprogramado` con `reprogramado_a`; sin costo), **Cancelar** (pide quién canceló y cuándo avisó),
  **Ver expediente**, **Copiar mensaje** (cambio o cancelación).
- Turno cancelado por la profesional → queda `reponer = true` y aparece en una lista "Para reponer este
  mes" hasta que se agende otro turno con `repone_a`.

### Acciones optimistas (la pantalla cambia al tocar)
- Vino, No vino, Volver a agendado, Quitar excepción, Excepción, Quitar, Cancelar, Mover, Reservar,
  Marcar ocupado y Cobrar ahora se ven **al instante** en la Agenda y en Hoy; el guardado sigue por
  detrás. La tarjeta dice «Guardando…». Los formularios validan antes de cerrarse (mismas funciones
  que el servidor: `validarReserva`, `validarPago`), así los errores de los campos se ven ahí mismo.
- Si el servidor no puede, la tarjeta vuelve sola a como estaba y se muestra el error.
- Cómo: `aplicarCambio` (`src/lib/agenda/optimista.ts`, con tests) copia lo que hace el servidor en
  cada acción; `useTurnosOptimistas` (`src/app/(app)/agenda/turnos-optimistas.ts`) lo aplica con
  `useOptimistic` y vive en la pantalla (el formulario se cierra enseguida).
- **Una acción nueva** sobre un turno: sumá su caso en `aplicarCambio` (con test) y llamala con
  `ejecutar(cambio, () => accion(...), "Aviso ✓")`.
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
