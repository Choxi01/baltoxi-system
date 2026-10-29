import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { decidirAcceso, RUTA_INGRESAR } from "@/lib/auth/acceso";
import {
  COOKIE_BLOQUEO,
  COOKIE_ULTIMO_USO,
  evaluarSesion,
  leerMilisegundos,
  momentosDeIngreso,
} from "@/lib/auth/inactividad";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

// Corre en cada pedido (lo llama src/proxy.ts):
// 1. renueva la sesión de Supabase,
// 2. cierra la sesión a los 30 días y la bloquea (pide solo el código) tras
//    24 h sin uso (ver src/lib/auth/inactividad.ts),
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

  let bloqueadaDesde: number | null = null;
  if (claims) {
    const evaluacion = evaluarSesion({
      ahora,
      ultimoUso: leerMilisegundos(request.cookies.get(COOKIE_ULTIMO_USO)?.value),
      bloqueadaDesde: leerMilisegundos(request.cookies.get(COOKIE_BLOQUEO)?.value),
      ...momentosDeIngreso(claims.amr),
    });
    if (evaluacion.accion === "cerrar") {
      await supabase.auth.signOut();
      const destino = redirigir(request, respuesta, RUTA_INGRESAR);
      destino.cookies.delete(COOKIE_ULTIMO_USO);
      destino.cookies.delete(COOKIE_BLOQUEO);
      return destino;
    }
    bloqueadaDesde = evaluacion.bloqueadaDesde;
  }

  const decision = decidirAcceso(ruta, {
    logueado: Boolean(claims),
    nivel: claims?.aal ?? null,
    bloqueada: bloqueadaDesde !== null,
  });
  const final = decision.tipo === "redirigir" ? redirigir(request, respuesta, decision.a) : respuesta;

  if (claims) {
    const opciones = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 31,
    };
    final.cookies.set(COOKIE_ULTIMO_USO, String(ahora), opciones);
    if (bloqueadaDesde !== null) final.cookies.set(COOKIE_BLOQUEO, String(bloqueadaDesde), opciones);
    else if (request.cookies.has(COOKIE_BLOQUEO)) final.cookies.delete(COOKIE_BLOQUEO);
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
