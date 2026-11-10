import { Check, X } from "lucide-react";

import { horaCorta, type Tramo } from "@/lib/agenda/bloques";
import { CLASES_COLOR, estiloGrupo, estiloTurno, leyendaTipos, type EstiloTurno, type MarcaEstado } from "@/lib/agenda/colores";
import { agruparTurnos, encabezadoGrupo, textoGrupo, type ItemGrilla } from "@/lib/agenda/grupos";
import { diaCorto, numeroDia } from "@/lib/agenda/calendario";
import { filasSemana } from "@/lib/agenda/semana";
import { NOMBRE_ESTADO_TURNO, textoEstado, textoTurno, type Dia, type FilaDia, type TurnoAgenda } from "@/lib/agenda/turnos";
import { cn } from "@/lib/utils";

// Vistas de la agenda (solo lectura). Reciben los días ya armados con
// armarDia; acá solo se dibuja.

// Relleno = color del tipo de turno; estado = borde + ícono (src/lib/agenda/colores.ts).
// Reservado y ocupado, en gris. Siempre con texto o ícono, no solo color.

/** ✓ vino, ✕ no vino, ½ asistencia mezclada en una sesión doble o grupal (con texto para lectores de pantalla). */
function IconoEstado({ marca, className }: { marca: MarcaEstado; className?: string }) {
  if (marca === "mezcla") {
    return (
      <span aria-label="Asistencia mezclada" className={cn("shrink-0 text-center text-[0.7rem] font-bold leading-none", className)}>
        ½
      </span>
    );
  }
  if (marca === "vino") return <Check aria-label="Vino" className={cn("shrink-0 text-emerald-700 dark:text-emerald-300", className)} strokeWidth={3} />;
  if (marca === "no_vino") return <X aria-label="No vino" className={cn("shrink-0 text-rose-700 dark:text-rose-300", className)} strokeWidth={3} />;
  return null;
}

/** "%" chiquito: el turno tiene una excepción de cobro. */
function MarcaExcepcion() {
  return (
    <span aria-label="Con excepción de cobro" className="shrink-0 rounded-sm bg-background/70 px-0.5 text-[0.6rem] font-semibold leading-none">
      %
    </span>
  );
}

