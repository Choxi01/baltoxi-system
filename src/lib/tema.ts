// ─────────────────────────────────────────────────────────────────────────────
// ESTILO VISUAL DE TODA LA APP — se elige con UNA sola palabra (abajo).
//
//   "sereno" → marfil + turquesa, títulos con letra serif, aspecto clásico.
//              Es el elegido con la clienta (noviembre 2026).
//              Los colores están en src/app/tema-sereno.css.
//   "basico" → el estilo original de shadcn: blanco y negro, fuente del sistema.
//
// CÓMO VOLVER AL ESTILO BÁSICO:
//   1. Cambiá "sereno" por "basico" en la línea `export const TEMA ...`.
//   2. Guardá, commit y push. Netlify publica y la app queda como antes.
//   (Para volver al turquesa, poné "sereno" otra vez.)
//
// No hace falta tocar nada más: el archivo del tema solo se aplica cuando
// TEMA es "sereno" (layout.tsx pone <html data-tema="...">).
// La demo con todos los estilos que se probaron: docs/diseno/estilos-demo.html
// ─────────────────────────────────────────────────────────────────────────────

export type Tema = "sereno" | "basico";

export const TEMA: Tema = "sereno";
