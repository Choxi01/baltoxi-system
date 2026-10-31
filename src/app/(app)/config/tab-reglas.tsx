"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NOMBRE_ESTADO_TURNO } from "@/lib/agenda/turnos";
import type { EstadoFormularioConfig } from "@/lib/config/acciones";
import { ESTADOS_CON_REGLA, type EstadoConRegla } from "@/lib/config/validacion";

type AccionForm = (anterior: EstadoFormularioConfig, formulario: FormData) => Promise<EstadoFormularioConfig>;
type Excepcion = { id: string; paciente: string; estado: string; porcentaje: number };

const nombreEstado = (estado: string) => NOMBRE_ESTADO_TURNO[estado as EstadoConRegla] ?? estado;

/** Aclaración de las cancelaciones con las horas de aviso del consultorio. */
function ayudaEstado(estado: string, horasAviso: number): string | null {
  if (estado === "ausente_con_aviso") return `Con ${horasAviso} h o más de aviso`;
  if (estado === "aviso_tardio") return `Con menos de ${horasAviso} h de aviso`;
  return null;
}

export function TabReglas({
  generales,
  excepciones,
  pacientes,
  horasAviso,
  guardar,
  agregarExcepcion,
  quitarExcepcion,
}: {
  generales: Record<string, number>;
  excepciones: Excepcion[];
  pacientes: { id: string; nombre: string }[];
  horasAviso: number;
  guardar: AccionForm;
  agregarExcepcion: AccionForm;
  quitarExcepcion: (id: string) => Promise<{ error: string | null }>;
}) {
  return (
    <div className="flex flex-col gap-8 pt-4">
      <p className="rounded-lg bg-muted p-3 text-sm">
        Cambiar una regla no toca los cobros ya hechos: solo se usa para los turnos que marques desde ahora.
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cuánto se cobra según el estado</h2>
        <p className="text-sm text-muted-foreground">Porcentaje de la tarifa que se cobra en cada caso.</p>
        <ReglasGenerales generales={generales} horasAviso={horasAviso} guardar={guardar} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Excepciones por paciente</h2>
        <p className="text-sm text-muted-foreground">Para ese paciente y ese estado se usa este porcentaje en vez del general.</p>
        <Excepciones
          excepciones={excepciones}
          pacientes={pacientes}
          horasAviso={horasAviso}
          agregar={agregarExcepcion}
          quitar={quitarExcepcion}
        />
      </section>
    </div>
  );
}

