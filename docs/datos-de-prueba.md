# Datos de prueba (`supabase/seed.sql`)

Datos **inventados** para probar la app en el proyecto `pruebas`. Nunca en producción.

## Qué carga
- **Consultorio:** datos ficticios de la profesional, del RUC y de pago; aviso mínimo de 24 h (como trabaja la profesional). El nombre del consultorio no se toca.
- **Tarifas:** Regular 290.000, Económica 280.000, Domicilio 350.000, Evaluación 280.000, Colegio 350.000.
- **12 tutores y 15 pacientes:**
  - 3 familias con dos hermanos (Benitez, Gimenez y Ortiz).
  - Planes: 3 por sesión, 4 semanales y 8 mensuales.
  - Casos especiales: Sofia Rolon tiene precio especial (250.000), los Ortiz pagan tarifa Económica y Joaquin Cabrera tiene sesiones a domicilio.
  - Excepción por paciente: a Benjamin Ortiz el aviso tardío se le cobra al 50%.
- **Agenda:**
  - 25 turnos fijos por semana.
  - Las últimas 4 semanas ya marcadas (mayoría "vino", y además canceló con aviso, aviso tardío, no vino, cancelé yo y un reprogramado).
  - Las próximas 4 semanas agendadas.
  - Un "Reservado: Fulano de Prueba", una reunión de equipo y un feriado de prueba (viernes de la semana que viene).
- **Cobros:**
  - Un cargo por cada turno pasado, según `docs/reglas-cobro.md`. Incluye una excepción manual al 0%.
  - Pagos completos, parciales, una familia sin pagar (Jorge Rolon, en atraso) y una con saldo a favor (Miguel Ayala).
- **Expediente:** 2 notas (una fijada) y 1 anamnesis con una plantilla de prueba.

Las fechas se calculan desde el día en que se carga, así que siempre quedan "actuales".

## Cómo cargarlo (paso a paso)
1. **Antes, una sola vez:** ingresá a la app (vista previa o local) y creá tu consultorio. El seed lo
   llena; si no hay ninguno, no hace nada.
2. Abrí Supabase → proyecto **`pruebas`** → **SQL Editor** → **New query**.
3. Copiá todo el contenido de `supabase/seed.sql` y pegalo.
4. Tocá **Run**. Abajo tiene que aparecer "Success. No rows returned".
5. Abrí la app y recargá la página.

**Volver a cargarlo:** repetí los pasos 2 a 5. Primero borra los datos de prueba anteriores (pacientes,
tutores, turnos, cobros, notas y anamnesis de ese consultorio) y después los vuelve a crear con las
fechas de ese día.

## Seguridad
- **Solo `pruebas`.** Fijate arriba en Supabase que el proyecto elegido sea `pruebas` antes de tocar Run.
- **Freno automático:** el seed se niega a correr si encuentra tutores con un email que no termina en
  `@ejemplo.test`. Así no borra datos reales por error.
- **Todo inventado:** nombres, documentos, teléfonos (`5959810000xx`) y textos. Nunca agregues datos reales acá.

## Si algo falla
- **"Este consultorio tiene tutores que no son de prueba":** hay tutores cargados a mano. Borralos
  desde la app o usá otro consultorio.
- **Cualquier otro error:** copiá el mensaje y pasáselo a Claude Code.
