"use client";

import { useState } from "react";

import { numeroDia, tituloDia, tituloMes } from "@/lib/agenda/calendario";
import { formatoGs } from "@/lib/cobro/formato";
import { marcasEje, mesCorto, montoCorto, textoHoras, type MesComparado, type PuntoMes } from "@/lib/cobro/reportes";
import { cn } from "@/lib/utils";

// Gráficos en SVG propio (sin librería). Azul = generado; naranja = cobrado: los dos pasan la revisión
// de daltonismo en claro y en oscuro. El texto usa los colores de texto de la app, nunca el de la serie.
// El viewBox es angosto para que en iPhone las letras se lean; en pantallas grandes se limita el ancho.

const ANCHO = 360;
const ALTO = 220;
const M = { arriba: 12, derecha: 12, abajo: 22, izquierda: 44 };
const PLOT_ALTO = ALTO - M.arriba - M.abajo;
const PLOT_ANCHO = ANCHO - M.izquierda - M.derecha;

const LINEA_GENERADO = "stroke-[#2a78d6] dark:stroke-[#3987e5]";
const RELLENO_GENERADO = "fill-[#2a78d6] dark:fill-[#3987e5]";
const RELLENO_COBRADO = "fill-[#eb6834] dark:fill-[#d95926]";

function Eje({ marcas, y }: { marcas: number[]; y: (v: number) => number }) {
  return marcas.map((m) => (
    <g key={m}>
      <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(m)} y2={y(m)} className="stroke-border" strokeWidth={1} />
      <text x={M.izquierda - 6} y={y(m) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
        {montoCorto(m)}
      </text>
    </g>
  ));
}

