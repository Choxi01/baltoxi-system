import { NextResponse, type NextRequest } from "next/server";

import { RUTA_CODIGO } from "@/lib/auth/acceso";
import { COOKIE_SESION_CONFIANZA } from "@/lib/auth/dispositivo";

// La marca "entró por un dispositivo de confianza" quedó en el navegador pero
// la base ya no la reconoce (ver exigirSesionCompleta). Se borra y se pide el
// código: así no se ve la app vacía ni se ofrece crear otro consultorio.
export function GET(request: NextRequest) {
  const respuesta = NextResponse.redirect(new URL(RUTA_CODIGO, request.url), 303);
  respuesta.cookies.delete(COOKIE_SESION_CONFIANZA);
  return respuesta;
}
