// Opciones comunes de las cookies propias de la app: httpOnly (JavaScript no
// las puede leer), solo por https en producción.
export function opcionesCookie(duracionSegundos: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: duracionSegundos,
  };
}
