"use client";

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
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
import { diaSemana, horaCorta } from "@/lib/agenda/bloques";
import { armarDia, type Dia, type TurnoAgenda } from "@/lib/agenda/turnos";
import { MensajeFamilia } from "@/components/app/mensaje-familia";
import type { MensajeListo } from "@/lib/mensajes/tipos";
import { cn } from "@/lib/utils";
import { CopiarLibres } from "./copiar-libres";
import { useTurnosOptimistas } from "./turnos-optimistas";
import { PanelFila, type DatosPanel, type Reposicion } from "./panel";
import { LeyendaAgenda, VistaDia, VistaMes, VistaSemana } from "./vistas";

const VISTAS: { id: Vista; titulo: string }[] = [
  { id: "dia", titulo: "Día" },
  { id: "semana", titulo: "Semana" },
  { id: "mes", titulo: "Mes" },
];

/** Los turnos que se ven en esos días (para la leyenda de colores). */
const turnosVisibles = (dias: Dia[]) => dias.flatMap((d) => d.filas.flatMap((f) => (f.tipo === "fuera" ? [f.turno] : f.turnos)));

/** Semana en todos los dispositivos (pedido de la profesional): Día y Mes, con los botones. */
const VISTA_POR_DEFECTO: Vista = "semana";

export function Agenda({
  hoy,
  fechaInicial,
  vistaInicial,
  rango,
  duracion,
  tramos,
  bloqueos,
  turnos,
  paraReponer,
  plantillaLibres,
  datosPanel,
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
  /** Sesiones que canceló la profesional este mes y todavía no tienen otro turno. */
  paraReponer: (Reposicion & { fecha: string; inicio: string })[];
  /** Plantilla `horarios_libres` del consultorio. */
  plantillaLibres: string;
  /** Pacientes, tipos de turno y acciones (sin duracion: va la del horario). */
  datosPanel: Omit<DatosPanel, "duracion">;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(fechaInicial);
  const [vista, setVista] = useState<Vista>(vistaInicial ?? VISTA_POR_DEFECTO);
  const [cargando, iniciar] = useTransition();
  // Fila de la vista Día con el panel de acciones abierto, y el último aviso ("Agendado ✓").
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Después de mover o cancelar: el WhatsApp para la familia.
  // Mensajes para avisar a las familias (después de mover o cancelar; al mover una sesión, uno por familia).
  const [ofrecidos, setOfrecidos] = useState<MensajeListo[]>([]);
  const setOfrecido = (m: MensajeListo | null) => setOfrecidos(m ? [m] : []);
  const [reponiendo, setReponiendo] = useState<Reposicion | null>(null);
  const [copiando, setCopiando] = useState(false);
  // Si el servidor no pudo guardar un cambio (el turno ya volvió a como estaba).
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Lo que se ve: los turnos del servidor más los cambios que se están guardando.
  const { turnos: turnosVista, ejecutar } = useTurnosOptimistas(turnos, {
    enviar: (texto) => {
      setAbierta(null);
      setErrorAccion(null);
      setAviso(texto);
      setOfrecido(null);
      setReponiendo(null);
    },
    aviso: setAviso,
    mensaje: (m) => setOfrecidos((antes) => [...antes.filter((x) => x.referencia !== m.referencia), m]),
    error: (texto) => {
      setAviso(null);
      setOfrecido(null);
      setErrorAccion(texto);
    },
  });

  // Todos los días cargados, armados una sola vez: cambiar de vista o de día es instantáneo.
  const dias = useMemo(() => {
    const mapa = new Map(fechasEntre(rango.desde, rango.hasta).map((f) => [f, armarDia(f, tramos, duracion, bloqueos, turnosVista)]));
    return mapa;
  }, [rango.desde, rango.hasta, tramos, duracion, bloqueos, turnosVista]);
  const visibles = useMemo(() => diasVisibles([...new Set(tramos.map((t) => t.dia_semana))]), [tramos]);

  function ir(nuevaFecha: string, nuevaVista: Vista = vista, filaAbierta: string | null = null) {
    setAbierta(filaAbierta);
    setAviso(null);
    setErrorAccion(null);
    setFecha(nuevaFecha);
    setVista(nuevaVista);
    const parametros = new URLSearchParams({ fecha: nuevaFecha });
    if (nuevaVista !== VISTA_POR_DEFECTO) parametros.set("vista", nuevaVista);
    if (cubre(rango, nuevaVista, nuevaFecha)) {
      window.history.replaceState(null, "", `?${parametros}`);
    } else {
      // Fuera de lo cargado: el servidor trae los turnos de esas fechas.
      iniciar(() => router.replace(`/agenda?${parametros}`, { scroll: false }));
    }
  }

  const listo = cubre(rango, vista, fecha);
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
          <Button variant="ghost" className="size-11" aria-label="Anterior" onClick={() => ir(mover(vista, fecha, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" className="size-11" aria-label="Siguiente" onClick={() => ir(mover(vista, fecha, 1))}>
            <ChevronRight className="size-5" />
          </Button>
          <h2 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
            {titulos[vista]}
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
              )}
            >
              {v.titulo}
            </button>
          ))}
        </div>
      </div>

      {copiando ? (
        listo && !cargando && (
          <CopiarLibres fecha={fecha} dias={dias} visibles={visibles} plantilla={plantillaLibres} alCerrar={() => setCopiando(false)} />
        )
      ) : (
        <Button variant="outline" className="h-12 self-start" onClick={() => setCopiando(true)}>
          <Copy /> Copiar libres
        </Button>
      )}

      {paraReponer.length > 0 && !reponiendo && (
        <section className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <h2 className="text-sm font-semibold">Para reponer este mes ({paraReponer.length})</h2>
          <ul className="flex flex-col gap-1">
            {paraReponer.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {r.titulo} · <span className="text-muted-foreground">{tituloDia(r.fecha)}, {horaCorta(r.inicio)}</span>
                </span>
                <Button
                  variant="outline"
                  className="h-10 shrink-0"
                  onClick={() => {
                    setAviso(null);
                    setAbierta(null);
                    setReponiendo(r);
                  }}
                >
                  Reponer
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {reponiendo && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          <span>Tocá un horario libre para reponer la sesión de {reponiendo.titulo}.</span>
          <Button variant="secondary" className="h-10 shrink-0" onClick={() => setReponiendo(null)}>
            Cancelar
          </Button>
        </div>
      )}
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
      {errorAccion && (
        <p role="alert" className="text-center text-sm text-destructive">
          {errorAccion}
        </p>
      )}
      {ofrecidos.map((m) => (
        <MensajeFamilia
          key={`${m.clave}-${m.referencia}`}
          mensaje={m}
          alCerrar={() => setOfrecidos((antes) => antes.filter((x) => x.referencia !== m.referencia))}
        />
      ))}
      {!listo || cargando ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {vista === "dia" && dia && (
            <VistaDia
              dia={dia}
              abierta={abierta}
              alTocar={(clave) => {
                setAviso(null);
                setErrorAccion(null);
                setAbierta(abierta === clave ? null : clave);
              }}
              panel={(fila) => (
                <PanelFila
                  fecha={dia.fecha}
                  fila={fila}
                  turnosDelDia={turnosVista.filter((t) => t.fecha === dia.fecha)}
                  datos={{ ...datosPanel, duracion }}
                  reponiendo={reponiendo}
                  ejecutar={ejecutar}
                  alCerrar={() => setAbierta(null)}
                  alGuardar={(texto, mensaje) => {
                    setAbierta(null);
                    setAviso(texto);
                    setOfrecido(mensaje ?? null);
                    setReponiendo(null);
                  }}
                />
              )}
            />
          )}
          {vista === "dia" && dia && <LeyendaAgenda turnos={turnosVisibles([dia])} />}
          {vista === "semana" && (
            <VistaSemana
              dias={semana}
              tramos={tramos}
              hoy={hoy}
              alElegirDia={(f) => ir(f, "dia")}
              alElegirFila={(f, clave) => ir(f, "dia", clave)}
            />
          )}
          {vista === "semana" && <LeyendaAgenda turnos={turnosVisibles(semana)} />}
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
