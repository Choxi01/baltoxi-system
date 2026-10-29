# Supabase: variables, migraciones y tipos

Proyectos: `pruebas` (ref `onwdydztprleaijfnycr`, ya tiene las migraciones 0001 a 0004).
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
