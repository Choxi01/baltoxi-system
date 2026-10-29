// Secciones de la app. "principal" = aparecen en la barra de abajo del iPhone.

export type Seccion = { href: string; titulo: string; principal: boolean };

export const SECCIONES: Seccion[] = [
  { href: "/hoy", titulo: "Hoy", principal: true },
  { href: "/agenda", titulo: "Agenda", principal: true },
  { href: "/pacientes", titulo: "Pacientes", principal: true },
  { href: "/cobros", titulo: "Cobros", principal: true },
  { href: "/mensajes", titulo: "Mensajes", principal: false },
  { href: "/facturar", titulo: "Para facturar", principal: false },
  { href: "/reportes", titulo: "Reportes", principal: false },
  { href: "/config", titulo: "Configuración", principal: false },
];

/** La sección está activa si la ruta es ella o algo adentro (ej. /pacientes/123). */
export function seccionActiva(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(href + "/");
}
