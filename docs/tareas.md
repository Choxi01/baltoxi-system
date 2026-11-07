# Tareas del MVP (8 semanas + piloto + fase 2)

Cómo usar este archivo:
1. Tomá la primera tarea pendiente de tu columna (A = agenda y expediente; B = cobros y mensajes).
2. Creá la rama (`a/nombre` o `b/nombre`), abrí Claude Code en modo plan y pegá el **Pedido**.
3. Al terminar: tests verdes, PR, revisión del otro, merge, y marcá `[x]` acá.

Todas las tareas asumen que Claude Code leyó `CLAUDE.md`. Si no, empezá con "Leé CLAUDE.md".

> Los pedidos de la clienta del 2/11 (`docs/pedidos-daniela-2026-11.md`) ya están sumados como
> **A12**, **A11** y **B9** (ver "Pedidos de Daniela") y como ampliación de la **B8**.

| Semana | Persona A | Persona B |
|---|---|---|
| 1 | 0.1–0.4 juntos | 0.1–0.4 juntos |
| 2–3 | A1, A2 | B1, B2 |
| 4 | A3, A4 | B3, B4 |
| 5 | A12, A11, A5, A6 | B5, B9 |
| 6 | A7, A8 | B6, B7 |
| 7 | A9, A10 | B8 |
| 8 | 8.1, 8.2 juntos | 8.1, 8.2 juntos |
| 9–12 | Piloto | Piloto |
| 13–15 | Fase 2 | Fase 2 |

---

## Semana 1 — Cimientos (los dos juntos)

### [x] 0.1 Proyecto base y publicación
> Leé CLAUDE.md. Creá el proyecto Next.js con TypeScript estricto, Tailwind, shadcn/ui y Vitest, con la
> estructura de carpetas de CLAUDE.md. Scripts `test`, `lint`, `typecheck`. Página de inicio simple.
> `netlify.toml` para publicar en Netlify. Explicame paso a paso cómo conectar GitHub con Netlify.

### [x] 0.2 Base de datos
> Ayudame a aplicar las migraciones de `supabase/migrations/` en mis dos proyectos de Supabase (pruebas
> y producción) con el Supabase CLI. Clientes `@supabase/ssr` de navegador y servidor en
> `src/lib/supabase/`, más un cliente admin con service role importable solo desde el servidor
> (`import 'server-only'`). Script `gen:types` y `.env.example`. Ninguna clave real en el repo.

> _Hecho en `pruebas` (migraciones 0001–0004; la 0005 vino con la 0.3). Producción se aplica en la semana 8: ver `docs/supabase.md`._

### [x] 0.3 Ingreso seguro
> Login con email y contraseña + segundo factor TOTP (Supabase MFA): al primer ingreso, mostrar el QR
> para la app Autenticador del iPhone; después pedir el código siempre. Si el usuario no tiene
> consultorio, formulario que llame a `crear_consultorio(nombre)`. Layout con menú inferior en iPhone
> (Hoy, Agenda, Pacientes, Cobros, Más) y lateral en iPad y Mac. Todas las rutas protegidas excepto
> `/ficha/*`. Sesión que vence tras 12 h sin uso.

> _Cambiado después: dispositivo de confianza. El código se pide en un navegador nuevo o cada 30 días; tras Salir o 24 h sin uso, solo email y contraseña (ver `docs/supabase.md`)._

### [x] 0.4 Datos de prueba
> Creá `supabase/seed.sql` con datos INVENTADOS: el consultorio con tarifas (290.000, 280.000, 350.000,
> 280.000, 350.000), 12 tutores (uno con dos hijos), 15 pacientes con planes por sesión, semanal y
> mensual, series semanales que den unas 25 sesiones por semana, un mes de turnos con estados variados,
> pagos parciales, 2 notas y 1 anamnesis. Explicame cómo cargarlo.

---

## Semanas 2–3 — Base de cada módulo

#### [x] A1 Pacientes y tutores
> Pantalla Pacientes: lista con buscador y filtro por estado. Ficha (pestaña Datos) según
> `docs/expediente.md`, con edad calculada. Pestaña Tutores: varios tutores con parentesco, elegir
> existente o crear; marcar responsable de pago; datos de factura (RUC o CI, DV, razón social, email);
> botón "Copiar link de la ficha". Validá con zod.

#### [x] A2 Horario de atención y calendario
> Configuración del horario de atención (tramos por día) y feriados/vacaciones. En `src/lib/agenda/`,
> `bloquesDelDia` según `docs/agenda.md` con tests (horario partido, bloque que no entra, feriado).
> Pantalla Agenda con vistas Día, Semana y Mes que muestran bloques libres y turnos (solo lectura por
> ahora). Día por defecto en iPhone, Semana en iPad y Mac.

