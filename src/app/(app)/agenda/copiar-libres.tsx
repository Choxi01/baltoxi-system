"use client";

import { Check, Copy, Share, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  fechasDelPeriodo,
  libresPorDia,
  textoLibres,
  textoRango,
  type Ahora,
  type Franja,
  type Periodo,
} from "@/lib/agenda/libres";
import type { Dia } from "@/lib/agenda/turnos";
import { ahoraEnAsuncion } from "@/lib/fechas";
import { cn } from "@/lib/utils";

const PERIODOS: { id: Periodo; titulo: string }[] = [
  { id: "dia", titulo: "Hoy" },
  { id: "semana", titulo: "Semana" },
  { id: "mes", titulo: "Mes" },
];
const FRANJAS: { id: Franja; titulo: string }[] = [
  { id: "todo", titulo: "Todo el día" },
  { id: "manana", titulo: "Mañana" },
  { id: "tarde", titulo: "Tarde" },
];

/** Botones en grupo, con el mismo estilo que el selector de vista de la agenda. */
function Grupo<T extends string>({
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  etiqueta: string;
  opciones: { id: T; titulo: string }[];
  valor: T;
  alElegir: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => alElegir(o.id)}
          aria-pressed={valor === o.id}
          className={cn(
            "h-11 rounded-md px-2 text-sm font-medium text-muted-foreground",
            valor === o.id && "bg-background text-foreground shadow-xs",
          )}
        >
          {o.titulo}
        </button>
      ))}
    </div>
  );
}

// "Copiar libres" (A4): panel dentro de la agenda, sin ventanas. Todo se calcula en el
// navegador con los días que ya tiene la agenda: no pide nada al servidor.
// El texto lleva solo días y horas (regla de oro 7).
export function CopiarLibres({
  fecha,
  dias,
  visibles,
  plantilla,
  alCerrar,
}: {
  /** La fecha que se está mirando: "semana" y "mes" son los de esta fecha. */
  fecha: string;
  dias: Map<string, Dia>;
  visibles: number[];
  plantilla: string;
  alCerrar: () => void;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [franja, setFranja] = useState<Franja>("todo");
  const [desdeManana, setDesdeManana] = useState(false);
  // El aviso guarda para qué texto era: si cambian los filtros, deja de mostrarse solo.
  const [avisoDe, setAvisoDe] = useState<{ texto: string; mensaje: string } | null>(null);
  // El panel solo se abre al tocar el botón (nunca en el primer render), así que leer
  // la hora y el navegador acá no produce diferencias con el servidor ni parpadeos.
  const [ahora] = useState<Ahora>(() => ahoraEnAsuncion());
  const [puedeCompartir] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  // "Desde mañana" no tiene sentido para un solo día: si se mira hoy, quedaría vacío.
  const sinHoy = desdeManana && periodo !== "dia";

  const texto = useMemo(() => {
    const delPeriodo = fechasDelPeriodo(periodo, fecha, visibles).flatMap((f) => dias.get(f) ?? []);
    const libres = libresPorDia(delPeriodo, { franja, desdeManana: sinHoy }, ahora);
    const rango = textoRango(periodo, fecha, ahora.fecha, visibles);
    return textoLibres(libres, rango, plantilla);
  }, [periodo, franja, sinHoy, fecha, visibles, dias, ahora, plantilla]);

  const aviso = avisoDe?.texto === texto ? avisoDe.mensaje : null;
  const avisar = (mensaje: string) => setAvisoDe({ texto, mensaje });
  useEffect(() => {
    if (!avisoDe) return;
    const t = setTimeout(() => setAvisoDe(null), 2500);
    return () => clearTimeout(t);
  }, [avisoDe]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Copiado ✓");
    } catch {
      avisar("No se pudo copiar. Mantené apretado el texto para copiarlo.");
    }
  }

  async function compartir() {
    try {
      await navigator.share({ text: texto });
    } catch (e) {
      // Cerrar la hoja de compartir no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) avisar("No se pudo compartir.");
    }
  }

  // Si se está mirando otro día, el botón dice "Este día" (y el texto, "el jueves 5/11").
  const periodos = PERIODOS.map((p) => (p.id === "dia" && fecha !== ahora.fecha ? { ...p, titulo: "Este día" } : p));

  return (
    <section aria-label="Copiar libres" className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Copiar libres</h2>
        <Button variant="ghost" className="size-10" aria-label="Cerrar" onClick={alCerrar}>
          <X className="size-5" />
        </Button>
      </div>

      <Grupo
        etiqueta="Qué copiar"
        opciones={periodos}
        valor={periodo}
        alElegir={setPeriodo}
      />
      <Grupo etiqueta="Franja" opciones={FRANJAS} valor={franja} alElegir={setFranja} />
      {periodo !== "dia" && (
        <button
          type="button"
          role="switch"
          aria-checked={desdeManana}
          onClick={() => setDesdeManana(!desdeManana)}
          className="flex h-12 items-center justify-between rounded-lg border bg-background px-3 text-sm font-medium"
        >
          Desde mañana (sin hoy)
          <span
            aria-hidden
            className={cn("flex h-7 w-12 items-center rounded-full p-1 transition-colors", desdeManana ? "bg-primary" : "bg-muted")}
          >
            <span className={cn("size-5 rounded-full bg-background shadow-xs transition-transform", desdeManana && "translate-x-5")} />
          </span>
        </button>
      )}

      <p className="whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm select-text">{texto}</p>

      <div className={cn("grid gap-2", puedeCompartir ? "grid-cols-2" : "grid-cols-1")}>
        <Button className="h-12" onClick={copiar}>
          {aviso === "Copiado ✓" ? <Check /> : <Copy />} Copiar
        </Button>
        {puedeCompartir && (
          <Button variant="outline" className="h-12" onClick={compartir}>
            <Share /> Compartir
          </Button>
        )}
      </div>
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
    </section>
  );
}
