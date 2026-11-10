// Colores de la agenda (pedido 5 de docs/pedidos-daniela-2026-11.md):
// - el RELLENO de un turno es el color de su tipo de turno (paleta fija, no un color libre);
// - el ESTADO (vino, no vino, excepción) se ve con el borde y un ícono, nunca solo con el color.
// Funciones puras con tests. Las clases de Tailwind van escritas enteras para que Tailwind las encuentre.

/** Los valores del check de `tipos_turno.color` (migración 0009). El orden es el de las sugerencias. */
export const COLORES_TIPO = ["cielo", "durazno", "lavanda", "arena", "turquesa", "rosa", "oliva", "pizarra"] as const;
export type ColorTipo = (typeof COLORES_TIPO)[number];

export const NOMBRE_COLOR: Record<ColorTipo, string> = {
  cielo: "Cielo",
  durazno: "Durazno",
  lavanda: "Lavanda",
  arena: "Arena",
  turquesa: "Turquesa",
  rosa: "Rosa",
  oliva: "Oliva",
  pizarra: "Pizarra",
};

/** Un tipo sin color (o con uno que ya no existe) se pinta como el primero. */
export const COLOR_POR_DEFECTO: ColorTipo = "cielo";

export function esColorTipo(valor: unknown): valor is ColorTipo {
  return typeof valor === "string" && (COLORES_TIPO as readonly string[]).includes(valor);
}

export function colorDeTipo(valor: string | null | undefined): ColorTipo {
  return esColorTipo(valor) ? valor : COLOR_POR_DEFECTO;
}

/** Para un tipo nuevo: el primer color de la paleta que no usa ningún otro tipo; si están todos, se repiten. */
export function colorSugerido(usados: (string | null)[]): ColorTipo {
  const libre = COLORES_TIPO.find((c) => !usados.includes(c));
  return libre ?? COLORES_TIPO[usados.length % COLORES_TIPO.length];
}

/** Clases por color: `relleno` (fondo y texto), `borde` (turno agendado) y `muestra` (el circulito del selector). */
export const CLASES_COLOR: Record<ColorTipo, { relleno: string; borde: string; muestra: string }> = {
  cielo: {
    relleno: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    borde: "border-sky-300 dark:border-sky-800",
    muestra: "bg-sky-300",
  },
  durazno: {
    relleno: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-50",
    borde: "border-orange-300 dark:border-orange-800",
    muestra: "bg-orange-300",
  },
  lavanda: {
    relleno: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    borde: "border-violet-300 dark:border-violet-800",
    muestra: "bg-violet-300",
  },
  arena: {
    relleno: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
    borde: "border-amber-300 dark:border-amber-800",
    muestra: "bg-amber-300",
  },
  turquesa: {
    relleno: "bg-teal-100 text-teal-950 dark:bg-teal-950 dark:text-teal-50",
    borde: "border-teal-300 dark:border-teal-800",
    muestra: "bg-teal-300",
  },
  rosa: {
    relleno: "bg-pink-100 text-pink-950 dark:bg-pink-950 dark:text-pink-50",
    borde: "border-pink-300 dark:border-pink-800",
    muestra: "bg-pink-300",
  },
  oliva: {
    relleno: "bg-lime-100 text-lime-950 dark:bg-lime-950 dark:text-lime-50",
    borde: "border-lime-400 dark:border-lime-800",
    muestra: "bg-lime-400",
  },
  pizarra: {
    relleno: "bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-slate-50",
    borde: "border-slate-400 dark:border-slate-600",
    muestra: "bg-slate-400",
  },
};

/** Reservado y ocupado: gris, sin color de tipo. */
const GRIS = "border border-border bg-muted text-muted-foreground";
const BORDE_VINO = "border-2 border-emerald-600 dark:border-emerald-400";
const BORDE_NO_VINO = "border-2 border-rose-600 dark:border-rose-400";

/**
 * Ícono del estado: ✓ vino, ✕ no vino. Agendado no lleva.
 * `mezcla` (½): solo en una sesión doble o grupal donde los chicos no tienen todos la misma marca.
 */
export type MarcaEstado = "vino" | "no_vino" | "mezcla" | null;

export type EstiloTurno = { clases: string; marca: MarcaEstado; excepcion: boolean };

/** Cómo se pinta un turno en la agenda: relleno del tipo, borde e ícono del estado. */
export function estiloTurno(t: { clase: string; estado: string; color: string | null; porcentajeManual: number | null }): EstiloTurno {
  if (t.clase !== "turno") return { clases: GRIS, marca: null, excepcion: false };
  const color = CLASES_COLOR[colorDeTipo(t.color)];
  const excepcion = t.porcentajeManual != null;
  if (t.estado === "presente") return { clases: `${BORDE_VINO} ${color.relleno}`, marca: "vino", excepcion };
  if (t.estado === "ausente_sin_aviso") return { clases: `${BORDE_NO_VINO} ${color.relleno}`, marca: "no_vino", excepcion };
  return { clases: `border ${color.borde} ${color.relleno}`, marca: null, excepcion };
}

/**
 * Una sesión doble o grupal (un solo rectángulo, src/lib/agenda/grupos.ts): relleno del tipo y
 * borde según la asistencia de los chicos. Todos vinieron: verde y ✓. Ninguno vino: rojo y ✕.
 * Algunos marcados y otros no (o distinto): borde normal del tipo y "½". Nadie marcado: como agendado.
 * "%" si alguno tiene excepción de cobro.
 */
export function estiloGrupo(turnos: { clase: string; estado: string; color: string | null; porcentajeManual: number | null }[]): EstiloTurno {
  const estilos = turnos.map(estiloTurno);
  const excepcion = estilos.some((e) => e.excepcion);
  const marcas = new Set(estilos.map((e) => e.marca));
  if (estilos.length === 0) return { clases: GRIS, marca: null, excepcion: false };
  // Todos con la misma marca: el estilo de cualquiera de ellos.
  if (marcas.size === 1) return { ...estilos[0], excepcion };
  const agendado = estiloTurno({ ...turnos[0], estado: "agendado" });
  return { clases: agendado.clases, marca: "mezcla", excepcion };
}

/** Leyenda de la grilla: los tipos de turno que aparecen (sin repetir), por nombre. */
export function leyendaTipos(turnos: { clase: string; tipo: string | null; color: string | null }[]): { nombre: string; color: ColorTipo }[] {
  const vistos = new Map<string, ColorTipo>();
  for (const t of turnos) {
    if (t.clase === "turno" && t.tipo && !vistos.has(t.tipo)) vistos.set(t.tipo, colorDeTipo(t.color));
  }
  return [...vistos].map(([nombre, color]) => ({ nombre, color })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
