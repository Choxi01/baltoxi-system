import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./env";
import type { Database } from "./types";

// Cliente con la service role: SALTEA RLS y ve todos los consultorios.
// Solo para el servidor y solo donde no hay usuario logueado (ficha pública,
// copias de seguridad). "server-only" hace fallar el build si alguien lo
// importa desde el navegador.
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");

  return createClient<Database>(supabaseUrl(), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
