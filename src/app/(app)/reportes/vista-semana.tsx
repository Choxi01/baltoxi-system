"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { diaCorto, sumarDias, tituloSemana } from "@/lib/agenda/calendario";
import { NOMBRE_ESTADO_TURNO } from "@/lib/agenda/turnos";
import { formatoGs } from "@/lib/cobro/formato";
import type { FilaDetalle, Reporte } from "@/lib/cobro/reportes";
import { cn } from "@/lib/utils";
import { EnlacePeriodo } from "./enlace-periodo";

function Detalle({ filas }: { filas: FilaDetalle[] }) {
  if (filas.length === 0) return <p className="px-3 py-2 text-sm text-muted-foreground">Sin turnos este día.</p>;
  return (
    <ul className="divide-y">
      {filas.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-11 shrink-0 tabular-nums text-muted-foreground">{f.hora ?? "—"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{f.paciente ?? f.tipo}</p>
            {f.paciente && <p className="truncate text-muted-foreground">{f.tipo}</p>}
          </div>
          <span className="shrink-0 tabular-nums">{f.monto !== null ? formatoGs(f.monto) : f.estado && NOMBRE_ESTADO_TURNO[f.estado]}</span>
        </li>
      ))}
    </ul>
  );
}

// Generado de cada día (pedido 6): monto exacto y barrita; al tocar un día se ven sus turnos.
export function VistaSemana({ semana, hoy }: { semana: Reporte["semana"]; hoy: string }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const maximo = Math.max(...semana.dias.map((d) => d.monto), 1);

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex items-center gap-2">
        <EnlacePeriodo parametro="semana" valor={sumarDias(semana.lunes, -7)} etiqueta="Semana anterior">
          <ChevronLeft className="size-5" />
        </EnlacePeriodo>
        <p className="min-w-0 flex-1 text-center text-sm font-medium">{tituloSemana(semana.dias.map((d) => d.fecha))}</p>
        <EnlacePeriodo parametro="semana" valor={sumarDias(semana.lunes, 7)} etiqueta="Semana siguiente">
          <ChevronRight className="size-5" />
        </EnlacePeriodo>
      </div>

      <ul className="flex flex-col gap-2">
        {semana.dias.map((d) => {
          const estaAbierto = abierto === d.fecha;
          return (
            <li key={d.fecha} className="overflow-hidden rounded-lg border">
              <button
                type="button"
                aria-expanded={estaAbierto}
                onClick={() => setAbierto(estaAbierto ? null : d.fecha)}
                className="flex min-h-14 w-full flex-col justify-center gap-1.5 px-3 py-2 text-left active:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("flex-1 capitalize", d.fecha === hoy && "font-semibold")}>
                    {diaCorto(d.fecha)}
                    {d.fecha === hoy && <span className="font-normal normal-case text-muted-foreground"> · hoy</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{formatoGs(d.monto)}</span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", estaAbierto && "rotate-180")} />
                </span>
                <span className="block h-1.5 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                    style={{ width: `${(Math.max(d.monto, 0) / maximo) * 100}%` }}
                  />
                </span>
              </button>
              {estaAbierto && (
                <div className="border-t bg-muted/40">
                  <Detalle filas={semana.detalle[d.fecha] ?? []} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="flex items-center justify-between px-3 font-medium">
        <span>Total de la semana</span>
        <span className="font-semibold tabular-nums">{formatoGs(semana.total)}</span>
      </p>
    </div>
  );
}
