import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { decidirAcceso, RUTA_INGRESAR } from "@/lib/auth/acceso";
import { COOKIE_ULTIMO_USO, leerUltimoUso, sesionVencida } from "@/lib/auth/inactividad";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

// Corre en cada pedido (lo llama src/proxy.ts):
// 1. renueva la sesión de Supabase,
// 2. cierra la sesión si pasaron 12 h sin uso,
// 3. manda al login o al código según la ruta (ver src/lib/auth/acceso.ts).
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
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const ruta = request.nextUrl.pathname;
  const ahora = Date.now();

  if (claims) {
    const ultimoUso = leerUltimoUso(request.cookies.get(COOKIE_ULTIMO_USO)?.value);
    if (sesionVencida(ultimoUso, ahora)) {
      await supabase.auth.signOut();
      const destino = redirigir(request, respuesta, RUTA_INGRESAR);
      destino.cookies.delete(COOKIE_ULTIMO_USO);
      return destino;
    }
  }

  const decision = decidirAcceso(ruta, {
    logueado: Boolean(claims),
    nivel: claims?.aal ?? null,
  });
  const final = decision.tipo === "redirigir" ? redirigir(request, respuesta, decision.a) : respuesta;

  if (claims) {
    final.cookies.set(COOKIE_ULTIMO_USO, String(ahora), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return final;
}

// Redirección que conserva las cookies de sesión que Supabase acaba de escribir.
function redirigir(request: NextRequest, respuesta: NextResponse, ruta: string) {
  const url = request.nextUrl.clone();
  url.pathname = ruta;
  url.search = "";
  const redireccion = NextResponse.redirect(url);
  for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie);
  return redireccion;
}
