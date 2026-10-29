import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

// Renueva la sesión de Supabase en cada pedido (la llama src/proxy.ts).
// Las rutas protegidas y la redirección al login se agregan en la tarea 0.3.
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  // Sin variables de Supabase (ej. un deploy sin configurar) no hay sesión
  // que renovar: dejamos pasar en vez de romper todas las páginas.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return respuesta;
  }

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  // No poner código entre createServerClient y getClaims(): getClaims()
  // valida el token y, si venció, lo renueva y escribe las cookies nuevas.
  await supabase.auth.getClaims();

  return respuesta;
}
