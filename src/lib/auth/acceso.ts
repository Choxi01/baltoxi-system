// Reglas de acceso de la app (funciones puras, sin Next.js ni Supabase).

/** Qué hace falta para ver una ruta. */
export type Requisito =
  | "publico" // cualquiera: login y ficha de la familia
  | "sesion" // contraseña correcta, todavía sin código (pantalla del código)
  | "completo"; // contraseña + código del Autenticador (aal2)

export const RUTA_INGRESAR = "/ingresar";
export const RUTA_CODIGO = "/codigo";
export const RUTA_INICIO = "/hoy";

function empiezaCon(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(base + "/");
}

export function requisitoDeRuta(ruta: string): Requisito {
  if (empiezaCon(ruta, RUTA_INGRESAR) || empiezaCon(ruta, "/ficha")) return "publico";
  if (empiezaCon(ruta, RUTA_CODIGO)) return "sesion";
  return "completo";
}

export type EstadoSesion = {
  /** Hay usuario logueado (al menos con contraseña). */
  logueado: boolean;
  /** Nivel de la sesión según Supabase: "aal1" = solo contraseña, "aal2" = con código. */
  nivel: string | null;
  /** Pasaron 24 h sin uso: hay que volver a poner el código (ver inactividad.ts). */
  bloqueada?: boolean;
};

/** Qué hacer con un pedido: dejarlo pasar o mandarlo a otra ruta. */
export type Decision = { tipo: "seguir" } | { tipo: "redirigir"; a: string };

export function decidirAcceso(ruta: string, sesion: EstadoSesion): Decision {
  const requisito = requisitoDeRuta(ruta);
  const completo = sesion.logueado && sesion.nivel === "aal2" && !sesion.bloqueada;

  // Ya entró del todo: el login y el código no tienen sentido.
  if (completo && (empiezaCon(ruta, RUTA_INGRESAR) || requisito === "sesion")) {
    return { tipo: "redirigir", a: RUTA_INICIO };
  }
  if (requisito === "publico") {
    // Bloqueada: no hace falta la contraseña de nuevo, solo el código.
    if (sesion.logueado && sesion.bloqueada && empiezaCon(ruta, RUTA_INGRESAR)) {
      return { tipo: "redirigir", a: RUTA_CODIGO };
    }
    return { tipo: "seguir" };
  }
  if (!sesion.logueado) return { tipo: "redirigir", a: RUTA_INGRESAR };
  if (requisito === "completo" && !completo) return { tipo: "redirigir", a: RUTA_CODIGO };
  return { tipo: "seguir" };
}
