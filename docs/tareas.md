# Tareas del MVP (8 semanas + piloto + fase 2)

Cómo usar este archivo:
1. Tomá la primera tarea pendiente de tu columna (A = agenda y expediente; B = cobros y mensajes).
2. Creá la rama (`a/nombre` o `b/nombre`), abrí Claude Code en modo plan y pegá el **Pedido**.
3. Al terminar: tests verdes, PR, revisión del otro, merge, y marcá `[x]` acá.

Todas las tareas asumen que Claude Code leyó `CLAUDE.md`. Si no, empezá con "Leé CLAUDE.md".

| Semana | Persona A | Persona B |
|---|---|---|
| 1 | 0.1–0.4 juntos | 0.1–0.4 juntos |
| 2–3 | A1, A2 | B1, B2 |
| 4 | A3, A4 | B3, B4 |
| 5 | A5, A6 | B5 |
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

### [ ] 0.4 Datos de prueba
> Creá `supabase/seed.sql` con datos INVENTADOS: el consultorio con tarifas (290.000, 280.000, 350.000,
> 280.000, 350.000), 12 tutores (uno con dos hijos), 15 pacientes con planes por sesión, semanal y
> mensual, series semanales que den unas 25 sesiones por semana, un mes de turnos con estados variados,
> pagos parciales, 2 notas y 1 anamnesis. Explicame cómo cargarlo.

---

## Semanas 2–3 — Base de cada módulo

#### [ ] A1 Pacientes y tutores
> Pantalla Pacientes: lista con buscador y filtro por estado. Ficha (pestaña Datos) según
> `docs/expediente.md`, con edad calculada. Pestaña Tutores: varios tutores con parentesco, elegir
> existente o crear; marcar responsable de pago; datos de factura (RUC o CI, DV, razón social, email);
> botón "Copiar link de la ficha". Validá con zod.

#### [ ] A2 Horario de atención y calendario
> Configuración del horario de atención (tramos por día) y feriados/vacaciones. En `src/lib/agenda/`,
> `bloquesDelDia` según `docs/agenda.md` con tests (horario partido, bloque que no entra, feriado).
> Pantalla Agenda con vistas Día, Semana y Mes que muestran bloques libres y turnos (solo lectura por
> ahora). Día por defecto en iPhone, Semana en iPad y Mac.

#### [ ] B1 Configuración de cobros
> Configuración con pestañas: Consultorio (nombre, profesional, RUC, DV, razón social, dirección,
> datos de pago, horas mínimas de aviso, plazo de pago, concepto de factura), Tarifas (formato
> Gs. 290.000), Tipos de turno (tarifa, cobra en el momento, genera cobro) y Reglas de cobro
> (porcentaje por estado; excepciones por paciente).

#### [ ] B2 Motor de cobro
> Implementá en `src/lib/cobro/` las funciones de `docs/reglas-cobro.md` secciones 1 a 8, más
> `formatoGs` e `iva10`. Puras, sin Supabase. Un test por cada caso de la tabla (22). No avances si
> alguno falla.

---

## Semana 4 — Turnos y cobros (prioridad 1)

#### [ ] A3 Agenda completa
> Según `docs/agenda.md`: en un bloque libre, Reservar (paciente o nombre suelto), Marcar ocupado,
> Turno fijo (series + materialización de 8 semanas, con tests). En un turno: Mover, Cancelar (quién y
> cuándo avisó), Ver expediente. Confirmación si hay superposición; aviso de traslado entre domicilios.
> "Reservado: Fulano" → botón Crear ficha que lo convierte en turno. Lista "Para reponer este mes".

#### [ ] A4 Copiar libres
> Botones Copiar libres de hoy / semana / mes con filtros (mañana, tarde, desde mañana), usando
> `textoLibres` (función pura con tests) y la plantilla `horarios_libres`. Copiar al portapapeles con
> aviso "Copiado"; en iPhone, también botón Compartir (share sheet del sistema).

#### [ ] B3 Asistencia
> Pantalla Hoy (turnos del día) y acción en la agenda: Vino / Canceló (pide cuándo avisó; usa
> `clasificarCancelacion`) / No vino / Cancelé yo / Excepción (porcentaje + motivo). Una acción de
> servidor `aplicarEstadoTurno()` crea o actualiza el cargo con `calcularCargoTurno` y snapshot.
> Si el tipo cobra en el momento o el plan es por sesión: botón "Cobrar ahora". Mes cerrado: avisar.