> _Dividida en dos PRs. **A2a**: Configuración > Horario y feriados (tramos por día, duración del bloque,
> feriados y vacaciones cargados a mano) y `bloquesDelDia` con tests. **A2b**: pantalla Agenda Día/Semana/Mes
> de solo lectura (`armarDia`, `liberaBloque` y fechas de `calendario.ts`, con tests)._

#### [x] B1a Configuración: Consultorio y Tarifas
> Configuración con pestañas: Consultorio (nombre, profesional, RUC, DV, razón social, dirección,
> datos de pago, horas mínimas de aviso, plazo de pago, concepto de factura) y Tarifas (formato
> Gs. 290.000; agregar, editar, desactivar/activar — no se borran).

#### [x] B1b Configuración: Tipos de turno y Reglas de cobro
> En `/config`, completá las pestañas Tipos de turno (tarifa, cobra en el momento, genera cobro;
> agregar, editar, desactivar/activar) y Reglas de cobro (porcentaje por estado; excepciones por
> paciente: agregar y quitar). Validá con zod y tests en `src/lib/config/`.

#### [x] B2 Motor de cobro
> Implementá en `src/lib/cobro/` las funciones de `docs/reglas-cobro.md` secciones 1 a 8, más
> `formatoGs` e `iva10`. Puras, sin Supabase. Un test por cada caso de la tabla (22). No avances si
> alguno falla.

---

## Semana 4 — Turnos y cobros (prioridad 1)

#### [x] A3 Agenda completa
> Según `docs/agenda.md`: en un bloque libre, Reservar (paciente o nombre suelto), Marcar ocupado,
> Turno fijo (series + materialización de 8 semanas, con tests). En un turno: Mover, Cancelar (quién y
> cuándo avisó), Ver expediente. Confirmación si hay superposición; aviso de traslado entre domicilios.
> "Reservado: Fulano" → botón Crear ficha que lo convierte en turno. Lista "Para reponer este mes".

> _Dividida en tres PRs. **A3a**: Reservar (paciente o nombre suelto), Marcar ocupado, Ver expediente, Crear ficha
> desde un reservado, superposición y traslado. **A3b**: Mover (migración 0007 `mover_turno`), Cancelar (sin cargos
> hasta la B3), Quitar y "Para reponer este mes". **A3c**: Turno fijo (series + 8 semanas al abrir la agenda, salteando
> feriados; `fechasDeSerie` con tests) y Finalizar turno fijo._

#### [x] A4 Copiar libres
> Botones Copiar libres de hoy / semana / mes con filtros (mañana, tarde, desde mañana), usando
> `textoLibres` (función pura con tests) y la plantilla `horarios_libres`. Copiar al portapapeles con
> aviso "Copiado"; en iPhone, también botón Compartir (share sheet del sistema).

#### [x] B3 Asistencia
> Pantalla Hoy (turnos del día) y acción en la agenda: Vino / Canceló (pide cuándo avisó; usa
> `clasificarCancelacion`) / No vino / Cancelé yo / Excepción (porcentaje + motivo). Una acción de
> servidor `aplicarEstadoTurno()` crea o actualiza el cargo con `calcularCargoTurno` y snapshot.
> Si el tipo cobra en el momento o el plan es por sesión: botón "Cobrar ahora". Mes cerrado: avisar.

