import { horaCorta } from "@/lib/agenda/bloques";
import { diaCorto, numeroDia } from "@/lib/agenda/calendario";
import { NOMBRE_ESTADO_TURNO, textoTurno, type Dia, type FilaDia, type TurnoAgenda } from "@/lib/agenda/turnos";
import { cn } from "@/lib/utils";

// Vistas de la agenda (solo lectura). Reciben los días ya armados con
// armarDia; acá solo se dibuja.

/** Color por estado; reservado y ocupado en gris. Siempre con texto, no solo color. */
function colorTurno(t: TurnoAgenda): string {
  if (t.clase !== "turno") return "border-border bg-muted text-muted-foreground";
  if (t.estado === "presente") return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50";
  if (t.estado === "ausente_sin_aviso") return "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-50";
  return "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-50";
}

function AvisoBloqueo({ dia }: { dia: Dia }) {
  if (!dia.bloqueo) return null;
  return (
    <p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground">
      Sin agenda: {dia.bloqueo.motivo || "feriado o vacaciones"}.
    </p>
  );
}

/** Clave de una fila del día (para saber cuál tiene el panel abierto). */
export function claveFila(fecha: string, fila: FilaDia): string {
  return `${fecha}|${fila.inicio}|${fila.tipo === "fuera" ? fila.turno.id : "bloque"}`;
}

