# Reglas de cobro — especificación del motor

El motor vive en `src/lib/cobro/` y son **funciones puras** (sin base de datos, sin React).
Todo caso de esta página tiene su test.

## 1. Estados de un turno (`turnos.estado`)

| Estado | Significado | Regla por defecto |
|---|---|---|
| `agendado` | No pasó o no se marcó | Sin cargo |
| `presente` | Vino | 100% |
| `ausente_con_aviso` | Canceló con `horas_aviso_minimas` o más (Daniela usa 24 h) | 0% |
| `aviso_tardio` | Canceló con menos de `horas_aviso_minimas` | 100% (al cancelar se pregunta "¿Se cobra?", sección 3) |
| `ausente_sin_aviso` | No vino ni avisó | 100% |
| `cancelado_profesional` | Canceló la profesional (queda `reponer = true`) | 0% |
| `reprogramado` | Se movió a otro horario; se cobra el turno nuevo | 0% |

### Clasificar una cancelación de la familia
```
horas = (turno.inicio - aviso_en) en horas
horas >= horas_aviso_minimas  -> 'ausente_con_aviso'
si no (incluye aviso después del inicio) -> 'aviso_tardio'
```
`clasificarCancelacion({ inicio, avisoEn, horasAvisoMinimas })`

## 2. Monto base del turno
```
si tipo_turno.tarifa_id         -> esa tarifa (domicilio, evaluación, colegio)
si no, si paciente.monto_override_gs -> ese monto
si no                            -> tarifa del paciente
```
`montoBase({ tipoTurno, paciente, tarifas })`

## 3. Porcentaje aplicable
```
turno.porcentaje_manual (excepción "a criterio", con motivo)  -> prioridad máxima
regla del paciente para ese estado
regla general del consultorio
ninguna -> error (no inventar)
```

**"¿Se cobra?" al cancelar tarde.** Si la familia avisa tarde, el formulario Cancelar pregunta
**Se cobra (Gs. …)** / **No se cobra** (por defecto, Se cobra). El monto sale de la misma cuenta que el
cargo. Si no hay nada para cobrar (regla en 0% o tipo sin cobro), no pregunta. "No se cobra" guarda
`aviso_tardio` con `porcentaje_manual = 0` y motivo ("Excepción al cancelar" si no se escribe otro): es
la misma excepción de siempre, y después se puede cambiar o quitar con la acción Excepción.

## 4. Cargo de un turno
- Solo `clase = 'turno'` cuyo tipo tenga `genera_cobro = true`.
- `monto = Math.round(montoBase * porcentaje / 100)`. Se crea **aunque sea 0** (así aparece en el detalle).
- Un cargo por turno (`turno_id` único). Cambiar el estado actualiza el cargo; volver a `agendado` lo borra.
- `fecha` = día del turno en hora de Asunción; `periodo` = primer día de ese mes.
- `tutor_id` = responsable de pago del paciente.
- `snapshot`: `{ tarifa, monto_base, estado, porcentaje, origen_regla: 'manual'|'paciente'|'consultorio' }`.
- El plan del paciente (por sesión, semanal, mensual) NO cambia el monto: cambia cuándo se pide el pago.

`calcularCargoTurno({ turno, tipoTurno, paciente, montoBase, reglas }) -> { monto, porcentaje, snapshot } | null`

## 5. Saldo, imputación y vencimiento
- Saldo del tutor = suma(cargos) − suma(pagos). Positivo debe, negativo a favor.
- Imputación FIFO: los pagos cancelan los cargos más viejos primero.
  `imputarPagos({ cargos, pagos }) -> [{ cargo_id, pagado, pendiente, pagos: [...] }]`
- Vencimiento de cada cargo según el plan del paciente:
  - `por_sesion`: el mismo día.
  - `semanal`: el domingo de esa semana + 3 días.
  - `mensual`: día `dia_limite_pago` (10) del mes siguiente.
  - Tipo con `cobra_en_el_momento` (entrevista y anamnesis): el mismo día, cualquiera sea el plan.
- Atraso = cargos con pendiente > 0 y vencimiento < hoy. Mostrar días del más viejo.

## 6. Monto del período (mensaje)
- Semana = lunes a domingo. Mes = mes calendario.
- Total = cargos del tutor con fecha en el período − lo imputado a esos cargos.
- El mensaje se sugiere el día del último turno del período de cualquiera de sus hijos (ver mensajes.md).

## 7. Para facturar (mensual)
- El último día del mes `M`, listar los pagos con fecha en `M` y `factura_id` nulo, **agrupados por tutor**
  (una factura por familia por mes).
- Columnas: tutor, documento (RUC + DV o CI), razón social (o nombre y apellido), email, monto total,
  IVA 10% (`Math.round(monto / 11)`), medios de pago, concepto.
- Concepto: `"{concepto_factura} – sesiones de {meses}"`, donde `{meses}` sale de la imputación: los meses
  de servicio de los cargos que cubrieron esos pagos (ej. "septiembre 2026" o "septiembre y octubre 2026").
