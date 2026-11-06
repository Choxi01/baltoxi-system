# Pedidos de Daniela (2/11/2026)

Notas de Baltu después de mostrarle la app a Daniela. Para cada pedido: qué pidió, cómo está hoy en el
código (commit `fe13898`), una propuesta y a quién le toca (A = agenda y expediente, B = cobros y
mensajes). La idea es sumarlos a `docs/tareas.md` donde mejor encajen.

| # | Pedido | Quién | Tamaño | Cuándo (propuesta) |
|---|---|---|---|---|
| 1 | Al cancelar tarde, preguntar "¿Se cobra?" | A + B | Chico | Ya (antes de la 8.2) |
| 2 | Sesiones grupales y dobles (también como turno fijo) | A + B | Grande | Antes de la 8.2: cambia la base |
| 3 | Franja gris en el almuerzo (vista Semana) | A | Chico | Junto con el 4 |
| 4 | Semana por defecto en todos los dispositivos | A | Chico | Ya |
| 5 | Color por tipo de turno; asistencia en el borde | A + B1b | Mediano | Ya |
| 6 | Generado día por día y por mes, más la proyección | B (B8) | Mediano | Se suma a la B8 |

---

## 1. Al cancelar tarde, preguntar si se cobra

**Pedido.** Si la familia cancela con menos del aviso mínimo, por lo general se cobra, pero a veces
Daniela hace una excepción. Quiere que, al cancelar, aparezca en el momento la pregunta "¿Se cobra?"
en vez de tener que buscar después la acción Excepción.

**Hoy.** `FormularioCancelar` (`agenda/acciones-turno.tsx`) clasifica solo con `clasificarCancelacion`:
si es tarde queda `aviso_tardio` y se cobra el 100%. Para no cobrar hay que abrir después
**Excepción** y poner 0% con motivo. O sea, ya se puede, pero son dos pasos.

**Propuesta.**
- En el mismo formulario de Cancelar, cuando la clasificación da `aviso_tardio`, mostrar debajo:
  **Se cobra (Gs. 290.000)** / **No se cobra**. Por defecto, "Se cobra".
- "No se cobra" guarda el turno como `aviso_tardio` con `porcentaje_manual = 0` y un motivo corto
  (opcional, con "Excepción al cancelar" por defecto). Es la misma excepción que ya existe, así que
  `calcularCargoTurno` y los tests de `reglas-cobro.md` no cambian.
- Opcional: un tercer botón "Otro %" que abra lo mismo que Excepción.

**Ojo.** `docs/reglas-cobro.md` y el seed dicen **48 h** de aviso mínimo, pero Daniela cobra con
**menos de 24 h**. Es un valor de Configuración (`horas_aviso_minimas`), pero conviene corregir el seed
y el ejemplo del doc para no confundirnos al comparar con su Excel en la 8.2.

---

## 2. Sesiones grupales y sesiones dobles

**Pedido.**
- Hoy se pueden poner a mano dos turnos en el mismo horario (con la confirmación de superposición),
  pero no se puede crear un **turno fijo con varios chicos**.
- Distinguir dos clases:
  - **Sesión doble**: dos compañeritos juntos (nunca hermanos).
  - **Sesión grupal**: tres o cuatro chicos.
- Que se agenden de a dos (o de a varios) **según el tipo de sesión**.

**Hoy.** La tabla `turnos` tiene un solo `paciente_id`, y `series_turnos` también. Cada turno es de un
paciente por diseño; en ningún doc ni tarea aparece lo grupal.

**Respuestas de Daniela.**
- **Máximo en una grupal:** 4 chicos.
- **Duración:** igual que una individual.
- **Cobro:** cada familia paga una sesión entera, como una individual. No se reparte el precio.
- **Sesión doble:** nunca es de hermanos, son compañeritos. Cada chico tiene su propia familia y su
  propio cobro, lo que confirma el modelo de un turno por chico con `grupo_id`.

**Propuesta.**
- **Base.** En `tipos_turno`, agregar `cupo` (1 = individual, 2 = doble, hasta 4 = grupal) o una
  columna `clase` (`individual` / `doble` / `grupal`) más `cupo_maximo`. Modelo confirmado: un
  **turno por chico** unidos por un `grupo_id`. Cada chico tiene su propio estado (vino / no vino /
  canceló) y su propio cargo, y el motor de cobro casi no cambia, porque la asistencia y el cobro
  siguen siendo por paciente.
- **Agenda.** Al reservar o crear un turno fijo con un tipo doble o grupal, elegir 2 o N pacientes. En
  la grilla se ve como **un rectángulo** con los nombres ("Juan + Pedro" o "Grupal · 4"); al tocarlo,
  la asistencia se marca por chico. Mover o cancelar mueve el grupo entero, con la opción de sacar a
  un solo chico.
