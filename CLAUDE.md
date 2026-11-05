# CLAUDE.md — Contexto del proyecto para Claude Code

## Qué es
App web de uso interno (instalable como PWA en iPhone, iPad y Mac) para consultorios de terapia.
Primera clienta: una fonoaudióloga en Asunción, Paraguay, que atiende sobre todo niños.
La profesional maneja TODO ella: agenda (reservar, ocupar, mover, cancelar, copiar horarios libres),
expediente de cada paciente (datos, tutores, anamnesis, notas, documentos), asistencia, cobros,
mensajes de WhatsApp para copiar, datos para facturar y reportes. Las familias no usan la app; solo
tienen una ficha online para actualizar sus datos y firmar el reglamento.

Los programadores tienen poca experiencia: **explicá en español y en simple** qué vas a hacer
antes de hacerlo, y al terminar resumí qué archivos cambiaste y cómo probarlo.

## Stack (no agregar otras librerías sin preguntar)
- Next.js (App Router) + TypeScript estricto
- Supabase: PostgreSQL, Auth (email + contraseña + MFA TOTP), Row Level Security, Storage privado.
  Cliente: `@supabase/ssr`
- Tailwind CSS + shadcn/ui
- Vitest para tests
- Fechas: `date-fns` + `@date-fns/tz` (zona `America/Asuncion`)
- Excel: `exceljs`
- Hosting: Netlify. Repo: GitHub privado.
- NO hay Google Calendar ni emails en el MVP. Los mensajes van por WhatsApp (copiar o wa.me).

## Comandos
- `npm run dev` — servidor local
- `npm test` — tests (Vitest)
- `npm run lint` y `npm run typecheck` — deben pasar antes de cada PR
- `npm run gen:types` — regenera `src/lib/supabase/types.ts` desde la base

## Estructura
```
src/app/(auth)/            login + código MFA
src/app/(app)/hoy/         turnos de hoy y asistencia
src/app/(app)/agenda/      calendario día / semana / mes, copiar libres
src/app/(app)/pacientes/   lista y expediente (datos, tutores, anamnesis, notas, documentos, cuenta)
src/app/(app)/mensajes/    "Mensajes de hoy"
src/app/(app)/cobros/      quién debe, pagos, cuenta por tutor
src/app/(app)/facturar/    para facturar
src/app/(app)/reportes/
src/app/(app)/config/      consultorio, horario, tarifas, tipos de turno, reglas, plantillas, reglamento
src/app/ficha/[token]/     PÚBLICA: ficha de la familia y firma del reglamento
src/lib/cobro/             MOTOR DE COBRO: funciones puras + tests
src/lib/agenda/            bloques, libres, series (funciones puras + tests)
src/lib/mensajes/          plantillas y pendientes del día (funciones puras + tests)
src/lib/supabase/          clientes (navegador / servidor / admin solo-servidor) y tipos
supabase/migrations/       SQL (una migración aplicada NUNCA se edita: se crea otra)
docs/                      especificaciones y tareas
```

## Reglas de oro (no negociables)
1. **Plata en enteros**: guaraníes como `number` entero (en la base `bigint`). Nunca decimales.
   IVA 10% incluido: `Math.round(monto / 11)`. Formato: `Gs. 290.000`.
2. **El saldo nunca se guarda**: saldo = suma(cargos) − suma(pagos). Vista `saldos_tutores`.
3. **Multi-consultorio**: toda tabla tiene `consultorio_id` y RLS. Service role solo en el servidor.
4. **Snapshot**: cada cargo guarda tarifa, monto base, regla y porcentaje usados.
5. **Meses cerrados son intocables** (la base lo impide; la UI avisa antes).
6. **Zona horaria**: `timestamptz` en la base; días, semanas y meses en `America/Asuncion`.
7. **Datos clínicos** (motivo de consulta, notas, anamnesis, documentos): solo dentro del expediente.
   Nunca en mensajes, conceptos de factura, reportes, logs, nombres de archivo, URLs ni en la ficha
   pública. Documentos solo por links firmados de 5 minutos.
8. **Datos inventados** en tests, seeds y prompts. Nunca pegar datos reales de pacientes.
9. **Lógica fuera de los componentes**: cálculos en `src/lib/...` como funciones puras con tests.
10. **Ficha pública** (`/ficha/<token>`): todo en el servidor con el cliente admin, validando el
    token, con límite de intentos; muestra solo datos administrativos de esa familia.
11. **Textos en español de Paraguay, de vos.** Tablas y columnas en español como en la migración.
12. **Pensado para iPhone primero** (Safari): botones grandes, nada que dependa del mouse.

## Cómo trabajar
- Una tarea de `docs/tareas.md` por sesión. Primero un plan corto, esperar aprobación, después código.
- Si una tarea crece, proponé dividirla.
- Tests obligatorios para `src/lib/cobro`, `src/lib/agenda` y `src/lib/mensajes`.
- Cambios de base: nueva migración `supabase/migrations/NNNN_descripcion.sql`, avisar en el PR.
- Al terminar: `npm test`, `npm run lint`, `npm run typecheck`; marcar la tarea en `docs/tareas.md`;
  sugerir mensaje de commit.
- Si algo es ambiguo, preguntá en vez de inventar.

## Documentos
- `docs/agenda.md` — bloques, estados, acciones, copiar libres, turnos fijos
- `docs/expediente.md` — ficha, tutores, anamnesis, notas, documentos, ficha online, seguridad
- `docs/reglas-cobro.md` — cálculo de cargos, saldos, atrasos, facturación, reportes y casos de prueba
- `docs/mensajes.md` — plantillas, "Mensajes de hoy" y fase 2 automática
- `docs/tareas.md` — tareas con el pedido para cada una
- `docs/pedidos-daniela-2026-11.md` — cambios que pidió la clienta (2/11); revisalo antes de cada tarea
  de agenda, cobro o reportes: algunos cambian lo que dicen los otros docs
- `docs/supabase.md` — variables, clientes, migraciones y tipos
- `docs/datos-de-prueba.md` — qué carga `supabase/seed.sql` y cómo cargarlo
- `supabase/migrations/` — esquema completo comentado