#### [ ] B4 Pagos y quién debe
> Registrar pago (tutor, fecha, monto, efectivo/transferencia, referencia). Pantalla Cobros: lista de
> saldos (`saldos_tutores`) con atraso según `docs/reglas-cobro.md` sección 5; cuenta de cada tutor con
> cargos, pagos, imputación y saldo acumulado. Saldo a favor visible.

---

## Semana 5 — Expediente y mensajes

#### [ ] A5 Notas de sesión
> Pestaña Notas del expediente: crear, editar, fijar; la fijada se ve arriba de la ficha. Desde un turno:
> "Agregar nota de esta sesión". Nada de esto aparece en mensajes, reportes ni logs.

#### [ ] A6 Anamnesis
> Editor de plantillas de anamnesis (secciones y campos, tipos de `docs/expediente.md`) y formulario
> generado con guardado automático; copia la estructura al crear. Te paso el Word de ejemplo: armá con
> él la primera plantilla en formato JSON (sin datos de pacientes) y cargala en el seed.

#### [ ] B5 Plantillas y bandeja de mensajes
> Según `docs/mensajes.md`: editor de plantillas con variables y vista previa; función pura
> `pendientesDelDia` con tests (recordatorios de mañana, monto del período en el último turno, atrasos);
> pantalla "Mensajes de hoy" con Copiar / Abrir WhatsApp, registro en `mensajes_enviados` y tachado.
> Mensajes de cambio y cancelación ofrecidos al mover o cancelar un turno.

---

## Semana 6 — Documentos, ficha online y facturación

#### [ ] A7 Documentos
> Pestaña Documentos según `docs/expediente.md`: subir desde cámara o archivos, achicar imágenes en el
> dispositivo, guardar en el bucket privado con la ruta indicada, ver con link firmado de 5 minutos,
> borrar con confirmación. Tipos y fechas. Probalo desde Safari en iPhone.

#### [ ] A8 Ficha online y reglamento
> Página pública `/ficha/<token>` según `docs/expediente.md`: datos editables del tutor y sus hijos,
> otros tutores, datos de factura y firma del reglamento. Todo en el servidor con el cliente admin y
> límite de intentos. Nunca mostrar datos clínicos. En Configuración, editor del reglamento (al guardar
> sube la versión). En la ficha del paciente, estado de la firma.

#### [ ] B6 Monto del período
> En "Mensajes de hoy" y en la cuenta del tutor: mensaje de monto de la semana o del mes, total por
> familia (hermanos juntos), con interruptor de detalle por sesión. Usa las funciones de
> `docs/reglas-cobro.md` sección 6.

#### [ ] B7 Para facturar
> Pantalla Para facturar según `docs/reglas-cobro.md` sección 7: elegir mes de cobro, una fila por
> familia con todos los datos y botones copiar por campo, descarga en Excel (exceljs), y "Marcar
> facturado" con número de factura (crea `facturas` y vincula los pagos).

---

## Semana 7 — Importar, instalar y reportes

#### [ ] A9 Importar Excel y copias
> Importar pacientes y tutores desde el Excel actual de la profesional (te paso las columnas, sin datos
> reales) con vista previa y errores por fila. Además, revisá `.github/workflows/backup.yml` y agregá
> la copia semanal de los archivos del bucket `documentos` (script con el cliente admin que lista y
> descarga todo, comprime y cifra). Explicame cómo restaurar.

#### [ ] A10 App instalable
> PWA instalable en iPhone, iPad y Mac (manifest, íconos, pantalla de inicio), sin modo offline.

#### [ ] B8 Reportes
> Pantalla Reportes según `docs/reglas-cobro.md` sección 8: generado hoy y en el mes, proyección,
> cobrado, pendiente, horas trabajadas, comparación de 6 meses (gráfico de barras). Exportar a Excel.

---

## Semana 8 — Seguridad y prueba real (los dos)

#### [ ] 8.1 Revisión de seguridad
> Revisá todo el código: service role solo en servidor; consultas filtradas por consultorio; bucket
> privado y links firmados; ficha pública sin datos clínicos y con límite de intentos; nada clínico en
> mensajes, facturas, reportes ni logs; claves fuera del repo; MFA obligatorio. Test con dos
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