// Primero un resumen para leer; con "Editar" se abre el formulario (como la ficha del paciente).
function ReglasGenerales({ generales, horasAviso, guardar }: { generales: Record<string, number>; horasAviso: number; guardar: AccionForm }) {
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Envuelve la acción: si se guardó bien, vuelve al resumen.
  async function guardarYCerrar(anterior: EstadoFormularioConfig, formulario: FormData) {
    const resultado = await guardar(anterior, formulario);
    if (resultado.guardadoEn) {
      setEditando(false);
      setGuardado(true);
    }
    return resultado;
  }

  if (editando) {
    return <FormularioReglas accion={guardarYCerrar} generales={generales} horasAviso={horasAviso} alCancelar={() => setEditando(false)} />;
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
        <Pencil /> Editar
      </Button>
      {guardado && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Guardado ✓
        </p>
      )}
      <dl className="divide-y rounded-lg border">
        {ESTADOS_CON_REGLA.map((estado) => {
          const ayuda = ayudaEstado(estado, horasAviso);
          return (
            <div key={estado} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <dt className="flex flex-col">
                <span>{nombreEstado(estado)}</span>
                {ayuda && <span className="text-xs text-muted-foreground">{ayuda}</span>}
              </dt>
              <dd className="tabular-nums">{generales[estado] === undefined ? "—" : `${generales[estado]}%`}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function FormularioReglas({
  accion,
  generales,
  horasAviso,
  alCancelar,
}: {
  accion: AccionForm;
  generales: Record<string, number>;
  horasAviso: number;
  alCancelar: () => void;
}) {
  const [estado, enviar, enviando] = useActionState(accion, { errores: {}, guardadoEn: null } as EstadoFormularioConfig);
  const e = estado.errores;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      {ESTADOS_CON_REGLA.map((est) => {
        const ayuda = ayudaEstado(est, horasAviso);
        return (
          <div key={est} className="flex flex-col gap-2">
            <Label htmlFor={`regla-${est}`}>
              {nombreEstado(est)}
              {ayuda && <span className="font-normal text-muted-foreground"> · {ayuda.toLowerCase()}</span>}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`regla-${est}`}
                name={est}
                inputMode="numeric"
                className="w-24"
                defaultValue={estado.enviado?.[est] ?? String(generales[est] ?? "")}
                aria-invalid={!!e[est]}
              />
              <span>%</span>
            </div>
            {e[est] && <p className="text-sm text-destructive">{e[est]}</p>}
          </div>
        );
      })}
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar cambios"}
      </Button>
      <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}

function Excepciones({
  excepciones,
  pacientes,
  horasAviso,
  agregar,
  quitar,
}: {
  excepciones: Excepcion[];
  pacientes: { id: string; nombre: string }[];
  horasAviso: number;
  agregar: AccionForm;
  quitar: (id: string) => Promise<{ error: string | null }>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
      {excepciones.length === 0 && <p className="text-sm text-muted-foreground">No hay excepciones.</p>}
      {excepciones.map((x) => (
        <FilaExcepcion key={x.id} excepcion={x} horasAviso={horasAviso} quitar={quitar} alAvisar={setAviso} />
      ))}

      {abierto ? (
        <FormularioExcepcion
          accion={agregar}
          pacientes={pacientes}
          horasAviso={horasAviso}
          alCancelar={() => setAbierto(false)}
          alGuardar={() => {
            setAbierto(false);
            setAviso("Excepción agregada ✓");
          }}
        />
      ) : (
        <Button
          size="touch"
          variant="outline"
          onClick={() => {
            setAviso(null);
            setAbierto(true);
          }}
        >
          <Plus /> Agregar excepción
        </Button>
      )}
    </div>
  );
}

function FilaExcepcion({
  excepcion,
  horasAviso,
  quitar,
  alAvisar,
}: {
  excepcion: Excepcion;
  horasAviso: number;
  quitar: (id: string) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  const ayuda = ayudaEstado(excepcion.estado, horasAviso);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex flex-col">
        <span className="font-medium">{excepcion.paciente}</span>
        <span className="text-sm text-muted-foreground">
          {nombreEstado(excepcion.estado)}
          {ayuda && ` (${ayuda.toLowerCase()})`} · <span className="tabular-nums">{excepcion.porcentaje}%</span>
        </span>
      </div>
      <Button
        variant="ghost"
        disabled={ocupado}
        onClick={() => {
          if (!window.confirm(`¿Quitar la excepción de ${excepcion.paciente}?\nVuelve a usar la regla general.`)) return;
          iniciar(async () => {
            const r = await quitar(excepcion.id);
            alAvisar(r.error ?? "Excepción quitada.");
          });
        }}
      >
        Quitar
      </Button>
    </div>
  );
}

function FormularioExcepcion({
  accion,
  pacientes,
  horasAviso,
  alCancelar,
  alGuardar,
}: {
  accion: AccionForm;
  pacientes: { id: string; nombre: string }[];
  horasAviso: number;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  async function enviarYCerrar(anterior: EstadoFormularioConfig, formulario: FormData) {
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    return resultado;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, { errores: {}, guardadoEn: null } as EstadoFormularioConfig);
  const e = estado.errores;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="excepcion-paciente">Paciente</Label>
        <Select id="excepcion-paciente" name="paciente_id" defaultValue={estado.enviado?.paciente_id ?? ""} aria-invalid={!!e.paciente_id}>
          <option value="">Elegí un paciente</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        {e.paciente_id && <p className="text-sm text-destructive">{e.paciente_id}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="excepcion-estado">Estado</Label>
        <Select id="excepcion-estado" name="estado" defaultValue={estado.enviado?.estado ?? ""} aria-invalid={!!e.estado}>
          <option value="">Elegí un estado</option>
          {ESTADOS_CON_REGLA.map((est) => {
            const ayuda = ayudaEstado(est, horasAviso);
            return (
              <option key={est} value={est}>
                {nombreEstado(est)}
                {ayuda && ` (${ayuda.toLowerCase()})`}
              </option>
            );
          })}
        </Select>
        {e.estado && <p className="text-sm text-destructive">{e.estado}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="excepcion-porcentaje">Porcentaje</Label>
        <div className="flex items-center gap-2">
          <Input
            id="excepcion-porcentaje"
            name="porcentaje"
            inputMode="numeric"
            className="w-24"
            defaultValue={estado.enviado?.porcentaje ?? ""}
            aria-invalid={!!e.porcentaje}
          />
          <span>%</span>
        </div>
        {e.porcentaje && <p className="text-sm text-destructive">{e.porcentaje}</p>}
      </div>
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Guardando…" : "Agregar excepción"}
      </Button>
      <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}