const camino = (puntos: [number, number][]) => puntos.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/** Generado acumulado del mes y proyección punteada. Tocar o deslizar sobre el gráfico muestra el monto de ese día. */
export function GraficoLineas({ serie, dias, hoy }: { serie: PuntoMes[]; dias: { fecha: string; monto: number }[]; hoy: string }) {
  const hayProyeccion = serie.filter((p) => p.proyeccion !== null).length > 1;
  const ultimoReal = serie.findLastIndex((p) => p.real !== null);
  const [elegido, setElegido] = useState(Math.max(ultimoReal, 0));

  const valores = serie.flatMap((p) => [p.real ?? 0, p.proyeccion ?? 0]);
  const marcas = marcasEje(Math.max(...valores));
  const tope = marcas.at(-1)!;
  const x = (i: number) => M.izquierda + (i / Math.max(serie.length - 1, 1)) * PLOT_ANCHO;
  const y = (v: number) => M.arriba + PLOT_ALTO - (Math.max(v, 0) / tope) * PLOT_ALTO;

  const real = serie.flatMap((p, i): [number, number][] => (p.real === null ? [] : [[x(i), y(p.real)]]));
  const proyeccion = serie.flatMap((p, i): [number, number][] => (p.proyeccion === null ? [] : [[x(i), y(p.proyeccion)]]));
  const etiquetas = [1, 10, 20, serie.length];

  function elegirDesde(evento: React.PointerEvent<SVGSVGElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();
    const enViewBox = ((evento.clientX - caja.left) / caja.width) * ANCHO;
    const i = Math.round(((enViewBox - M.izquierda) / PLOT_ANCHO) * (serie.length - 1));
    setElegido(Math.min(Math.max(i, 0), serie.length - 1));
  }

  const punto = serie[elegido];
  const fin = serie.at(-1)!;

  return (
    <div className="flex max-w-xl flex-col gap-2">
      <p className="min-h-10 text-sm" aria-live="polite">
        <span className="block text-muted-foreground">{tituloDia(punto.fecha)}</span>
        <span className="font-semibold tabular-nums">
          {punto.real !== null ? `${formatoGs(punto.real)} generado` : `${formatoGs(punto.proyeccion ?? 0)} proyectado`}
        </span>
      </p>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={`Generado acumulado del mes${hayProyeccion ? ` y proyección hasta ${formatoGs(fin.proyeccion ?? 0)}` : ""}. El detalle está en la tabla de abajo.`}
        className="w-full touch-pan-y select-none"
        onPointerDown={elegirDesde}
        onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons > 0) && elegirDesde(e)}
      >
        <Eje marcas={marcas} y={y} />
        {etiquetas.map((d) => (
          <text key={d} x={x(d - 1)} y={ALTO - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
            {d}
          </text>
        ))}
        <line x1={x(elegido)} x2={x(elegido)} y1={M.arriba} y2={M.arriba + PLOT_ALTO} className="stroke-muted-foreground/50" strokeWidth={1} />
        {hayProyeccion && (
          <path
            d={camino(proyeccion)}
            fill="none"
            strokeWidth={2}
            strokeDasharray="2 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={LINEA_GENERADO}
          />
        )}
        <path d={camino(real)} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={LINEA_GENERADO} />
        {real.length > 0 && <circle cx={real.at(-1)![0]} cy={real.at(-1)![1]} r={4} strokeWidth={2} className={cn(RELLENO_GENERADO, "stroke-background")} />}
        {hayProyeccion && (
          <circle cx={proyeccion.at(-1)![0]} cy={proyeccion.at(-1)![1]} r={4} strokeWidth={2} className={cn(RELLENO_GENERADO, "stroke-background")} />
        )}
      </svg>

      {hayProyeccion && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden>
              <line x1="1" x2="17" y1="2" y2="2" strokeWidth={2} strokeLinecap="round" className={LINEA_GENERADO} />
            </svg>
            Generado
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden>
              <line x1="1" x2="17" y1="2" y2="2" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 5" className={LINEA_GENERADO} />
            </svg>
            Proyección
          </span>
        </div>
      )}

      <details className="rounded-lg border">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">Ver día por día</summary>
        <table className="w-full border-t text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-normal">Día</th>
              <th className="px-3 py-1.5 text-right font-normal">Generado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {dias
              .filter((d) => d.fecha <= hoy || d.monto !== 0)
              .map((d) => (
                <tr key={d.fecha}>
                  <td className="px-3 py-1.5 tabular-nums">{numeroDia(d.fecha)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatoGs(d.monto)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Columna con la punta redondeada y la base recta, apoyada en el eje. */
function barra(x: number, y: number, ancho: number, base: number) {
  const r = Math.min(4, ancho / 2, base - y);
  return `M${x} ${base} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + ancho - r} Q${x + ancho} ${y} ${x + ancho} ${y + r} V${base} Z`;
}

/** Comparación de 6 meses: barras de generado y cobrado, con los montos exactos abajo. */
export function GraficoBarras({ meses, mesElegido }: { meses: MesComparado[]; mesElegido: string }) {
  const marcas = marcasEje(Math.max(...meses.flatMap((m) => [m.generado, m.cobrado])));
  const tope = marcas.at(-1)!;
  const base = M.arriba + PLOT_ALTO;
  const y = (v: number) => base - (Math.max(v, 0) / tope) * PLOT_ALTO;
  const lugar = PLOT_ANCHO / meses.length;
  const anchoBarra = Math.min(18, (lugar - 10) / 2);

  return (
    <div className="flex max-w-xl flex-col gap-3 pt-4">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Generado y cobrado de los últimos 6 meses. Los montos están en la lista de abajo." className="w-full">
        <Eje marcas={marcas} y={y} />
        {meses.map((m, i) => {
          const centro = M.izquierda + lugar * (i + 0.5);
          const x1 = centro - anchoBarra - 1;
          const x2 = centro + 1;
          return (
            <g key={m.mes}>
              {m.generado > 0 && (
                <path d={barra(x1, y(m.generado), anchoBarra, base)} className={RELLENO_GENERADO}>
                  <title>{`${tituloMes(m.mes)}: generado ${formatoGs(m.generado)}`}</title>
                </path>
              )}
              {m.cobrado > 0 && (
                <path d={barra(x2, y(m.cobrado), anchoBarra, base)} className={RELLENO_COBRADO}>
                  <title>{`${tituloMes(m.mes)}: cobrado ${formatoGs(m.cobrado)}`}</title>
                </path>
              )}
              <text
                x={centro}
                y={ALTO - 6}
                textAnchor="middle"
                className={cn("text-[10px]", m.mes === mesElegido ? "fill-foreground font-semibold" : "fill-muted-foreground")}
              >
                {mesCorto(m.mes)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <rect width="10" height="10" rx="2" className={RELLENO_GENERADO} />
          </svg>
          Generado
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <rect width="10" height="10" rx="2" className={RELLENO_COBRADO} />
          </svg>
          Cobrado
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {[...meses].reverse().map((m) => (
          <li key={m.mes} className="rounded-lg border p-3">
            <p className="font-medium">{tituloMes(m.mes)}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {(
                [
                  ["Generado", formatoGs(m.generado)],
                  ["Cobrado", formatoGs(m.cobrado)],
                  ["Pendiente", formatoGs(m.pendiente)],
                  ["Horas", textoHoras(m.horas)],
                ] as const
              ).map(([titulo, valor]) => (
                <div key={titulo}>
                  <dt className="text-xs text-muted-foreground">{titulo}</dt>
                  <dd className="font-medium tabular-nums">{valor}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
