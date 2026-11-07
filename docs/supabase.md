# Supabase: variables, migraciones y tipos

Proyectos: `pruebas` (ref `onwdydztprleaijfnycr`, ya tiene las migraciones 0001 a 0012).
Para confirmarlo: `npx supabase migration list` (columnas Local y Remote iguales).
`pruebas` está en la región Oregón (`us-west-2`). `produccion` se crea en la semana 8 en la región
**Ohio (`us-east-2`)**, plan Pro: la misma región que las funciones de Netlify (ver sección 6).

## 1. Variables en tu compu (`.env.local`)
Copiá `.env.example` a `.env.local` (Git lo ignora) y completá desde
Supabase > Project Settings > API Keys:

| Variable | De dónde sale | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`) o la anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) o la service_role | **SÍ**: nunca en el repo, nunca con `NEXT_PUBLIC_` |

## 2. Variables en Netlify
Netlify > Site configuration > Environment variables > Add a variable: las mismas tres.
Marcá `SUPABASE_SERVICE_ROLE_KEY` como secreta ("Contains secret values").
Después: Deploys > Trigger deploy > Deploy site.

## 3. Clientes en el código (`src/lib/supabase/`)
- `navegador.ts` → `crearClienteNavegador()` en componentes `"use client"`.
- `servidor.ts` → `await crearClienteServidor()` en páginas, acciones y rutas del servidor.
- `admin.ts` → `crearClienteAdmin()`: saltea RLS. Solo servidor y solo para la ficha pública,
  las copias y los dispositivos de confianza (`src/lib/auth/dispositivo-servidor.ts`: esas tablas
  no tienen políticas, así nadie las lee desde el navegador). Si se importa en el navegador, el build falla.
- `src/proxy.ts` renueva la sesión en cada pedido (usa `actualizarSesion` de `sesion.ts`).

### Medir la velocidad
`MEDIR_SUPABASE=1 npm run dev` anota en la terminal cada consulta a Supabase con lo que tardó, por
ejemplo `[supabase] GET turnos 200 · 182 ms`. Muestra solo el método y la tabla, nunca filtros ni
datos (regla de oro 7). Funciona solo en desarrollo (`src/lib/supabase/medir.ts`).
Reglas para que las pantallas sean rápidas:
- Pedir **a la vez** (`Promise.all`) todo lo que no depende de otra consulta: cada espera en fila
  suma un viaje completo a la base.
- `exigirConsultorio()` se puede llamar en cada lectura: se verifica una sola vez por pedido.
- Cada página nueva que lee datos lleva su `loading.tsx` en la misma carpeta.

## 4. CLI de Supabase (una vez por compu)
```bash
npx supabase login
npx supabase link --project-ref onwdydztprleaijfnycr
```

## 5. Cambios de base
1. Crear `supabase/migrations/NNNN_descripcion.sql` (el número siguiente). Nunca editar una aplicada.
2. `npm run db:push` → la aplica en el proyecto vinculado.
3. `npm run gen:types` → regenera `src/lib/supabase/types.ts`. Commitear los dos.
4. Avisar en el PR que hay migración nueva.
5. Confirmar con `npx supabase migration list` que quedó aplicada en `pruebas` y actualizar el número de arriba.

Si alguna vez se aplica sin el CLI (SQL Editor del panel o una herramienta de IA), registrarla
con el mismo número del archivo, por ejemplo `0007`, en `supabase_migrations.schema_migrations`.
Si queda con otro número (las herramientas suelen poner la fecha, tipo `20261031…`), `db:push`
la ve como una migración desconocida y deja de funcionar.

## 6. Cuando exista producción
```bash
npx supabase link --project-ref <ref-de-produccion>
npm run db:push
npx supabase link --project-ref onwdydztprleaijfnycr
```
(El último paso vuelve a dejar vinculado `pruebas`.)

### Región de producción: Ohio (`us-east-2`), decidido el 31/10/2026
- **La regla:** el servidor de la app (las funciones de Netlify) y la base tienen que estar en la
  **misma región**. Cada pantalla hace de 10 a 20 consultas a la base, una detrás de otra; si están
  lejos, cada consulta suma ese viaje. La distancia entre el iPhone y el servidor pesa una sola vez
  por pantalla.
- Netlify corre las funciones en Ohio (`us-east-2`) por defecto, y en nuestro panel no aparece la
  opción para elegir otra región (seguramente por el plan). Por eso producción va en Ohio y **no en São Paulo** (con Netlify en Ohio y la
  base en São Paulo, cada consulta cruzaría el continente: ~120 ms cada una).
- Los datos quedan guardados en Estados Unidos. Si algún día hace falta tenerlos en Sudamérica, hay
  que mover **las dos cosas juntas**: Netlify a São Paulo (plan pago o pedido a soporte) y la base a
  `sa-east-1` (proyecto nuevo, porque la región de un proyecto no se cambia).
- `pruebas` queda en Oregón (`us-west-2`): no vale la pena moverla. Por eso `npm run dev` desde
  Paraguay es más lento que la app publicada (cada consulta va de Asunción a Oregón y vuelve).
- Claves JWT: `pruebas` ya firma con **ECC (P-256)** (Settings > JWT Keys), así la sesión se verifica
  en el servidor sin consultar a Supabase. Crear `produccion` directamente con claves nuevas.

## 7. Ingreso (tarea 0.3)
Configuración en Supabase > Authentication (en cada proyecto):
1. **Sign In / Providers**: dejar Email activado y **desactivar "Allow new users to sign up"**
   (nadie de afuera puede crearse una cuenta).
2. **Users > Add user > Create new user**: email y contraseña de la profesional, con
   "Auto Confirm User" marcado.
3. **Multi-Factor**: TOTP (app Autenticador) viene activado; dejarlo así.
4. **URL Configuration**: Site URL = la dirección de Netlify.

Cómo funciona:
- `/ingresar` (email + contraseña) → `/codigo` (la primera vez, activar el Autenticador; en un
  navegador nuevo o cada 30 días, pedir el código) → si no tiene consultorio, `/nuevo-consultorio` → `/hoy`.
- Las reglas de qué ruta pide qué están en `src/lib/auth/acceso.ts` (con tests).
- El login es un formulario normal que se envía a `/ingresar/enviar` (no por JavaScript), así
  Safari y el llavero de iCloud ofrecen guardar la contraseña.
- La base también se protege (migraciones 0005 y 0006): con solo la contraseña, desde un navegador
  que no es de confianza, no se ve ningún dato.
- **Dispositivo de confianza** (`src/lib/auth/dispositivo.ts`, migración 0006): al poner el código,
  el navegador recibe una llave (cookie httpOnly `dispositivo`) por 30 días; en la base queda solo
  su huella. Al ingresar con contraseña desde ese navegador, el servidor marca la sesión como de
  confianza (`sesiones_confianza`) y entra sin código. La base muestra datos solo si la sesión tiene
  el código o está marcada (`sesion_verificada()`).
- Cuándo pide qué:

  | Situación | Pide |
  |---|---|
  | Mismo navegador, usado hace menos de 24 h | Nada |
  | Mismo navegador, después de Salir o de 24 h sin uso | Email + contraseña |
  | Navegador nuevo, o pasaron 30 días desde el último código | Email + contraseña + código |
