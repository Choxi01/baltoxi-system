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
  /** Puso el código, o entró desde un dispositivo de confianza (ver sesionVerificada). */
  verificada: boolean;
};

/**
 * La sesión cuenta como completa si tiene el código ("aal2") o si el servidor
 * la marcó de confianza al entrar (cookie con el id de esa misma sesión).
 * Es solo para la navegación: la base hace la misma verificación por su cuenta.
 */
export function sesionVerificada(
  claims: { aal?: string; session_id?: string } | null | undefined,
  marcaConfianza: string | undefined,
): boolean {
  if (!claims) return false;
  if (claims.aal === "aal2") return true;
  return Boolean(marcaConfianza && claims.session_id && marcaConfianza === claims.session_id);
}

/** Qué hacer con un pedido: dejarlo pasar o mandarlo a otra ruta. */
export type Decision = { tipo: "seguir" } | { tipo: "redirigir"; a: string };

/**
 * `esNavegacion`: el navegador está abriendo una página (GET). Los envíos
 * (POST: el formulario de login, las acciones del servidor) nunca se desvían
 * por comodidad; si no, se pierden. Ej.: "recordar este navegador" se llama
 * desde /codigo justo después de poner el código.
 */
export function decidirAcceso(ruta: string, sesion: EstadoSesion, esNavegacion = true): Decision {
  const requisito = requisitoDeRuta(ruta);
  const completo = sesion.logueado && sesion.verificada;

  // Ya entró del todo: el login y el código no tienen sentido.
  if (esNavegacion && completo && (empiezaCon(ruta, RUTA_INGRESAR) || requisito === "sesion")) {
    return { tipo: "redirigir", a: RUTA_INICIO };
  }
  if (requisito === "publico") return { tipo: "seguir" };
  if (!sesion.logueado) return { tipo: "redirigir", a: RUTA_INGRESAR };
  if (requisito === "completo" && !completo) return { tipo: "redirigir", a: RUTA_CODIGO };
  return { tipo: "seguir" };
}
