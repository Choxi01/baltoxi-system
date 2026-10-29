import "server-only";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { RUTA_CODIGO, RUTA_INGRESAR } from "./acceso";

// Verificaciones de sesión del lado del servidor. El proxy ya redirige, pero
// cada página y acción vuelve a verificar: nunca confiar solo en el proxy.

/** Exige contraseña + código (aal2). Devuelve el usuario y el cliente. */
export async function exigirSesionCompleta() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(RUTA_INGRESAR);
  if (claims.aal !== "aal2") redirect(RUTA_CODIGO);
  return { userId: claims.sub, supabase };
}

/** El consultorio del usuario, o null si todavía no creó ninguno. */
export async function buscarConsultorio() {
  const { userId, supabase } = await exigirSesionCompleta();
  const { data, error } = await supabase
    .from("miembros")
    .select("consultorio_id, consultorios (nombre)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el consultorio");
  if (!data) return null;
  return { id: data.consultorio_id, nombre: data.consultorios?.nombre ?? "" };
}

/** Como buscarConsultorio, pero manda a crearlo si no hay. */
export async function exigirConsultorio() {
  const consultorio = await buscarConsultorio();
  if (!consultorio) redirect("/nuevo-consultorio");
  return consultorio;
}