/** Leyenda abajo de la grilla: los tipos de turno que aparecen y qué significan los bordes. */
export function LeyendaAgenda({ turnos }: { turnos: TurnoAgenda[] }) {
  const tipos = leyendaTipos(turnos);
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {tipos.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Tipos de turno">
          {tipos.map((t) => (
            <li key={t.nombre} className="flex items-center gap-1">
              <span className={cn("size-3 shrink-0 rounded-full", CLASES_COLOR[t.color].muestra)} />
              {t.nombre}
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Estados">
        <li className="flex items-center gap-1">
          <span className="size-3 shrink-0 rounded-sm border-2 border-emerald-600" />
          <IconoEstado marca="vino" className="size-3" /> Vino
        </li>
        <li className="flex items-center gap-1">
          <span className="size-3 shrink-0 rounded-sm border-2 border-rose-600" />
          <IconoEstado marca="no_vino" className="size-3" /> No vino
        </li>
        <li className="flex items-center gap-1">
          <IconoEstado marca="mezcla" className="size-3" /> Doble o grupal: unos sí, otros no
        </li>
        <li className="flex items-center gap-1">
          <span className="rounded-sm border px-0.5 text-[0.6rem] font-semibold leading-none">%</span> Excepción de cobro
        </li>
        <li className="flex items-center gap-1">
          <span className="size-3 shrink-0 rounded-sm border border-border bg-muted" /> Reservado u ocupado
        </li>
      </ul>
    </div>
  );
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
      {agruparTurnos(fila.turnos).map((item) =>
        item.tipo === "grupo" ? <TarjetaGrupo key={item.grupoId} turnos={item.turnos} /> : <TarjetaTurno key={item.turno.id} turno={item.turno} />,
      )}
      {fila.liberados.map((t) => (
        <span key={t.id} className="px-3 text-xs text-muted-foreground">
          <span className="line-through">{textoTurno(t)}</span> · {textoEstado(t) ?? NOMBRE_ESTADO_TURNO[t.estado]}
        </span>
      ))}
    </>
  );
}

function TarjetaTurno({ turno, aviso }: { turno: TurnoAgenda; aviso?: string }) {
  const estilo = estiloTurno(turno);
  const detalle = [
    turno.clase === "turno" ? turno.tipo : null,
    `${horaCorta(turno.inicio)}–${horaCorta(turno.fin)}`,
    textoEstado(turno),
    aviso,
    turno.guardando ? "Guardando…" : null,
  ].filter(Boolean);
  return (
    <span className={cn("flex min-h-12 w-full flex-col justify-center rounded-lg px-3 py-2", estilo.clases, turno.guardando && "opacity-60")}>
      <span className="flex items-center gap-1.5">
        <IconoEstado marca={estilo.marca} className="size-4" />
        <span className="truncate font-medium">{textoTurno(turno)}</span>
        {estilo.excepcion && <MarcaExcepcion />}
      </span>
      <span className="text-xs opacity-80">{detalle.join(" · ")}</span>
    </span>
  );
}

/** Sesión doble o grupal en la vista Día: un solo rectángulo ("Juan + Pedro" o "Grupal · 4"). */
function TarjetaGrupo({ turnos }: { turnos: TurnoAgenda[] }) {
  const estilo = estiloGrupo(turnos);
  const primero = turnos[0];
  const guardando = turnos.some((t) => t.guardando);
  const detalle = [encabezadoGrupo(primero.tipo, turnos.length), `${horaCorta(primero.inicio)}–${horaCorta(primero.fin)}`, guardando ? "Guardando…" : null].filter(
    Boolean,
  );
  return (
    <span className={cn("flex min-h-12 w-full flex-col justify-center rounded-lg px-3 py-2", estilo.clases, guardando && "opacity-60")}>
      <span className="flex items-center gap-1.5">
        <IconoEstado marca={estilo.marca} className="size-4" />
        <span className="truncate font-medium">{textoGrupo(turnos)}</span>
        {estilo.excepcion && <MarcaExcepcion />}
      </span>
      <span className="text-xs opacity-80">{detalle.join(" · ")}</span>
    </span>
  );
}

/** Grilla de la semana: una columna por día y una fila por horario de bloque. */
export function VistaSemana({
  dias,
  tramos,
  hoy,
  alElegirDia,
  alElegirFila,
}: {
  dias: Dia[];
  /** Horario de atención: los huecos entre tramos se dibujan como franja gris (almuerzo). */
  tramos: Tramo[];
  hoy: string;
  alElegirDia: (fecha: string) => void;
  /** Tocar una celda: abre ese día con esa fila abierta. */
  alElegirFila?: (fecha: string, clave: string) => void;
}) {
  const filas = filasSemana(dias, tramos);
  return (
    // Pensada para que lunes a viernes entren en el ancho del iPhone (sin deslizar de costado).
    <div className="-mx-4 overflow-x-auto px-2 md:mx-0 md:px-0">
      <table className="w-full min-w-[20rem] table-fixed border-separate border-spacing-0.5 text-sm md:border-spacing-1">
        <thead>
          <tr>
            <th className="w-9 md:w-12" />
            {dias.map((d) => (
              <th key={d.fecha} className="font-normal">
                <button
                  type="button"
                  onClick={() => alElegirDia(d.fecha)}
                  className={cn(
                    "h-11 w-full rounded-md text-xs capitalize active:bg-accent md:text-sm",
                    d.fecha === hoy && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {diaCorto(d.fecha)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) =>
            fila.tipo === "corte" ? (
              <tr key={`corte-${fila.desde}`}>
                <td className="pr-1 text-right align-middle text-[0.65rem] tabular-nums text-muted-foreground md:text-xs">
                  {horaCorta(fila.desde)}
                </td>
                {dias.map((d) => (
                  <td key={d.fecha} className="align-middle">
                    {fila.fechas.includes(d.fecha) ? (
                      // Solo visual: no se puede reservar ni tocar.
                      <div
                        className="flex h-7 items-center justify-center rounded-md bg-muted bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-border)_6px_8px)] text-[0.6rem] text-muted-foreground md:text-[0.65rem]"
                        title={`${fila.texto}: ${horaCorta(fila.desde)} a ${horaCorta(fila.hasta)}`}
                      >
                        <span className="truncate">{fila.texto}</span>
                      </div>
                    ) : (
                      <div className="h-7" />
                    )}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={fila.hora}>
                <td className="pr-1 text-right align-top text-[0.65rem] tabular-nums text-muted-foreground md:text-xs">{horaCorta(fila.hora)}</td>
                {dias.map((d) => (
                  <td key={d.fecha} className="align-top">
                    <CeldaSemana dia={d} hora={fila.hora} alElegir={(clave) => (alElegirFila ? alElegirFila(d.fecha, clave) : alElegirDia(d.fecha))} />
                  </td>
                ))}
              </tr>
            ),
          )}
          {filas.length === 0 && (
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
              <td key={d.fecha} className="text-center text-[0.65rem] leading-tight text-muted-foreground md:text-xs">
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
        agruparTurnos(turnos).map((item) => <CeldaTurno key={item.tipo === "grupo" ? item.grupoId : item.turno.id} item={item} />)
      )}
    </button>
  );
}

/** Un rectángulo de la celda de la semana: un turno, o una sesión doble o grupal entera. */
function CeldaTurno({ item }: { item: ItemGrilla }) {
  const grupo = item.tipo === "grupo";
  const estilo: EstiloTurno = grupo ? estiloGrupo(item.turnos) : estiloTurno(item.turno);
  const texto = grupo ? textoGrupo(item.turnos) : textoTurno(item.turno);
  const guardando = grupo ? item.turnos.some((t) => t.guardando) : item.turno.guardando;
  const estado = grupo ? encabezadoGrupo(item.turnos[0].tipo, item.turnos.length) : textoEstado(item.turno);
  return (
    <span className={cn("flex min-h-12 min-w-0 flex-col justify-center rounded-md px-1 py-1 md:px-1.5", estilo.clases, guardando && "opacity-60")}>
      <span className="flex min-w-0 items-start gap-0.5">
        <IconoEstado marca={estilo.marca} className="mt-px size-3" />
        <span className="line-clamp-2 min-w-0 hyphens-auto break-words text-[0.7rem] font-medium leading-tight md:text-xs">{texto}</span>
        {estilo.excepcion && <MarcaExcepcion />}
      </span>
      {/* En el iPhone alcanza con el ícono y el borde; en pantallas grandes, también el texto. */}
      {estado && <span className="hidden text-[0.65rem] leading-tight opacity-80 md:block">{estado}</span>}
    </span>
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
