"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { Bloqueo, Tramo } from "@/lib/agenda/bloques";
import {
  cubre,
  diasDeLaSemana,
  diasVisibles,
  fechasEntre,
  mover,
  nombreCortoDia,
  semanasDelMes,
  tituloDia,
  tituloMes,
  tituloSemana,
  type Vista,
} from "@/lib/agenda/calendario";
import { diaSemana } from "@/lib/agenda/bloques";
import { armarDia, type TurnoAgenda } from "@/lib/agenda/turnos";
import { cn } from "@/lib/utils";
import { VistaDia, VistaMes, VistaSemana } from "./vistas";

/** "auto" = Día en iPhone y Semana en iPad y Mac (se resuelve con CSS, sin parpadeo). */
type VistaElegida = Vista | "auto";

const VISTAS: { id: Vista; titulo: string }[] = [
  { id: "dia", titulo: "Día" },
  { id: "semana", titulo: "Semana" },
  { id: "mes", titulo: "Mes" },
];

/** Igual que el `md:` de Tailwind. */
const esPantallaGrande = () => window.matchMedia("(min-width: 768px)").matches;

export function Agenda({
  hoy,
  fechaInicial,
  vistaInicial,
  rango,
  duracion,
  tramos,
  bloqueos,
  turnos,
}: {
  hoy: string;
  fechaInicial: string;
  vistaInicial: Vista | null;
  /** Días que vinieron del servidor. Fuera de esto hay que pedir más. */
  rango: { desde: string; hasta: string };
  duracion: number;
  tramos: Tramo[];
  bloqueos: Bloqueo[];
  turnos: TurnoAgenda[];
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(fechaInicial);
  const [vista, setVista] = useState<VistaElegida>(vistaInicial ?? "auto");
  const [cargando, iniciar] = useTransition();

  // Todos los días cargados, armados una sola vez: cambiar de vista o de día es instantáneo.
  const dias = useMemo(() => {
    const mapa = new Map(fechasEntre(rango.desde, rango.hasta).map((f) => [f, armarDia(f, tramos, duracion, bloqueos, turnos)]));
    return mapa;
  }, [rango.desde, rango.hasta, tramos, duracion, bloqueos, turnos]);
  const visibles = useMemo(() => diasVisibles([...new Set(tramos.map((t) => t.dia_semana))]), [tramos]);

  /** La vista que se ve de verdad (resuelve "auto" según el ancho de la pantalla). */
  const vistaReal = (): Vista => (vista === "auto" ? (esPantallaGrande() ? "semana" : "dia") : vista);

  function ir(nuevaFecha: string, nuevaVista: VistaElegida = vista) {
    setFecha(nuevaFecha);
    setVista(nuevaVista);
    const parametros = new URLSearchParams({ fecha: nuevaFecha });
    if (nuevaVista !== "auto") parametros.set("vista", nuevaVista);
    // "auto" puede ser Semana: hay que tener la semana entera.
    const necesaria = nuevaVista === "auto" ? "semana" : nuevaVista;
    if (cubre(rango, necesaria, nuevaFecha)) {
      window.history.replaceState(null, "", `?${parametros}`);
    } else {
      // Fuera de lo cargado: el servidor trae los turnos de esas fechas.
      iniciar(() => router.replace(`/agenda?${parametros}`, { scroll: false }));
    }
  }

  const listo = cubre(rango, vista === "auto" ? "semana" : vista, fecha);
  const dia = dias.get(fecha);
  const semana = diasDeLaSemana(fecha, visibles).flatMap((f) => dias.get(f) ?? []);
  const semanasMes = semanasDelMes(fecha).map((s) => s.filter((f) => visibles.includes(diaSemana(f))).flatMap((f) => dias.get(f) ?? []));

  const titulos: Record<Vista, string> = {
    dia: tituloDia(fecha),
    semana: tituloSemana(diasDeLaSemana(fecha, visibles)),
    mes: tituloMes(fecha),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-11 px-4" onClick={() => ir(hoy)}>
            Hoy
          </Button>
          <Button variant="ghost" className="size-11" aria-label="Anterior" onClick={() => ir(mover(vistaReal(), fecha, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" className="size-11" aria-label="Siguiente" onClick={() => ir(mover(vistaReal(), fecha, 1))}>
            <ChevronRight className="size-5" />
          </Button>
          <h2 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
            {vista === "auto" ? (
              <>
                <span className="md:hidden">{titulos.dia}</span>
                <span className="hidden md:inline">{titulos.semana}</span>
              </>
            ) : (
              titulos[vista]
            )}
          </h2>
        </div>
        <div role="group" aria-label="Vista" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => ir(fecha, v.id)}
              aria-pressed={vista === v.id}
              className={cn(
                "h-10 rounded-md px-4 text-sm font-medium text-muted-foreground",
                vista === v.id && "bg-background text-foreground shadow-xs",
                // En "auto", se marca la que se ve según la pantalla.
                vista === "auto" && v.id === "dia" && "max-md:bg-background max-md:text-foreground max-md:shadow-xs",
                vista === "auto" && v.id === "semana" && "md:bg-background md:text-foreground md:shadow-xs",
              )}
            >
              {v.titulo}
            </button>
          ))}
        </div>
      </div>

      {!listo || cargando ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {(vista === "dia" || vista === "auto") && dia && (
            <div className={cn(vista === "auto" && "md:hidden")}>
              <VistaDia dia={dia} />
            </div>
          )}
          {(vista === "semana" || vista === "auto") && (
            <div className={cn(vista === "auto" && "hidden md:block")}>
              <VistaSemana dias={semana} hoy={hoy} alElegirDia={(f) => ir(f, "dia")} />
            </div>
          )}
          {vista === "mes" && (
            <VistaMes
              semanas={semanasMes}
              mes={fecha.slice(0, 7)}
              hoy={hoy}
              encabezados={visibles.map(nombreCortoDia)}
              alElegirDia={(f) => ir(f, "dia")}
            />
          )}
        </>
      )}
    </div>
  );
}
