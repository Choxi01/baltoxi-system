"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoReglamento } from "@/lib/config/acciones-reglamento";
import { MAXIMO_REGLAMENTO } from "@/lib/ficha/reglamento";

// Configuración > Reglamento (tarea A8b). Las familias lo aceptan en la ficha online.
// Si el texto cambia, la versión sube y lo tienen que volver a aceptar.

export function TabReglamento({
  texto,
  version,
  firmasVersionActual,
  guardar,
}: {
  texto: string | null;
  version: number;
  firmasVersionActual: number;
  guardar: (anterior: EstadoReglamento, formulario: FormData) => Promise<EstadoReglamento>;
}) {
  const [estado, enviar, enviando] = useActionState(guardar, { errores: {}, guardadoEn: null } as EstadoReglamento);
  const e = estado.errores;
  const subio = estado.guardadoEn && estado.version !== undefined && estado.version > version;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 pt-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Las familias lo leen y lo aceptan en su ficha online (nombre completo, cédula y «Leí y acepto»). Versión actual:{" "}
        <strong>{estado.version ?? version}</strong>
        {texto ? ` · ${firmasVersionActual} ${firmasVersionActual === 1 ? "firma" : "firmas"} de esta versión.` : "."}
      </p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
        Si cambiás el texto, la versión sube y <strong>todas las familias lo tienen que volver a aceptar</strong>. Corregir solo
        espacios al final no cuenta como cambio.
      </p>
      <input type="hidden" name="version" value={estado.version ?? version} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="reglamento-texto">Texto del reglamento</Label>
        <Textarea
          id="reglamento-texto"
          name="texto"
          rows={16}
          maxLength={MAXIMO_REGLAMENTO}
          defaultValue={estado.enviado?.texto ?? texto ?? ""}
          aria-invalid={!!e.texto}
          placeholder="Ej.: Las cancelaciones se avisan con 24 horas de anticipación…"
        />
        {e.texto && <p className="text-sm text-destructive">{e.texto}</p>}
      </div>
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      {estado.guardadoEn && !enviando && (
        <p role="status" className="text-sm text-muted-foreground">
          {subio ? `Guardado ✓ Ahora es la versión ${estado.version}: las familias lo van a tener que aceptar de nuevo.` : "Guardado ✓"}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar reglamento"}
      </Button>
    </form>
  );
}
