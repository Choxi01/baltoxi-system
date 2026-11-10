// Frena a Claude antes de leer o editar archivos delicados. Salir con código 2 bloquea la acción.
// shortcut: no cubre comandos de terminal (ej. `cat .env`), sumar una regla de Bash si hiciera falta.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const { tool_name, tool_input } = JSON.parse(readFileSync(0, "utf8"));
const ruta = (tool_input.file_path ?? "").replaceAll("\\", "/");
const nombre = ruta.split("/").pop();
const bloquear = (motivo) => {
  console.error(motivo);
  process.exit(2);
};

if (nombre.startsWith(".env") && nombre !== ".env.example") {
  bloquear("No se leen ni se editan los .env.");
}
if (tool_name === "Read") process.exit(0);

if (nombre === "package-lock.json") bloquear("El package-lock.json lo cambia npm.");
if (ruta.endsWith("src/lib/supabase/types.ts")) bloquear("Este archivo se genera con npm run gen:types.");
if (
  /supabase\/migrations\/.+\.sql$/.test(ruta) &&
  spawnSync("git", ["ls-files", "--error-unmatch", ruta]).status === 0
) {
  bloquear("Esta migración ya está commiteada y no se edita: creá una nueva.");
}
