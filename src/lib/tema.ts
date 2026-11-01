// Estilo visual de toda la app. Se elige con UNA palabra:
//   "sereno" → marfil + turquesa, títulos con serif, aspecto clásico (src/app/tema-sereno.css)
//   "basico" → el estilo original de shadcn (blanco y negro, fuente del sistema)
// Para volver al estilo anterior: cambiá "sereno" por "basico" y listo.
export type Tema = "sereno" | "basico";

export const TEMA: Tema = "sereno";