- Al cargar el número de factura (`001-001-0000123`, no se repite en el consultorio): crear `facturas` y poner `factura_id` en esos pagos, todo junto (función `crear_factura`, migración 0012). `emitida_en` = día en Asunción.
- Si una familia paga después de facturar, esos pagos forman una fila nueva con el aviso "Ya tiene factura este mes" y llevan otra factura. Lo normal sigue siendo una por familia y mes.
- Deshacer saca la factura de la app y sus pagos vuelven a la lista. **No la anula en Marangatu**, y la confirmación lo dice.

## 8. Reportes
- Generado (día / mes) = suma de cargos con esa fecha.
- Proyección del mes = generado del mes + Σ(monto base de turnos `agendado` que quedan en el mes) ×
  (1 − tasa de ausencias sin cobro de los últimos 3 meses). Con menos de 20 turnos de historia, tasa 0.
  - "Que quedan" = clase `turno`, tipo con `genera_cobro`, desde hoy inclusive hasta fin de mes. Los de
    días pasados sin marcar no entran y la pantalla avisa cuántos son. Un paciente sin tarifa tampoco
    entra, y también se avisa. Los meses que ya terminaron no muestran proyección.
  - "Últimos 3 meses" = los 3 meses calendario anteriores al mes del reporte. Solo cuentan los turnos
    con cargo: un tipo que no genera cobro no es una ausencia.
- Cobrado del mes = suma de pagos con fecha en el mes.
- Pendiente del mes = lo generado en ese mes que todavía no se pagó, con la imputación FIFO de la
  sección 5. Puede no coincidir con el total de Cobros, que suma las deudas de todos los meses.
- Horas trabajadas = duración de turnos `presente` + bloques `ocupado` de reunión o colegio, solo los
  que ya terminaron. "Marcar ocupado" no guarda tipo de turno: se reconocen por las palabras "reunión"
  o "colegio" en el motivo. El motivo se usa solo para esto: no se muestra ni se exporta.
- **Sin confirmar por Daniela:** los criterios de horas trabajadas y de ausencias sin cobro. Se cambian
  en `src/lib/cobro/criterios-reportes.ts`.

## Casos de prueba obligatorios
Datos: Regular Gs. 290.000, Económica 280.000, Domicilio 350.000, Evaluación 280.000; aviso mínimo 48 h (solo para los
tests: el valor real se carga en Configuración y el de Daniela es 24 h);
reglas por defecto (100 / 0 / 100 / 100 / 0 / 0); plazo de pago día 10.

| # | Caso | Esperado |
|---|---|---|
| 1 | Presente, tarifa regular | Gs. 290.000 |
| 2 | Canceló 72 h antes | `ausente_con_aviso`, Gs. 0 |
| 3 | Canceló exactamente 48 h antes | `ausente_con_aviso`, Gs. 0 |
| 4 | Canceló 47 h antes | `aviso_tardio`, Gs. 290.000 |
| 5 | Canceló el mismo día, después de la hora | `aviso_tardio`, Gs. 290.000 |
| 6 | Sin aviso | Gs. 290.000 |
| 7 | Cancela la profesional | Gs. 0 y `reponer` |
| 8 | Sesión a domicilio (tipo con tarifa Domicilio) aunque el paciente sea Económica | Gs. 350.000 |
| 9 | Paciente con precio especial 250.000, sesión en consultorio | Gs. 250.000 |
| 10 | Aviso tardío con excepción manual 0% y motivo | Gs. 0, origen 'manual' |
| 11 | Excepción manual 50% con tarifa 285.555 (redondeo) | Gs. 142.778 |
| 12 | Reunión de equipo (no genera cobro) | `null` |
| 13 | Turno `agendado` | `null` |
| 14 | Falta la regla del estado | error |
| 15 | FIFO: cargos sep 580.000 y oct 870.000, pago 1.000.000 | sep pagado; oct pendiente 450.000 |
| 16 | Atraso: plan mensual, cargo de octubre impago, hoy 11/11 | en atraso, 1 día |
| 17 | Mismo caso, hoy 10/11 | sin atraso |
| 18 | Entrevista (cobra en el momento), plan mensual, impaga al día siguiente | en atraso |
| 19 | Factura de noviembre: pagos de 1/11 (580.000, cubre septiembre) y 5/11 (870.000, cubre octubre) del mismo tutor | 1 factura de Gs. 1.450.000, IVA 131.818, concepto "… – sesiones de septiembre y octubre 2026" |
| 20 | Monto semanal: 2 sesiones presentes lun y jue, ya pagó 290.000 | Gs. 290.000 |
| 21 | Proyección: generado 2.900.000, quedan 5 turnos regulares, tasa 10% | Gs. 4.205.000 |
| 22 | Dos hermanos con el mismo tutor: monto del mes suma los dos | un solo total |
