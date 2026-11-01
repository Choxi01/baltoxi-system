# Propuestas de estilo visual

Demo para elegir el aspecto de la app con la persona B. **No toca la app**: es una página suelta con
datos inventados (pantalla «Hoy»).

- `estilos-demo.html` — abrilo en el navegador (doble clic). Arriba elegís estilo, modo día/noche y
  equipo (Mac, iPad, iPhone). «Comparar todos» muestra los 4 juntos. Abajo hay una votación con
  «Copiar resumen» para pegar en WhatsApp.
- `capturas/` — imágenes de cada estilo: `mac-<estilo>-<dia|noche>.png`, `iphone-...` y
  `comparar-dia.png` / `comparar-noche.png`.

## Los 4 estilos

| | Estilo | Idea | Tipografía | Acento |
|---|---|---|---|---|
| A | **Sereno** | Editorial clínico: marfil, serif, mucho aire, sin sombras | Newsreader + Public Sans | Verde petróleo |
| B | **Precisión** | Suizo / hospitalario: denso, menú azul noche, números mono | IBM Plex Sans + Plex Mono | Cobalto |
| C | **Cercano** | Cálido y muy legible, ideal terapia infantil sin ser infantil | Bricolage Grotesque + Atkinson Hyperlegible | Terracota + salvia |
| D | **Grafito** | Premium, pensado primero para la noche, detalles técnicos | Schibsted Grotesk + JetBrains Mono | Esmeralda |

## Cómo se pasa a la app (cuando elijan)

Cada estilo es un juego de variables CSS (ver `.app[data-estilo=...]` en el HTML). Al elegir:

1. Copiar las variables del estilo a `src/app/globals.css` (`:root` = día, `.dark` = noche),
   mapeándolas a las de shadcn (`--background`, `--card`, `--primary`, `--border`, etc.).
2. Cargar las fuentes con `next/font/google` en `src/app/layout.tsx`.
3. Sumar colores de estado (`--ok`, `--warn`, `--bad`) para asistencia y cobros.
4. Modo noche automático con `prefers-color-scheme` (o un botón en Configuración).

Esto sería una tarea aparte en `docs/tareas.md`.
