# CLAUDE.md — Contexto del proyecto para Claude Code

## Qué es
App web (usable desde el celular, instalable como PWA) para consultorios de terapia
(fonoaudiología, psicología). Primera clienta: una fonoaudióloga en Paraguay que atiende niños.
Resuelve: agenda con turnos fijos, asistencia, cobro según cómo terminó cada turno,
cuenta corriente por familia, cierre de mes con resumen por WhatsApp y datos listos para facturar.

Los programadores tienen poca experiencia: **explicá en español y en simple** qué vas a hacer
antes de hacerlo, y al terminar resumí qué archivos cambiaste y cómo probarlo.

## Stack (no agregar otras librerías sin preguntar)
- Next.js (App Router) + TypeScript estricto
- Supabase: PostgreSQL, Auth (email + contraseña), Row Level Security. Cliente: `@supabase/ssr`
- Tailwind CSS + shadcn/ui
- Vitest para tests
- Fechas: `date-fns` + `@date-fns/tz` (zona `America/Asuncion`)
- Excel: `exceljs`
- Hosting: Netlify (plan gratis). Repo: GitHub privado.

## Comandos
- `npm run dev` — servidor local
- `npm test` — tests (Vitest)
- `npm run lint` y `npm run typecheck` — deben pasar antes de cada PR
- `npm run gen:types` — regenera `src/lib/supabase/types.ts` desde la base

## Estructura
```
src/app/(auth)/          login
src/app/(app)/hoy/       pantalla principal (turnos del día)
src/app/(app)/agenda/    agenda semanal
src/app/(app)/pacientes/
src/app/(app)/cobros/    quién me debe, registrar pagos
src/app/(app)/cierre/    cierre de mes
src/app/(app)/facturar/  para facturar
src/app/(app)/reportes/
src/app/(app)/config/    consultorio, tarifas, reglas, feriados, Google
src/lib/cobro/           MOTOR DE COBRO: funciones puras + tests (sin Supabase ni React)
src/lib/agenda/          series y materialización de turnos (funciones puras + tests)
src/lib/supabase/        clientes (navegador / servidor) y tipos generados
supabase/migrations/     SQL (una migración aplicada NUNCA se edita: se crea otra)
docs/                    especificaciones y tareas
```

## Reglas de oro (no negociables)
1. **Plata en enteros**: montos en guaraníes como `number` entero (en la base `bigint`). Nunca
   decimales ni floats. IVA 10% incluido: `iva = Math.round(monto / 11)`. Formato: `Gs. 150.000`.
2. **El saldo nunca se guarda**: saldo = suma(cargos) − suma(pagos). Usar la vista `saldos_responsables`.
3. **Multi-consultorio**: toda tabla de datos tiene `consultorio_id` y RLS. Toda consulta filtra por
   el consultorio activo. Nunca usar la service role key en el navegador.
4. **Snapshot**: al crear un cargo, guardar en `snapshot` la tarifa, el monto base, la regla y el
   porcentaje usados. Cambiar una tarifa no recalcula cargos existentes.
5. **Meses cerrados son intocables**: la base rechaza cambios en cargos de un período cerrado.
   La UI debe avisarlo antes de intentar.
6. **Zona horaria**: guardar `timestamptz`; mostrar y calcular días/meses en `America/Asuncion`.
7. **Privacidad**: datos de salud de menores. Nunca poner diagnósticos en mensajes, conceptos de
   factura, logs ni nombres de archivo. Concepto de factura: "Sesiones de fonoaudiología – <mes año>".
   Nunca usar datos reales en tests, seeds ni prompts: solo datos inventados.
8. **Lógica de negocio fuera de los componentes**: cálculos en `src/lib/...` como funciones puras con
   tests. Los componentes solo muestran y llaman.
9. **Textos de la app en español (Paraguay, voseo)**. Nombres de tablas/columnas en español tal como
   están en la migración; código TypeScript puede usar esos mismos nombres.

## Cómo trabajar
- Una tarea de `docs/tareas.md` por sesión. Primero un plan corto, esperar aprobación, después código.
- Cambios chicos y probables: si una tarea crece, proponé dividirla.
- Tests obligatorios para todo lo de `src/lib/cobro` y `src/lib/agenda`.
- Cambios de base de datos: nueva migración en `supabase/migrations/NNNN_descripcion.sql`, avisar en el PR.
- Al terminar: correr `npm test`, `npm run lint`, `npm run typecheck`; marcar la tarea como hecha
  en `docs/tareas.md`; sugerir mensaje de commit.
- Si algo de la especificación es ambiguo, preguntá en vez de inventar.

## Documentos
- `docs/reglas-cobro.md` — cómo se calcula cada cargo, con casos de prueba
- `docs/tareas.md` — lista de tareas con el pedido para cada una
- `supabase/migrations/0001_inicial.sql` — esquema completo comentado
