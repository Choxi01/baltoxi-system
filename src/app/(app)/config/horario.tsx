"use client";

import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResultadoGuardarHorario } from "@/lib/agenda/acciones";
import { aHora, aMinutos, bloquesDeTramos, horaCorta, type Tramo } from "@/lib/agenda/bloques";
import { copiarDia, DIAS, DURACIONES, HORAS, MINUTOS, nombreDia } from "@/lib/agenda/horario";

type Horario = { duracion: number; tramos: Tramo[] };
// Cada tramo lleva una clave para que React no los mezcle al agregar o quitar.
type TramoEditable = Tramo & { clave: number };

let siguienteClave = 0;
const conClave = (t: Tramo): TramoEditable => ({ ...t, clave: siguienteClave++ });

// Horario de atención: primero un resumen para leer; con "Editar" se abre el editor.
export function Horario({
  inicial,
  guardar,
}: {
  inicial: Horario;
  guardar: (datos: Horario) => Promise<ResultadoGuardarHorario>;
}) {
  // Lo guardado se muestra desde acá, así el resumen cambia al instante (sin esperar al servidor).
  const [actual, setActual] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  if (editando) {
    return (
      <EditorHorario
        inicial={actual}
        guardar={guardar}
        alCancelar={() => setEditando(false)}
        alGuardar={(nuevo) => {
          setActual(nuevo);
          setEditando(false);
          setGuardado(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        size="touch"
        variant="outline"
        onClick={() => {
          setGuardado(false);
          setEditando(true);
        }}
      >
        <Pencil /> Editar horario
      </Button>
      {guardado && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Guardado ✓
        </p>
      )}
      <dl className="divide-y rounded-lg border">
        {DIAS.map(({ numero, nombre }) => {
          const tramos = ordenar(actual.tramos.filter((t) => t.dia_semana === numero));
          const bloques = bloquesDeTramos(tramos, actual.duracion).length;
          return (
            <div key={numero} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <dt className="font-medium">{nombre}</dt>
              <dd className="text-right">
                {tramos.length === 0 ? (
                  <span className="text-muted-foreground">No atiende</span>
                ) : (
                  <>
                    {tramos.map((t) => `${horaCorta(t.desde)}–${horaCorta(t.hasta)}`).join(" · ")}
                    <span className="block text-xs text-muted-foreground">
                      {bloques} {bloques === 1 ? "bloque" : "bloques"}
                    </span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="font-medium">Duración del bloque</dt>
          <dd>{actual.duracion} minutos</dd>
        </div>
      </dl>
    </div>
  );
}

function ordenar<T extends Tramo>(tramos: T[]): T[] {
  return [...tramos].sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde));
}

/** Tramo nuevo: después del último del día (o 9:00–12:00 si no hay ninguno). */
function tramoNuevo(dia: number, existentes: Tramo[]): Tramo {
  const ultimo = ordenar(existentes).at(-1);
  if (!ultimo) return { dia_semana: dia, desde: "09:00", hasta: "12:00" };
  const desde = Math.min(aMinutos(ultimo.hasta) + 60, 21 * 60);
  return { dia_semana: dia, desde: aHora(desde), hasta: aHora(Math.min(desde + 180, 22 * 60)) };
}

function EditorHorario({
  inicial,
  guardar,
  alCancelar,
  alGuardar,
}: {
  inicial: Horario;
  guardar: (datos: Horario) => Promise<ResultadoGuardarHorario>;
  alCancelar: () => void;
  alGuardar: (nuevo: Horario) => void;
}) {
  const [duracion, setDuracion] = useState(inicial.duracion);
  const [tramos, setTramos] = useState(() => ordenar(inicial.tramos).map(conClave));
  const [copiando, setCopiando] = useState<number | null>(null);
  const [errores, setErrores] = useState<{ general?: string; porDia: Partial<Record<number, string>> }>({ porDia: {} });
  const [enviando, iniciar] = useTransition();

  function cambiar(clave: number, campo: "desde" | "hasta", valor: string) {
    setTramos((ts) => ts.map((t) => (t.clave === clave ? { ...t, [campo]: valor } : t)));
  }

  function enviar() {
    const datos = { duracion, tramos: tramos.map(({ dia_semana, desde, hasta }) => ({ dia_semana, desde, hasta })) };
    iniciar(async () => {
      const r = await guardar(datos);
      if (r.ok) alGuardar(datos);
      else setErrores({ general: r.general, porDia: r.porDia });
    });
  }

  const hayErrores = !!errores.general || Object.keys(errores.porDia).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <Label htmlFor="duracion">Duración del bloque</Label>
        <Select id="duracion" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
          {(DURACIONES.includes(duracion) ? DURACIONES : [...DURACIONES, duracion].sort((a, b) => a - b)).map((d) => (
            <option key={d} value={d}>
              {d} minutos
            </option>
          ))}
        </Select>
      </div>

      {DIAS.map(({ numero, nombre }) => {
        const delDia = tramos.filter((t) => t.dia_semana === numero);
        const bloques = bloquesDeTramos(delDia, duracion);
        const error = errores.porDia[numero];
        return (
          <fieldset key={numero} className="flex flex-col gap-3 rounded-lg border p-4" aria-invalid={!!error}>
            <legend className="px-1 text-sm font-semibold">{nombre}</legend>
            {delDia.length === 0 && <p className="text-sm text-muted-foreground">No atiende.</p>}
            {delDia.map((t) => (
              <div key={t.clave} className="flex flex-wrap items-end gap-2">
                <SelectorHora etiqueta={`${nombre}: desde`} texto="Desde" valor={t.desde} alCambiar={(v) => cambiar(t.clave, "desde", v)} />
                <SelectorHora etiqueta={`${nombre}: hasta`} texto="Hasta" valor={t.hasta} alCambiar={(v) => cambiar(t.clave, "hasta", v)} />
                <Button
                  type="button"
                  variant="ghost"
                  className="size-12"
                  aria-label={`Quitar el tramo ${t.desde}–${t.hasta} del ${nombre.toLowerCase()}`}
                  onClick={() => setTramos((ts) => ts.filter((x) => x.clave !== t.clave))}
                >
                  <Trash2 className="size-5" />
                </Button>
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {delDia.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {bloques.length === 0 ? "Ningún bloque entra entero." : `Bloques: ${bloques.map((b) => horaCorta(b.inicio)).join(", ")}`}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={() => setTramos((ts) => [...ts, conClave(tramoNuevo(numero, delDia))])}>
                <Plus /> Agregar tramo
              </Button>
              {delDia.length > 0 && (
                <Button type="button" variant="outline" className="h-11" onClick={() => setCopiando(copiando === numero ? null : numero)}>
                  <Copy /> Copiar a otros días
                </Button>
              )}
            </div>
            {copiando === numero && (
              <CopiarA
                origen={numero}
                alCopiar={(destinos) => {
                  setTramos((ts) => ordenar(copiarDia(ts, numero, destinos, conClave)));
                  setCopiando(null);
                }}
                alCancelar={() => setCopiando(null)}
              />
            )}
          </fieldset>
        );
      })}

      {hayErrores && (
        <p role="alert" className="text-sm text-destructive">
          {errores.general ?? "Revisá los días marcados."}
        </p>
      )}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col gap-2 bg-background py-2 md:bottom-0">
        <Button type="button" size="touch" onClick={enviar} disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar horario"}
        </Button>
        <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Hora con dos ruedas (hora y minutos). */
function SelectorHora({
  etiqueta,
  texto,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  texto: string;
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  const [h, m] = valor.split(":").map(Number);
  // Si lo guardado no está en las ruedas (ej. 5:00 o 9:07), se agrega para no perderlo.
  const horas = HORAS.includes(h) ? HORAS : [...HORAS, h].sort((a, b) => a - b);
  const minutos = MINUTOS.includes(m) ? MINUTOS : [...MINUTOS, m].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{texto}</span>
      <div className="flex items-center gap-1" role="group" aria-label={etiqueta}>
        <Select aria-label={`${etiqueta} (hora)`} className="w-[4.5rem]" value={h} onChange={(e) => alCambiar(aHora(Number(e.target.value) * 60 + m))}>
          {horas.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        <span aria-hidden>:</span>
        <Select aria-label={`${etiqueta} (minutos)`} className="w-[4.5rem]" value={m} onChange={(e) => alCambiar(aHora(h * 60 + Number(e.target.value)))}>
          {minutos.map((x) => (
            <option key={x} value={x}>
              {String(x).padStart(2, "0")}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

/** Elegir a qué días copiar el horario de un día. */
function CopiarA({ origen, alCopiar, alCancelar }: { origen: number; alCopiar: (destinos: number[]) => void; alCancelar: () => void }) {
  const [elegidos, setElegidos] = useState<number[]>([]);
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-3">
      <p className="text-sm">
        Copiar el horario del {nombreDia(origen).toLowerCase()} a (reemplaza lo que tengan):
      </p>
      <div className="grid grid-cols-2 gap-1">
        {DIAS.filter((d) => d.numero !== origen).map((d) => (
          <label key={d.numero} className="flex h-11 items-center gap-3 px-1">
            <input
              type="checkbox"
              className="size-5"
              checked={elegidos.includes(d.numero)}
              onChange={(e) => setElegidos((xs) => (e.target.checked ? [...xs, d.numero] : xs.filter((x) => x !== d.numero)))}
            />
            {d.nombre}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" className="h-11 flex-1" disabled={elegidos.length === 0} onClick={() => alCopiar(elegidos)}>
          Copiar
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
