# Mensajes — especificación

Canal: WhatsApp (las familias casi no usan email). Tono: de vos, cercano.

## MVP: copiar o abrir WhatsApp
Cada mensaje tiene dos botones: **Copiar** (portapapeles) y **Abrir WhatsApp**
(`https://wa.me/<telefono_wa>?text=<encodeURIComponent(texto)>`). Al usar cualquiera de los dos se
registra en `mensajes_enviados` (para tachar y no repetir).

## Plantillas (`plantillas_mensaje`, editables en Configuración)
Variables: `{tutor}` (nombre de pila), `{paciente}` (nombre de pila; si son dos hijos, "Tomi y Sofi"),
`{dia}` ("martes 4/11"), `{hora}` ("15:00"), `{periodo}` ("octubre", "la semana del 3 al 7/11"),
`{total}` ("Gs. 1.160.000"), `{datos_pago}`, `{rango}`, `{libres}`, `{link_ficha}`, `{detalle}`.

| Clave | Cuándo aparece en "Mensajes de hoy" |
|---|---|
| `recordatorio_sesion` | Turnos `agendado` de mañana (uno por tutor responsable) |
| `monto_periodo` | Plan mensual: el día del ÚLTIMO turno del mes de ese paciente (si tiene hermanos, el último de cualquiera de ellos). Plan semanal: el último turno de la semana. |
| `recordatorio_pago` | Desde el día `dia_limite_pago + 1`, a tutores con saldo de meses anteriores > 0 (una vez por semana como máximo) |
| `cambio_turno` / `cancelacion_turno` | Al mover o cancelar (no va a la bandeja: se ofrece en el momento) |
| `horarios_libres` | Desde la agenda (botones Copiar libres) |
| `bienvenida` | Pacientes nuevos y, una sola vez, a todas las familias al empezar a usar el sistema |

### Monto del período
- Por defecto solo el total (como lo manda hoy). Interruptor "Agregar detalle" suma `{detalle}`:
  ```
  • 03/10 Tomi – Sesión – Gs. 290.000
  • 10/10 Tomi – Canceló con menos de 48 h – Gs. 290.000
  ```
- Total = cargos del período del tutor (todos sus hijos) − pagos ya imputados a ese período.
- Si el total es 0 o negativo, no se sugiere el mensaje.

## Bandeja "Mensajes de hoy"
Pantalla con tres grupos (Recordatorios de mañana, Montos de hoy, Pagos atrasados). Cada fila:
tutor, paciente, vista previa, botones Copiar / Abrir WhatsApp, y queda tachada al usarla.
Contador en el menú. Función pura con tests: `src/lib/mensajes/pendientesDelDia(fecha, datos)`.

## Fase 2: envío automático (WhatsApp Cloud API)
- Número del consultorio en **coexistencia** (la app de WhatsApp Business sigue funcionando en el
  celular). Confirmar disponibilidad en Paraguay antes de empezar.
- Plantillas aprobadas por Meta de categoría **utilidad** (recordatorio, monto, pago pendiente).
  Una plantilla mal categorizada como marketing cuesta ~6,5 veces más.
- Cada plantilla de la app tiene un interruptor "Enviar automáticamente". Envío desde un job programado
  (por ejemplo 18:00 para recordatorios de mañana), registrando `canal = 'automatico'`.
- Trámite con Meta (cuenta comercial, número, plantillas) se puede empezar durante el MVP.
