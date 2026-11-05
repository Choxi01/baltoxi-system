# Expediente del paciente — especificación

Datos de salud de menores: máxima prioridad de privacidad. Solo la profesional accede.

## Pestañas de la ficha
1. **Datos**: nombre, apellido, fecha de nacimiento (mostrar edad en años y meses), colegio, derivado
   por, motivo de consulta, estado (activo, pausa, alta), tarifa, precio especial, forma de pago
   (por sesión, semanal, mensual), responsable de pago.
2. **Tutores**: lista de `paciente_tutores` con parentesco. Agregar existente o crear nuevo. Un tutor
   puede tener varios hijos. Datos de factura en el tutor. Botón "Copiar link de la ficha".
3. **Anamnesis**: formulario generado desde `plantillas_anamnesis.estructura` (se arma a partir del
   Word de ejemplo de la profesional). Al crear una anamnesis se copia la estructura (por si la
   plantilla cambia). Guardado automático. Vista para leer e imprimir desde el navegador del dispositivo.
4. **Notas**: lista por fecha, la más nueva arriba. Nota fijada siempre visible arriba de la ficha.
   Desde un turno de la agenda: "Agregar nota de esta sesión" (guarda `turno_id`).
   - Crear, editar, fijar y borrar (con confirmación). **Una sola fijada por paciente**: al fijar
     otra, la anterior se desfija. La fijada se ve en una tarjeta arriba de las pestañas.
   - Texto obligatorio (hasta 10.000 letras); fecha sin futuro. Al editar se guarda `actualizado_en`
     y la nota dice "Editada".
   - "Agregar nota de esta sesión" aparece en el turno (Agenda y Hoy) si tiene paciente, es de hoy o
     de antes y no se canceló ni se movió. Abre `/pacientes/<id>?pestana=notas&turno=<id>` con el
     formulario listo y la fecha de la sesión (solo ids en la dirección). El servidor verifica que el
     turno sea de ese paciente.
   - Código: `src/lib/pacientes/notas.ts` (`validarNota`, `ordenarNotas`, con tests),
     `acciones-notas.ts` y `src/app/(app)/pacientes/[id]/tab-notas.tsx`. Los errores son genéricos:
     nunca llevan el texto de la nota.
   - Pendiente para la 8.1: la tabla `auditoria` guarda una copia de cada nota (con el texto) al
     crearla, editarla o borrarla.
5. **Documentos**: subir desde cámara o archivos. Tipos: cédula, análisis, informe, certificado, otro.
   Título y fecha. Vista previa de imágenes y PDF.
6. **Turnos y cuenta**: próximos turnos, historial de asistencia, cargos, pagos, saldo.
7. **Reglamento**: firmado o no, versión, fecha, quién firmó.

## Documentos (Supabase Storage)
- Bucket privado `documentos` (migración 0002). Ruta: `<consultorio_id>/<paciente_id>/<uuid>.<ext>`.
- Subida desde el navegador con el cliente autenticado (las políticas validan la carpeta del consultorio).
- Antes de subir, achicar imágenes en el dispositivo: lado mayor 2000 px, JPEG calidad 0,8.
  PDF tal cual (máximo 15 MB).
- Abrir siempre con `createSignedUrl(ruta, 300)` (5 minutos). Nunca URL pública ni guardada.
- Borrar documento = borrar objeto + fila (confirmación en pantalla).

## Plantilla de anamnesis
Estructura JSON:
```json
{"secciones":[{"titulo":"Datos del embarazo y parto","campos":[
  {"id":"embarazo","etiqueta":"¿Cómo fue el embarazo?","tipo":"largo"},
  {"id":"parto_tipo","etiqueta":"Tipo de parto","tipo":"opciones","opciones":["Natural","Cesárea"]},
  {"id":"semanas","etiqueta":"Semanas de gestación","tipo":"texto"}]}]}
```
Tipos de campo: `texto`, `largo`, `si_no`, `opciones`, `fecha`. Editor simple en Configuración
(agregar sección, agregar campo, reordenar). La primera plantilla se carga a partir del Word de la
profesional (tarea A6).

## Ficha online para familias (`/ficha/<token_ficha>`, pública)
- Única página pública. Corre en el servidor con el cliente admin; valida el token; límite de 10
  intentos por hora por IP (`intentos_publicos`).
- Muestra: datos del tutor (editables), sus hijos (nombre, apellido, fecha de nacimiento, colegio:
  editables), otros tutores (agregar con parentesco y WhatsApp), datos de factura.
- **Nunca** muestra motivo de consulta, notas, anamnesis ni documentos.
- Reglamento: texto de `consultorios.reglamento_texto`; para aceptar pide nombre completo y cédula y
  un tilde "Leí y acepto". Guarda en `reglamento_firmas` con copia del texto, versión y hash de IP.
- Los cambios hechos por la familia quedan en auditoría y se marcan "actualizado por la familia" en la
  ficha hasta que la profesional los vea.

## Seguridad
- Ingreso con email + contraseña + código TOTP (Supabase MFA, app Autenticador del iPhone).
- Sesión: tras 24 h sin uso o al tocar Salir pide la contraseña; el código, en un navegador nuevo o
  cada 30 días (dispositivo de confianza, ver `docs/supabase.md`).
- Nada clínico (motivo, notas, anamnesis, documentos) en mensajes, facturas, reportes, logs, nombres
  de archivo ni en la ficha pública.
- Backups: Supabase Pro (diario) + copia semanal propia de base y documentos (tarea A9).
