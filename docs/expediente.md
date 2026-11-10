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
6. **Turnos y cuenta**: próximos turnos, historial de asistencia y la cuenta del responsable de pago (cargos,
   pagos y saldo de toda la familia), de solo lectura. Los pagos y el mensaje de monto están en Cobros.
7. **Reglamento**: firmado o no, versión, fecha, quién firmó.

## Documentos (Supabase Storage)
- Bucket privado `documentos` (migración 0002). Ruta: `<consultorio_id>/<paciente_id>/<uuid>.<ext>`.
- Subida desde el navegador con el cliente autenticado (las políticas validan la carpeta del consultorio).
- Antes de subir, achicar imágenes en el dispositivo: lado mayor 2000 px, JPEG calidad 0,8.
  PDF tal cual (máximo 15 MB).
- Abrir siempre con `createSignedUrl(ruta, 300)` (5 minutos). Nunca URL pública ni guardada.
- Borrar documento = borrar objeto + fila (confirmación en pantalla). Primero el archivo: si no se
  pudo borrar, la fila queda.
- **Cómo está hecho (tarea A7):**
  1. `prepararSubida` (servidor) arma la ruta con un uuid; nunca el título ni el nombre original.
  2. El navegador sube el archivo directo al bucket con la sesión de la profesional.
  3. `registrarDocumento` (servidor) verifica que la ruta sea de ese consultorio y paciente
     (`rutaValida`), que el archivo esté en el bucket y su tamaño (lo lee del bucket), y guarda la fila.
     Si algo falla, el archivo se borra (`descartarSubida`).
  - "Sacar foto" abre la cámara de atrás; "Elegir archivo" acepta fotos y PDF. Las fotos (también HEIC)
    se achican en un canvas a JPEG (`src/lib/documentos/achicar.ts`).
  - "Ver" pide el link firmado al tocarlo; la imagen se ve ahí mismo y el PDF con "Abrir PDF". El link
    solo vive en la pantalla.
  - Migración 0010: el bucket rechaza archivos de más de 15 MB o que no sean JPEG o PDF.
  - Código: `src/lib/documentos/` (`reglas.ts` con tests, `acciones.ts`, `datos.ts`) y
    `src/app/(app)/pacientes/[id]/tab-documentos.tsx`.
  - Pendiente para la 8.1: al borrar un paciente, la base borra sus filas de documentos pero los
    archivos quedan en el bucket.

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
- **Editor (tarea A6a)**, Configuración > Anamnesis:
  - Lista de plantillas con "Editar" y "Activar/Desactivar". Las plantillas **no se borran** (cada
    anamnesis guarda de qué plantilla viene): se desactivan y dejan de ofrecerse para anamnesis nuevas.
  - El editor ocupa toda la pestaña: nombre, secciones con título y preguntas con su tipo (Texto corto,
    Texto largo, Sí / No, Elegir una opción, Fecha). Botones grandes para subir, bajar y quitar
    secciones y preguntas (con confirmación si tienen contenido). Las opciones se escriben una por
    renglón. Se guarda con el botón "Guardar plantilla"; si salís con cambios, pregunta antes.
  - Validación (`validarPlantilla`, zod): nombre hasta 100 letras; de 1 a 40 secciones con título
    (hasta 150); de 1 a 60 preguntas por sección y hasta 400 en total; pregunta hasta 300 letras;
    opciones de 2 a 30, sin vacías ni repetidas, hasta 100 letras cada una. Los problemas se muestran al
    lado de cada campo y en una lista arriba del botón. El servidor vuelve a validar todo.
  - El `id` de cada pregunta se arma con el texto al crearla ("¿Tipo de parto?" → `tipo_de_parto`,
    `tipo_de_parto_2` si ya existe) y **no cambia** aunque después la renombres: las respuestas se
    guardan por `id`. Debe ser único en toda la plantilla.
  - Cambiar una plantilla no modifica las anamnesis ya creadas (cada una tiene su copia).
  - Código: `src/lib/anamnesis/estructura.ts` (esquema, `validarEstructura`, `validarPlantilla`,
    `idParaCampo`, `mover`, `copiarEstructura`) y `borrador.ts` (operaciones del editor), con tests;
    `acciones-plantillas.ts`, `datos-plantillas.ts` y `src/app/(app)/config/tab-anamnesis.tsx`.