- **Cobro (B).** Cada chico genera su propio cargo por una sesión entera, igual que una individual,
  al responsable de pago de su familia. Si un chico del grupo cancela tarde, se le cobra solo a él.

**Por qué antes de la 8.2.** Cambia la base y toca agenda, asistencia, series y cobro. Si se carga el
mes real con un solo paciente por turno, después hay que migrar datos.

---

## 3. Franja gris en el almuerzo

**Pedido.** En la vista Semana, la hora del almuerzo tiene que verse como una franja gris de "no
disponible". Es solo visual, para que ella lo vea de un vistazo.

**Hoy.** El horario se carga por tramos (`bloquesDelDia`, horario partido). El hueco entre la mañana y
la tarde simplemente no aparece como bloque.

**Propuesta.** En `VistaSemana`, cuando entre dos tramos del mismo día hay un hueco, dibujar una fila
gris rayada con el texto "Almuerzo" (o "No disponible"), alineada en todas las columnas. No reservable
ni clickeable. Si los días tienen almuerzos distintos, la franja se dibuja solo donde corresponde.
Opcional: un campo "Nombre del corte" en Configuración > Horario.

---

## 4. Semana como vista por defecto

**Pedido.** La vista que más va a usar es **Semana**; Día, muy rara vez. Al tocar Agenda en el menú
siempre tiene que abrir Semana, y Día queda como botón para cambiar.

**Hoy.** `agenda.tsx` usa `vista = "auto"`: Semana en pantalla grande y **Día en iPhone**
(`docs/agenda.md`, "Día por defecto en iPhone").

**Propuesta.** Por defecto `semana` en todos los dispositivos; el link del menú va siempre a Semana
(sin recordar la última vista). En iPhone, la grilla de 5 días tiene que entrar en el ancho: columnas
angostas con nombre corto, o deslizar de a días. Actualizar `docs/agenda.md`. Mes queda igual.

---

## 5. Color por tipo de turno y asistencia en el borde

**Pedido.** Cada rectángulo de turno se pinta del color de su **tipo de turno** (cualquier color, pero
uno por tipo). Hay que resolver cómo se sigue viendo si vino o no vino, que hoy se muestra con el
color.

**Hoy.** `colorTurno()` en `agenda/vistas.tsx` pinta por **estado**; reservado y ocupado, en gris.

**Propuesta.**
- **Relleno = tipo de turno.** Agregar `color` a `tipos_turno` (migración) y un selector de color en
  Configuración > Tipos de turno (B1b). Paleta fija de 8 a 10 colores suaves que se lean bien de día y
  de noche, en lugar de un color libre.
- **Estado = borde + ícono.** Agendado: borde fino del mismo tono. Vino: borde verde grueso y ✓. No
  vino: borde rojo y ✕. Canceló o aviso tardío: rectángulo tachado o semitransparente y ⦸. Excepción:
  un punto o "%". El ícono hace falta para no depender solo del color (accesibilidad, regla ya
  escrita en `vistas.tsx`).
- Una leyenda chica abajo de la grilla con los tipos y los estados.

---

## 6. Cuánto generó: día por día y por mes

**Pedido.** Ver cuánto generó **cada día** y en el **mes**, navegar día a día y tener un gráfico de
líneas de lo generado, además de la **proyección**. Quizás una vista por semana (lunes, martes,
miércoles…) para que sea simple y se vea el monto exacto.

**Hoy.** Reportes es la **B8** (todavía "En construcción"). `docs/reglas-cobro.md` sección 8 ya define
el generado de día y de mes y la proyección, con un gráfico de barras de 6 meses.

**Propuesta (lo hace B, se suma a la B8).**
- Arriba: **Generado hoy**, **Generado del mes**, **Proyección del mes**.
- **Semana:** una fila por día (Lun a Vie) con el monto exacto y una barrita. Flechas para ir de
  semana en semana. Tocar un día muestra sus turnos con el monto de cada uno.
- **Mes:** gráfico de líneas del generado acumulado día a día, con la línea de proyección punteada
  hasta fin de mes.
- Se mantiene la comparación de 6 meses.
- Opcional: el generado del día también en la pantalla **Hoy**, abajo de los turnos.

---

## Cambios a los docs si se aprueba
- `docs/tareas.md`: nuevas tareas (por ejemplo **A11** Grupales y dobles, **A12** Vista Semana: color,
  almuerzo y por defecto, **B9** Cobrar o no al cancelar) y ampliar **B8**.
- `docs/agenda.md`: vista por defecto, franja de almuerzo, colores, grupales.
- `docs/reglas-cobro.md`: cobro de grupales y "¿Se cobra?" al cancelar; aviso mínimo de 24 h.
- Migraciones: `tipos_turno.color`, cupo o clase del tipo y el modelo de grupo (`grupo_id` o tablas
  intermedias).