> _Hecha en dos partes (PR #19). **B3a**: `aplicarEstadoTurno` (`src/lib/cobro/aplicar-estado.ts`) crea,
> actualiza o borra el cargo con snapshot; enganchada en cancelar, mover (el original reprogramado lleva
> cargo de Gs. 0) y en Vino / No vino / Volver a agendado / Excepción. Mes cerrado: no se cambia nada del turno.
> **B3b**: pantalla Hoy con los turnos del día (también cancelados) y las mismas acciones
> (`useAccionesTurno` en `agenda/acciones-de-turno.tsx`). "Cobrar ahora" pasa a la B4 (necesita registrar pagos)._

#### [x] B4 Pagos y quién debe
> Registrar pago (tutor, fecha, monto, efectivo/transferencia, referencia). Pantalla Cobros: lista de
> saldos (`saldos_tutores`) con atraso según `docs/reglas-cobro.md` sección 5; cuenta de cada tutor con
> cargos, pagos, imputación y saldo acumulado. Saldo a favor visible.

> _Hecha en dos commits (un PR). **B4a**: `validarPago` (sin fechas futuras), `registrarPago` / `borrarPago`
> (`src/lib/cobro/acciones-pagos.ts`) y "Cobrar ahora" en la tarjeta del turno (agenda y Hoy) con aviso de
> deuda anterior por FIFO (`listarTurnosConCobro` en `agenda/datos.ts`). **B4b**: pantalla Cobros con
> "quién debe" (`quienDebe`) y cuenta del tutor (`cuentaTutor` en `src/lib/cobro/cuenta.ts`) con
> imputación, saldo acumulado, saldo a favor y "Borrar pago" (solo sin factura). Medios: efectivo y
> transferencia; los demás de la base quedan para cuando se pidan._

---

## Pedidos de Daniela (2/11) — antes de seguir con la semana 5

Detalle y propuestas en `docs/pedidos-daniela-2026-11.md`. La A11 va antes de la 8.2 porque cambia la base.

#### [x] A12 Vista Semana: por defecto, almuerzo y color por tipo
> Según `docs/pedidos-daniela-2026-11.md` (pedidos 3, 4 y 5). Agenda abre siempre en **Semana**, también
> en iPhone (los 5 días tienen que entrar en el ancho); Día y Mes quedan como botones. En la vista
> Semana, franja gris "Almuerzo" (no clickeable) donde hay un hueco entre dos tramos del mismo día.
> Migración `tipos_turno.color` con una paleta fija de colores suaves y selector en Configuración >
> Tipos de turno. El relleno del turno es el color del tipo; el estado se ve con borde + ícono
> (vino ✓, no vino ✕, canceló tachado). Leyenda chica abajo de la grilla. Actualizá `docs/agenda.md`.

> _Dividida en dos PRs. **A12a** (hecha): Semana por defecto en todos los dispositivos, grilla que entra
> en el iPhone y franja de almuerzo (`filasSemana` en `src/lib/agenda/semana.ts`, con tests). **A12b**
> (hecha): color por tipo de turno (migración 0009 `tipos_turno.color` con paleta fija y trigger que
> sugiere uno libre; selector en Configuración > Tipos de turno), estado en el borde con ✓ / ✕ / "%" y
> leyenda (`src/lib/agenda/colores.ts`, con tests)._

#### [x] A11 Sesiones dobles y grupales
> Según `docs/pedidos-daniela-2026-11.md` (pedido 2), con las respuestas de Daniela. Modelo: **un turno
> por chico unidos por `grupo_id`** (también en series), así la asistencia y el cargo siguen siendo por
> paciente. El tipo de turno define el cupo (1 individual, 2 doble, N grupal). Reservar y Turno fijo
> con un tipo doble o grupal piden elegir 2 o N pacientes. En la grilla se ve un solo rectángulo
> ("Juan + Pedro" o "Grupal · 4"); la asistencia se marca por chico. Mover y cancelar mueven el grupo
> entero, con opción de sacar a un solo chico. Tests en `src/lib/agenda`.

> _Respuestas de Daniela: máximo 4 chicos en una grupal; duran lo mismo que una individual; cada familia
> paga una sesión entera, sin repartir el precio; la doble nunca es de hermanos, son compañeritos, así
> que cada chico tiene su propia familia y su propio cobro (confirma un turno por chico con `grupo_id`)._

> _Dividida en dos PRs. **A11a** (hecha): migración 0013 (`tipos_turno.cupo` de 1 a 4 y `grupo_id` en
> `turnos` y `series_turnos`); "Chicos por sesión" en Configuración > Tipos de turno; Reservar con un tipo
> doble o grupal pide de 2 al cupo de pacientes y crea un turno por chico con el mismo `grupo_id`; en Día y
> Semana se ven como un solo rectángulo ("Juan + Pedro" o "Grupal · 4", borde ✓ / ✕ / ½) y el panel muestra
> a cada chico con sus acciones (`src/lib/agenda/grupos.ts`, `estiloGrupo`, caso `agregar_grupo` en
> `aplicarCambio`, con tests). **A11b** (hecha): turno fijo doble o grupal (una serie por chico con el
> mismo `grupo_id`, que pasa a sus turnos); en la sesión, "Mover sesión" (migración 0014 `mover_grupo`),
> "Cancelar sesión" (solo "Cancelé yo") y "Finalizar turno fijo de la sesión"; cada chico se saca con sus
> botones de siempre (Mover, Cancelar, "Sacar del turno fijo"), aunque quede solo._

#### [x] B9 "¿Se cobra?" al cancelar tarde
> Según `docs/pedidos-daniela-2026-11.md` (pedido 1). En el formulario Cancelar, si la clasificación da
> `aviso_tardio`, mostrar **Se cobra (Gs. …)** / **No se cobra** (por defecto Se cobra). "No se cobra"
> guarda `aviso_tardio` con `porcentaje_manual = 0` y motivo ("Excepción al cancelar" por defecto). Es
> la misma excepción de la B3: `calcularCargoTurno` y los 22 casos no cambian. Test del armado de datos.

> _Hecha. El monto del botón sale de `montoAvisoTardio` (`src/lib/cobro/aplicar-estado.ts`), la misma cuenta
> que el cargo. Si no hay nada para cobrar, no pregunta; si no se pudo calcular, pregunta sin el número.
> Funciona en Agenda y en Hoy. El "Otro %" opcional no se hizo: sigue la acción Excepción._

---

## Semana 5 — Expediente y mensajes

#### [x] A5 Notas de sesión
> Pestaña Notas del expediente: crear, editar, fijar; la fijada se ve arriba de la ficha. Desde un turno:
> "Agregar nota de esta sesión". Nada de esto aparece en mensajes, reportes ni logs.

> _Hecha. Una sola nota fijada por paciente (fijar otra desfija la anterior) y también se pueden borrar,
> con confirmación. Detalle en `docs/expediente.md`. Para la 8.1: `auditoria` guarda copia del texto._

#### [ ] A6 Anamnesis
> Editor de plantillas de anamnesis (secciones y campos, tipos de `docs/expediente.md`) y formulario
> generado con guardado automático; copia la estructura al crear. Te paso el Word de ejemplo: armá con
> él la primera plantilla en formato JSON (sin datos de pacientes) y cargala en el seed.

> _En partes. **A6a** hecha: editor de plantillas en Configuración > Anamnesis (detalle en
> `docs/expediente.md`). **A6b** pendiente: pestaña Anamnesis del expediente con guardado automático y
> vista para imprimir. **Falta el Word** de la profesional para la primera plantilla real._

#### [x] B5 Plantillas y bandeja de mensajes
> Según `docs/mensajes.md`: editor de plantillas con variables y vista previa; función pura
> `pendientesDelDia` con tests (recordatorios de mañana, monto del período en el último turno, atrasos);
> pantalla "Mensajes de hoy" con Copiar / Abrir WhatsApp, registro en `mensajes_enviados` y tachado.
> Mensajes de cambio y cancelación ofrecidos al mover o cancelar un turno.

> _Hecha en dos commits. **B5a**: `src/lib/mensajes/plantillas.ts` (variables, `rellenar`, vista previa),
> Configuración → Mensajes, `BotonesMensaje` (Copiar / WhatsApp, anota en `mensajes_enviados`) y el mensaje
> que se ofrece al mover o cancelar. Migración 0008: el recordatorio usa `{cuando}` ("mañana" o "el lunes 2/11").
> **B5b**: `pendientesDelDia` (`src/lib/mensajes/pendientes.ts`): recordatorios del próximo día de atención
> (`proximoDiaDeAtencion`, salteando feriados), monto del período el día del último turno (aviso si quedan turnos
> de hoy sin marcar) y pagos atrasados con `vencimiento` + `atraso` (máximo uno cada 7 días por tutor).
> Pantalla Mensajes de hoy y contador en el menú. El detalle por sesión y la cuenta del tutor se hicieron en la B6._

---

## Semana 6 — Documentos, ficha online y facturación

#### [x] A7 Documentos
> Pestaña Documentos según `docs/expediente.md`: subir desde cámara o archivos, achicar imágenes en el
> dispositivo, guardar en el bucket privado con la ruta indicada, ver con link firmado de 5 minutos,
> borrar con confirmación. Tipos y fechas. Probalo desde Safari en iPhone.

> _Hecha (migración 0010: límites del bucket). Detalle en `docs/expediente.md`. Probada en Chrome con
> datos inventados (una foto de 4032×3024 queda en 2000×1500 JPEG); **falta probarla en Safari de iPhone**
> con la base (cámara, subir, ver y borrar). Para la 8.1: archivos que quedan al borrar un paciente._

#### [x] A8 Ficha online y reglamento
> Página pública `/ficha/<token>` según `docs/expediente.md`: datos editables del tutor y sus hijos,
> otros tutores, datos de factura y firma del reglamento. Todo en el servidor con el cliente admin y
> límite de intentos. Nunca mostrar datos clínicos. En Configuración, editor del reglamento (al guardar
> sube la versión). En la ficha del paciente, estado de la firma.

> _Dividida en dos PRs. **A8a** (hecha): página `/ficha/<token>` con datos del tutor, hijos, factura y
> otros tutores; límite de intentos (10 links inválidos por hora por IP, 30 guardados por hora por link);
> aviso "Actualizado por la familia" con Visto (migración 0011). **A8b** (hecha): reglamento (editor en
> Configuración que sube la versión, firma en la ficha y estado de cada tutor en el expediente). Probada con
> datos inventados; **falta probarla con la base y en Safari de iPhone**._

#### [x] B6 Monto del período
> En "Mensajes de hoy" y en la cuenta del tutor: mensaje de monto de la semana o del mes, total por
> familia (hermanos juntos), con interruptor de detalle por sesión. Usa las funciones de
> `docs/reglas-cobro.md` sección 6.

> _Hecha, sin migración. El mensaje sale de `armarMonto` (`src/lib/mensajes/monto.ts`), que usan la bandeja y la
> cuenta. Se arregló `montoPeriodo`: un ajuste negativo se descontaba dos veces. También se sumó la pestaña
> "Turnos y cuenta" del expediente y `mensajes/datos.ts` pasó a `leerTodo`. **Falta probarla con la base en
> Safari de iPhone.**_

#### [x] B7 Para facturar
> Pantalla Para facturar según `docs/reglas-cobro.md` sección 7: elegir mes de cobro, una fila por
> familia con todos los datos y botones copiar por campo, descarga en Excel (exceljs), y "Marcar
> facturado" con número de factura (crea `facturas` y vincula los pagos).

> _Hecha (migración 0012: `crear_factura`, se permite otra factura en el mes y el número no se repite). También
> se sumó "Ya facturadas" con Deshacer, que no anula la factura en Marangatu. La 0012 ya está aplicada en `pruebas`.
> **Falta probar Marcar facturado y Deshacer con la base, y Safari de iPhone** (pasos en el PR #35). Los tipos de `crear_factura` se escribieron a mano._

---

## Semana 7 — Importar, instalar y reportes

#### [ ] A9 Importar Excel y copias
> Importar pacientes y tutores desde el Excel actual de la profesional (te paso las columnas, sin datos
> reales) con vista previa y errores por fila. Además, revisá `.github/workflows/backup.yml` y agregá
> la copia semanal de los archivos del bucket `documentos` (script con el cliente admin que lista y
> descarga todo, comprime y cifra). Explicame cómo restaurar.

#### [ ] A10 App instalable
> PWA instalable en iPhone, iPad y Mac (manifest, íconos, pantalla de inicio), sin modo offline.

#### [x] B8 Reportes
> Pantalla Reportes según `docs/reglas-cobro.md` sección 8: generado hoy y en el mes, proyección,
> cobrado, pendiente, horas trabajadas, comparación de 6 meses (gráfico de barras). Exportar a Excel.
> Además (pedido 6 de `docs/pedidos-daniela-2026-11.md`): vista Semana con el generado de cada día
> (Lun a Vie, monto exacto y barrita, flechas de semana en semana; tocar un día muestra sus turnos) y
> vista Mes con gráfico de líneas del generado acumulado y la proyección punteada hasta fin de mes.

---

## Semana 8 — Seguridad y prueba real (los dos)

#### [ ] 8.1 Revisión de seguridad
> Revisá todo el código: service role solo en servidor; consultas filtradas por consultorio; bucket
> privado y links firmados; ficha pública sin datos clínicos y con límite de intentos; nada clínico en
> mensajes, facturas, reportes ni logs (ojo: `auditoria` guarda copia de notas, anamnesis y documentos); claves fuera del repo; MFA obligatorio. Test con dos
> consultorios que verifique que uno no ve pacientes, notas ni documentos del otro.

#### [ ] 8.2 Prueba con datos reales
Sin Claude Code: pasar Supabase producción a plan Pro, importar el Excel de la profesional, cargar el
mes anterior y comparar totales familia por familia. Cada diferencia es una tarea nueva.

## Semanas 9–12 — Piloto
La profesional usa la app junto a su Excel. Se manda el mensaje de bienvenida con el link de la ficha a
todas las familias. Al cerrar el mes se comparan los totales.

## Semanas 13–15 — Fase 2: WhatsApp automático
- F1: Alta del número en WhatsApp Cloud API en coexistencia; plantillas de utilidad aprobadas por Meta.
- F2: Interruptor "Enviar automáticamente" por plantilla; job programado; registro `canal = 'automatico'`.
- F3: Mensajes automáticos a pacientes nuevos (bienvenida + link de la ficha).