- **Pestaña Anamnesis del expediente (tarea A6b)**:
  - Sin anamnesis: elegir una plantilla activa y "Crear anamnesis" (se copia la estructura y la fecha es
    la de hoy). Puede haber varias por paciente (ej. reevaluación): un selector muestra fecha · plantilla,
    la más nueva primero. No se borran ni se les cambia la fecha (por ahora).
  - Formulario por tipo: texto corto (hasta 1.000 letras), texto largo (hasta 10.000), Sí / No con botones
    (tocar el elegido lo borra), opciones con "Sin responder" y fecha con el selector del sistema.
  - Guardado automático: 2 s después de dejar de escribir y al salir de un campo; arriba dice cuántas
    están respondidas y "Guardando…" / "Guardado" / "No se pudo guardar. Reintentando…" (cada 5 s). Si
    se cierra la pantalla con cambios sin guardar, pregunta. Si se edita en dos aparatos a la vez, gana
    el último que guarda.
  - Respuestas en `anamnesis.respuestas` como `{campo_id: valor}` (Sí / No es boolean; fecha "AAAA-MM-DD");
    lo vacío no se guarda. El servidor valida todo contra la estructura copiada; los errores nombran la
    pregunta pero nunca lo respondido.
  - "Leer e imprimir": `/pacientes/<id>/anamnesis/<id>`, de solo lectura, con botón Imprimir (el del
    navegador; el menú no sale en papel). El título de la pestaña no lleva el nombre del paciente.
  - Código: `src/lib/anamnesis/respuestas.ts` (`validarRespuestas`, `leerRespuestas`, `textoRespuesta`,
    con tests), `acciones-anamnesis.ts`, `datos-anamnesis.ts` y `src/app/(app)/pacientes/[id]/tab-anamnesis.tsx`.
  - Para la 8.1: cada guardado automático deja en `auditoria` una copia completa de las respuestas.

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
- **Cómo está hecho (tarea A8a):**
  - `src/app/ficha/[token]/page.tsx` carga todo en el servidor con el cliente admin
    (`src/lib/ficha/servidor.ts`). Cada consulta pide solo columnas administrativas: el tutor
    (nombre, contacto, factura), sus hijos (nombre, apellido, nacimiento, colegio) y los otros tutores
    de esos hijos (solo nombre y parentesco, sin teléfonos).
  - Guardar (`src/lib/ficha/acciones.ts`): datos del tutor (reutiliza `validarDatosTutor`), de cada
    hijo (`validarHijoFicha`) y agregar otro tutor con parentesco y WhatsApp (`validarOtroTutor`),
    que queda vinculado a todos sus hijos.
  - **Límite de intentos** (`intentos_publicos`, claves con hash): 10 links inválidos por hora por IP
    (frena a quien prueba links) y 30 guardados por hora por link. Mirar la ficha no cuenta. La IP y
    el token se guardan solo como hash (HMAC con la service role).
  - Link inválido, tutor dado de baja o demasiados intentos: la misma pantalla, sin decir cuál.
    La página no se indexa y no manda el link a otras páginas (`referrer: no-referrer`).
  - **"Actualizado por la familia"** (migración 0011, `cambios_familia_en` en tutores y pacientes):
    el expediente muestra un aviso con quién cambió y el botón **Visto**, que lo borra.
- **Reglamento (tarea A8b):**
  - Configuración > Reglamento: el texto se edita ahí. Si cambia (sin contar espacios al final), la
    versión sube y las familias lo tienen que volver a aceptar; la primera carga (sin texto antes) no
    sube la versión. Si otra pestaña lo cambió mientras tanto, no se pisa (`guardarReglamento`).
  - En la ficha: el texto, nombre completo, cédula y "Leí y acepto". Se guarda en `reglamento_firmas`
    una copia exacta del texto, la versión y el hash de la IP. Si la versión cambió mientras la familia
    leía, no se firma y se le pide recargar. Si ya aceptó la versión actual: "Ya aceptaste el reglamento
    el 7/11/2026". Sin texto cargado, la ficha no muestra la sección.
  - En el expediente, pestaña Tutores, cada tutor muestra "Aceptado el … (versión N)", "Aceptó la
    versión 1; falta aceptar la 2" o "Sin aceptar".
  - Código: `src/lib/ficha/reglamento.ts` (con tests), `firmarReglamento` en `src/lib/ficha/acciones.ts`,
    `src/lib/config/acciones-reglamento.ts` y `src/lib/ficha/datos-expediente.ts`.

## Seguridad
- Ingreso con email + contraseña + código TOTP (Supabase MFA, app Autenticador del iPhone).
- Sesión: tras 24 h sin uso o al tocar Salir pide la contraseña; el código, en un navegador nuevo o
  cada 30 días (dispositivo de confianza, ver `docs/supabase.md`).
- Nada clínico (motivo, notas, anamnesis, documentos) en mensajes, facturas, reportes, logs, nombres
  de archivo ni en la ficha pública.
- Backups: Supabase Pro (diario) + copia semanal propia de base y documentos (tarea A9).
