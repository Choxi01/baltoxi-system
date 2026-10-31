// Plantillas de mensajes (docs/mensajes.md). Funciones puras con tests.
// OJO regla de oro 7: los mensajes llevan solo nombres de pila, días, horas y montos.
// Nunca motivo de consulta, notas, anamnesis ni documentos.

import { diaSemana, horaCorta } from "@/lib/agenda/bloques";
import { sumarDias } from "@/lib/agenda/calendario";

export const CLAVES = [
  "recordatorio_sesion",
  "monto_periodo",
  "recordatorio_pago",
  "horarios_libres",
  "cambio_turno",
  "cancelacion_turno",
  "bienvenida",
] as const;
export type Clave = (typeof CLAVES)[number];

export function esClave(valor: unknown): valor is Clave {
  return typeof valor === "string" && (CLAVES as readonly string[]).includes(valor);
}

export const VARIABLES = [
  "tutor", "paciente", "cuando", "dia", "hora", "periodo", "total",
  "datos_pago", "rango", "libres", "link_ficha", "detalle",
] as const;
export type Variable = (typeof VARIABLES)[number];
export type Valores = Partial<Record<Variable, string>>;

/** Qué variables se pueden usar en cada plantilla (las muestra el editor). */
export const VARIABLES_POR_CLAVE: Record<Clave, readonly Variable[]> = {
  recordatorio_sesion: ["tutor", "paciente", "cuando", "dia", "hora"],
  monto_periodo: ["tutor", "paciente", "periodo", "total", "datos_pago", "detalle"],
  recordatorio_pago: ["tutor", "paciente", "periodo", "total", "datos_pago"],
  horarios_libres: ["rango", "libres"],
  cambio_turno: ["tutor", "paciente", "dia", "hora"],
  cancelacion_turno: ["tutor", "paciente", "dia", "hora"],
  bienvenida: ["tutor", "paciente", "link_ficha"],
};

export const TITULO_PLANTILLA: Record<Clave, string> = {
  recordatorio_sesion: "Recordatorio de sesión",
  monto_periodo: "Monto del período",
  recordatorio_pago: "Recordatorio de pago",
  horarios_libres: "Horarios libres",
  cambio_turno: "Cambio de turno",
  cancelacion_turno: "Cancelación de turno",
  bienvenida: "Bienvenida",
};

export const CUANDO_SE_USA: Record<Clave, string> = {
  recordatorio_sesion: "En «Mensajes de hoy», para los turnos del próximo día de atención.",
  monto_periodo: "En «Mensajes de hoy», el día del último turno del mes (o de la semana).",
  recordatorio_pago: "En «Mensajes de hoy», a las familias con pagos atrasados (una vez por semana).",
  horarios_libres: "En la agenda, con «Copiar libres».",
  cambio_turno: "Al mover un turno.",
  cancelacion_turno: "Al cancelar un turno.",
  bienvenida: "A las familias nuevas, con el link de su ficha.",
};

export const DESCRIPCION_VARIABLE: Record<Variable, string> = {
  tutor: "Nombre de pila del tutor",
  paciente: "Nombre de pila (dos hijos: «Tomi y Sofi»)",
  cuando: "«mañana» o «el lunes 2/11»",
  dia: "«martes 4/11»",
  hora: "«15:00»",
  periodo: "«octubre» o «la semana del 3 al 7/11»",
  total: "«Gs. 1.160.000»",
  datos_pago: "Datos de pago del consultorio",
  rango: "«esta semana», «hoy»…",
  libres: "Lista de horarios libres",
  link_ficha: "Link de la ficha online",
  detalle: "Detalle por sesión (opcional)",
};

/** Textos por defecto (los mismos que crea la base para un consultorio nuevo, migración 0008). */
export const PLANTILLAS_POR_DEFECTO: Record<Clave, string> = {
  recordatorio_sesion: "Hola {tutor}, te recuerdo la sesión de {paciente} {cuando} a las {hora}. ¡Nos vemos!",
  monto_periodo: "Hola {tutor}, ¿cómo estás? Te paso el monto de las sesiones de {periodo}: {total}. {datos_pago}. ¡Gracias!",
  recordatorio_pago: "Hola {tutor}, ¿cómo estás? Te recuerdo que quedó pendiente el pago de {periodo}: {total}. {datos_pago}. ¡Gracias!",
  horarios_libres: "Horarios disponibles {rango}:\n{libres}",
  cambio_turno: "Hola {tutor}, te confirmo el cambio: la sesión de {paciente} pasa al {dia} a las {hora}.",
  cancelacion_turno: "Hola {tutor}, te aviso que la sesión de {paciente} del {dia} a las {hora} queda cancelada.",
  bienvenida:
    "Hola {tutor}, ¿cómo estás? Desde ahora organizo los turnos y pagos con un sistema, y algunos mensajes (como los recordatorios) te van a llegar automáticamente. Te pido que completes o actualices los datos de {paciente} y leas el reglamento en este link: {link_ficha}. ¡Gracias!",
};

