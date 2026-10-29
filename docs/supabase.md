# Supabase: variables, migraciones y tipos

Proyectos: `pruebas` (ref `onwdydztprleaijfnycr`, ya tiene las migraciones 0001 a 0006).
`produccion` se crea en la semana 8 (región São Paulo, `sa-east-1`, plan Pro).

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
- `admin.ts` → `crearClienteAdmin()`: saltea RLS. Solo servidor y solo para la ficha pública
  y las copias. Si se importa en el navegador, el build falla.
- `src/proxy.ts` renueva la sesión en cada pedido.

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

## 6. Cuando exista producción
```bash
npx supabase link --project-ref <ref-de-produccion>
npm run db:push
npx supabase link --project-ref onwdydztprleaijfnycr
```
(El último paso vuelve a dejar vinculado `pruebas`.)

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
