import { NextResponse, type NextRequest } from "next/server";

import { RUTA_CODIGO, RUTA_INGRESAR } from "@/lib/auth/acceso";
import { codigoErrorIngreso } from "@/lib/auth/ingreso";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Recibe el formulario de login. Es un envío "normal" del navegador (no por
// JavaScript) para que Safari y el llavero de iCloud ofrezcan guardar la
// contraseña. La sesión queda en cookies y se pasa a la pantalla del código.
export async function POST(request: NextRequest) {
  const datos = await request.formData();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(datos.get("email") ?? "").trim(),
    password: String(datos.get("contrasena") ?? ""),
  });

  const destino = error
    ? `${RUTA_INGRESAR}?error=${codigoErrorIngreso(error.code)}`
    : RUTA_CODIGO;
  // 303: después de un POST, el navegador pide la página nueva con GET.
  return NextResponse.redirect(new URL(destino, request.url), 303);
}