export const LARGO_MAXIMO_PLANTILLA = 1000;

const PATRON_VARIABLE = /\{([a-z_]+)\}/g;

/** Variables escritas en el texto que no existen para esa plantilla (ej. "{pacinte}"). */
export function variablesDesconocidas(texto: string, clave: Clave): string[] {
  const permitidas = VARIABLES_POR_CLAVE[clave] as readonly string[];
  const encontradas = [...texto.matchAll(PATRON_VARIABLE)].map((m) => m[1]);
  return [...new Set(encontradas.filter((v) => !permitidas.includes(v)))];
}

/**
 * Reemplaza las variables `{tutor}`, `{dia}`… Las que no vienen quedan como están.
 * Si una variable viene vacía (ej. sin datos de pago), limpia la puntuación que sobra.
 */
export function rellenar(texto: string, valores: Valores): string {
  let vacias = false;
  const lleno = texto.replace(PATRON_VARIABLE, (completo, nombre: string) => {
    const valor = valores[nombre as Variable];
    if (valor === undefined) return completo;
    if (valor.trim() === "") vacias = true;
    return valor;
  });
  if (!vacias) return lleno;
  return lleno
    .split("\n")
    .map((linea) =>
      linea
        .replace(/[ \t]+([.,:;!?])/g, "$1") // "Gs. 1.000 . ¡Gracias!" → "Gs. 1.000. ¡Gracias!"
        .replace(/([.,:;])(?:[ \t]*\1)+/g, "$1") // ". ." → "."
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .join("\n")
    .trim();
}

/** Las plantillas viejas decían "mañana {dia}": se cambia por "{cuando}" (el viernes no es "mañana"). */
const MANANA_VIEJO = /\bma[ñn]ana\s+\{dia\}/gi;

export function tieneMananaViejo(texto: string): boolean {
  return new RegExp(MANANA_VIEJO).test(texto);
}

export function actualizarRecordatorio(texto: string): string {
  return texto.replace(MANANA_VIEJO, "{cuando}");
}

// ---------------------------------------------------------------------
// Cómo se escriben los datos en los mensajes
// ---------------------------------------------------------------------

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Nombre de pila: la primera palabra ("María José" → "María"). */
export function nombrePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}

/** "Tomi", "Tomi y Sofi", "Tomi, Sofi y Juli" (sin repetir). */
export function unirNombres(nombres: string[]): string {
  const unicos = [...new Set(nombres.filter((n) => n.trim() !== ""))];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} y ${unicos[unicos.length - 1]}`;
}

/** "2026-11-04" → "miércoles 4/11". */
export function textoDiaMensaje(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${DIAS[diaSemana(fecha)]} ${d}/${m}`;
}

/** "mañana" si la fecha es el día siguiente a hoy; si no, "el lunes 2/11". */
export function textoCuando(fecha: string, hoy: string): string {
  return fecha === sumarDias(hoy, 1) ? "mañana" : `el ${textoDiaMensaje(fecha)}`;
}

/** Horas ordenadas y sin repetir: "15:00", "9:00 y 15:45". */
export function textoHoras(horas: string[]): string {
  const ordenadas = [...new Set(horas)].sort().map(horaCorta);
  return unirNombres(ordenadas);
}

/** Datos inventados para la vista previa del editor (regla de oro 8). */
export const EJEMPLO: Required<Valores> = {
  tutor: "Laura",
  paciente: "Tomi",
  cuando: "mañana",
  dia: "martes 4/11",
  hora: "15:00",
  periodo: "octubre",
  total: "Gs. 1.160.000",
  datos_pago: "Alias 0000000",
  rango: "esta semana",
  libres: "• Lunes 3/11: 9:00, 9:45\n• Jueves 6/11: 15:00",
  link_ficha: "https://ejemplo.com/ficha/abc123",
  detalle: "",
};

/** Vista previa de una plantilla con datos de ejemplo. */
export function vistaPrevia(texto: string, clave: Clave): string {
  const base = clave === "recordatorio_sesion" ? actualizarRecordatorio(texto) : texto;
  return rellenar(base, EJEMPLO);
}
