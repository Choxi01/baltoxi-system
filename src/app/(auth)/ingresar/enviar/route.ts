import { NextResponse, type NextRequest } from "next/server";

import { RUTA_CODIGO, RUTA_INGRESAR, RUTA_INICIO } from "@/lib/auth/acceso";
import { opcionesCookie } from "@/lib/auth/cookies";
import { COOKIE_DISPOSITIVO, COOKIE_SESION_CONFIANZA, DURACION_DISPOSITIVO_MS } from "@/lib/auth/dispositivo";
import { usarDispositivo } from "@/lib/auth/dispositivo-servidor";
import { COOKIE_ULTIMO_USO } from "@/lib/auth/inactividad";
import { codigoErrorIngreso } from "@/lib/auth/ingreso";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Recibe el formulario de login. Es un envío "normal" del navegador (no por
// JavaScript) para que Safari, Edge y el llavero de iCloud ofrezcan guardar
// la contraseña. Si el navegador es de confianza, entra directo; si no, pasa
// a la pantalla del código.
export async function POST(request: NextRequest) {
  const datos = await request.formData();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(datos.get("email") ?? "").trim(),
    password: String(datos.get("contrasena") ?? ""),
  });

  // 303: después de un POST, el navegador pide la página nueva con GET.
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, request.url), 303);

  if (error || !data.session) {
    return ir(`${RUTA_INGRESAR}?error=${codigoErrorIngreso(error?.code)}`);
  }
  // Sesión nueva: no hereda el "último uso" de una sesión anterior. Si ese
  // valor quedó viejo (más de 24 h), el proxy cerraría la sesión recién
  // abierta y mandaría de vuelta al login.
  const irConSesionNueva = (ruta: string) => {
    const respuesta = ir(ruta);
    respuesta.cookies.delete(COOKIE_ULTIMO_USO);
    return respuesta;
  };

  const llave = request.cookies.get(COOKIE_DISPOSITIVO)?.value;
  if (llave) {
    const { data: datosClaims } = await supabase.auth.getClaims(data.session.access_token);
    const claims = datosClaims?.claims;
    if (claims?.session_id && (await usarDispositivo(llave, claims.sub, claims.session_id))) {
      const respuesta = irConSesionNueva(RUTA_INICIO);
      respuesta.cookies.set(COOKIE_SESION_CONFIANZA, claims.session_id, opcionesCookie(DURACION_DISPOSITIVO_MS / 1000));
      return respuesta;
    }
    // Llave vencida, de otro usuario o inválida: se descarta.
    const respuesta = irConSesionNueva(RUTA_CODIGO);
    respuesta.cookies.delete(COOKIE_DISPOSITIVO);
    return respuesta;
  }
  return irConSesionNueva(RUTA_CODIGO);
}