export function VistaDia({
  dia,
  abierta,
  alTocar,
  panel,
}: {
  dia: Dia;
  /** Clave de la fila con el panel abierto (ver claveFila). */
  abierta?: string | null;
  alTocar?: (clave: string) => void;
  /** Lo que se muestra debajo de la fila abierta (acciones). */
  panel?: (fila: FilaDia) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AvisoBloqueo dia={dia} />
      {dia.filas.length === 0 && !dia.bloqueo && <p className="text-muted-foreground">No atendés este día.</p>}
      {dia.filas.length > 0 && (
        <ol className="flex flex-col gap-2">
          {dia.filas.map((f) => {
            const clave = claveFila(dia.fecha, f);
            const abiertaEsta = abierta === clave;
            return (
              <li key={clave} className="flex gap-3">
                <span className="w-12 shrink-0 pt-3 text-right text-sm tabular-nums text-muted-foreground">{horaCorta(f.inicio)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <button
                    type="button"
                    className="flex flex-col gap-1 text-left disabled:cursor-default"
                    aria-expanded={alTocar ? abiertaEsta : undefined}
                    disabled={!alTocar}
                    onClick={() => alTocar?.(clave)}
                  >
                    <ContenidoFila fila={f} />
                  </button>
                  {abiertaEsta && panel?.(f)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ContenidoFila({ fila }: { fila: FilaDia }) {
  if (fila.tipo === "fuera") return <TarjetaTurno turno={fila.turno} aviso="Fuera del horario" />;
  return (
    <>
      {fila.turnos.length === 0 && (
        <span className="flex min-h-12 w-full items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground active:bg-accent">
          Libre
        </span>
      )}
      {fila.turnos.map((t) => (
        <TarjetaTurno key={t.id} turno={t} />
      ))}
      {fila.liberados.map((t) => (
        <span key={t.id} className="px-3 text-xs text-muted-foreground">
          <span className="line-through">{textoTurno(t)}</span> · {NOMBRE_ESTADO_TURNO[t.estado]}
        </span>
      ))}
    </>
  );
}

function TarjetaTurno({ turno, aviso }: { turno: TurnoAgenda; aviso?: string }) {
  const detalle = [
    turno.clase === "turno" ? turno.tipo : null,
    `${horaCorta(turno.inicio)}–${horaCorta(turno.fin)}`,
    turno.clase === "turno" && turno.estado !== "agendado" ? NOMBRE_ESTADO_TURNO[turno.estado] : null,
    aviso,
  ].filter(Boolean);
  return (
    <span className={cn("flex min-h-12 w-full flex-col justify-center rounded-lg border px-3 py-2", colorTurno(turno))}>
      <span className="truncate font-medium">{textoTurno(turno)}</span>
      <span className="text-xs opacity-80">{detalle.join(" · ")}</span>
    </span>
  );
}

/** Grilla de la semana: una columna por día y una fila por horario de bloque. */
export function VistaSemana({
  dias,
  hoy,
  alElegirDia,
  alElegirFila,
}: {
  dias: Dia[];
  hoy: string;
  alElegirDia: (fecha: string) => void;
  /** Tocar una celda: abre ese día con esa fila abierta. */
  alElegirFila?: (fecha: string, clave: string) => void;
}) {
  const horas = [...new Set(dias.flatMap((d) => d.filas.map((f) => f.inicio)))].sort();
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[36rem] table-fixed border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-12" />
            {dias.map((d) => (
              <th key={d.fecha} className="font-normal">
                <button
                  type="button"
                  onClick={() => alElegirDia(d.fecha)}
                  className={cn("h-11 w-full rounded-md capitalize active:bg-accent", d.fecha === hoy && "bg-primary font-semibold text-primary-foreground")}
                >
                  {diaCorto(d.fecha)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horas.map((hora) => (
            <tr key={hora}>
              <td className="pr-1 text-right align-top text-xs tabular-nums text-muted-foreground">{horaCorta(hora)}</td>
              {dias.map((d) => (
                <td key={d.fecha} className="align-top">
                  <CeldaSemana dia={d} hora={hora} alElegir={(clave) => (alElegirFila ? alElegirFila(d.fecha, clave) : alElegirDia(d.fecha))} />
                </td>
              ))}
            </tr>
          ))}
          {horas.length === 0 && (
            <tr>
              <td />
              <td colSpan={dias.length} className="py-4 text-center text-muted-foreground">
                No hay horarios esta semana.
              </td>
            </tr>
          )}
          <tr>
            <td />
            {dias.map((d) => (
              <td key={d.fecha} className="text-center text-xs text-muted-foreground">
                {d.bloqueo ? (d.bloqueo.motivo || "Sin agenda") : `${d.libres} ${d.libres === 1 ? "libre" : "libres"}`}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CeldaSemana({ dia, hora, alElegir }: { dia: Dia; hora: string; alElegir: (clave: string) => void }) {
  const filas = dia.filas.filter((f) => f.inicio === hora);
  if (filas.length === 0) return <div className="h-12" />;
  const turnos = filas.flatMap((f) => (f.tipo === "fuera" ? [f.turno] : f.turnos));
  return (
    <button type="button" onClick={() => alElegir(claveFila(dia.fecha, filas[0]))} className="flex w-full flex-col gap-1 text-left">
      {turnos.length === 0 ? (
        <span className="flex h-12 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">Libre</span>
      ) : (
        turnos.map((t) => (
          <span key={t.id} className={cn("flex min-h-12 flex-col justify-center rounded-md border px-1.5 py-1", colorTurno(t))}>
            <span className="line-clamp-2 text-xs font-medium leading-tight">{textoTurno(t)}</span>
            {t.clase === "turno" && t.estado !== "agendado" && (
              <span className="text-[0.65rem] leading-tight opacity-80">{NOMBRE_ESTADO_TURNO[t.estado]}</span>
            )}
          </span>
        ))
      )}
    </button>
  );
}

/** Calendario del mes con la cantidad de libres por día. */
export function VistaMes({
  semanas,
  mes,
  hoy,
  encabezados,
  alElegirDia,
}: {
  /** Semanas con solo los días visibles, ya armados. */
  semanas: Dia[][];
  /** "AAAA-MM" del mes que se muestra (los días de otros meses van más claros). */
  mes: string;
  hoy: string;
  encabezados: string[];
  alElegirDia: (fecha: string) => void;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${encabezados.length}, minmax(0, 1fr))` }}>
      {encabezados.map((e) => (
        <div key={e} className="pb-1 text-center text-xs capitalize text-muted-foreground">
          {e}
        </div>
      ))}
      {semanas.flat().map((d) => {
        const otroMes = !d.fecha.startsWith(mes);
        const tieneBloques = d.filas.some((f) => f.tipo === "bloque");
        let texto = "";
        if (d.bloqueo) texto = "Sin agenda";
        else if (d.fecha >= hoy && tieneBloques) texto = d.libres === 0 ? "Lleno" : `${d.libres} ${d.libres === 1 ? "libre" : "libres"}`;
        return (
          <button
            key={d.fecha}
            type="button"
            onClick={() => alElegirDia(d.fecha)}
            aria-label={`${d.fecha}: ${texto || "sin libres"}`}
            className={cn(
              "flex min-h-16 flex-col items-center justify-start gap-1 rounded-md border p-1 active:bg-accent",
              otroMes && "opacity-40",
              d.fecha === hoy && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="text-sm font-medium tabular-nums">{numeroDia(d.fecha)}</span>
            {texto && (
              <span
                className={cn(
                  "text-center text-[0.7rem] leading-tight",
                  d.libres > 0 && !d.bloqueo ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {texto}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
