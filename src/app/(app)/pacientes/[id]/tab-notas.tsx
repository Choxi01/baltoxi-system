"use client";

import { Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormularioPaciente } from "@/lib/pacientes/acciones";
import { textoFecha } from "@/lib/pacientes/fecha";
import { MAXIMO_NOTA, fueEditada, type Nota } from "@/lib/pacientes/notas";
import { cn } from "@/lib/utils";

// Pestaña Notas del expediente (tarea A5). DATOS CLÍNICOS: el texto solo se muestra acá
// y en la nota fijada arriba de la ficha.

type AccionForm = (anterior: EstadoFormularioPaciente, formulario: FormData) => Promise<EstadoFormularioPaciente>;

export function TabNotas({
  fijada,
  resto,
  hoy,
  sesion,
  crear,
  crearDeSesion,
  actualizar,
  fijar,
  borrar,
}: {
  fijada: Nota | null;
  resto: Nota[];
  hoy: string;
  /** Vino de "Agregar nota de esta sesión" en la agenda: el formulario se abre con esa fecha. */
  sesion: { id: string; fecha: string } | null;
  crear: AccionForm;
  crearDeSesion: AccionForm | null;
  actualizar: (notaId: string, anterior: EstadoFormularioPaciente, formulario: FormData) => Promise<EstadoFormularioPaciente>;
  fijar: (notaId: string, fijar: boolean) => Promise<{ error: string | null }>;
  borrar: (notaId: string) => Promise<{ error: string | null }>;
}) {
  // Qué se está escribiendo: una nota (por id), "nueva", "sesion" o nada.
  const [abierto, setAbierto] = useState<string | null>(sesion && crearDeSesion ? "sesion" : null);
  const [aviso, setAviso] = useState<string | null>(null);
  const notas = fijada ? [fijada, ...resto] : resto;

  // Que recargar la página no vuelva a abrir el formulario de la sesión.
  function olvidarSesion() {
    const parametros = new URLSearchParams(window.location.search);
    if (!parametros.has("turno")) return;
    parametros.delete("turno");
    window.history.replaceState(null, "", `?${parametros}`);
  }

  function abrir(id: string | null) {
    setAviso(null);
    if (abierto === "sesion") olvidarSesion();
    setAbierto(id);
  }

  const formularioNuevo = (deSesion: boolean) => (
    <FormularioNota
      accion={deSesion && crearDeSesion ? crearDeSesion : crear}
      hoy={hoy}
      fechaInicial={deSesion && sesion ? sesion.fecha : hoy}
      titulo={deSesion && sesion ? `Nota de la sesión del ${textoFecha(sesion.fecha)}` : "Nueva nota"}
      textoBoton="Guardar nota"
      alCancelar={() => abrir(null)}
      alGuardar={() => {
        abrir(null);
        setAviso("Nota guardada ✓");
      }}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {abierto === "sesion" || abierto === "nueva" ? (
        formularioNuevo(abierto === "sesion")
      ) : (
        <Button size="touch" variant="outline" onClick={() => abrir("nueva")}>
          <Plus /> Nueva nota
        </Button>
      )}

      {notas.length === 0 && abierto === null && <p className="text-muted-foreground">Todavía no hay notas de este paciente.</p>}

      <ol className="flex flex-col gap-3">
        {notas.map((n) =>
          abierto === n.id ? (
            <li key={n.id}>
              <FormularioNota
                accion={actualizar.bind(null, n.id)}
                hoy={hoy}
                valores={n}
                fechaInicial={n.fecha}
                titulo="Editar nota"
                textoBoton="Guardar cambios"
                alCancelar={() => abrir(null)}
                alGuardar={() => {
                  abrir(null);
                  setAviso("Guardado ✓");
                }}
              />
            </li>
          ) : (
            <li key={n.id}>
              <TarjetaNota nota={n} alEditar={() => abrir(n.id)} fijar={fijar} borrar={borrar} alAvisar={setAviso} />
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

/** Encabezado de una nota: "3 de noviembre de 2026 · Sesión · Editada". */
export function DatosNota({ nota }: { nota: Nota }) {
  return (
    <span className="text-sm text-muted-foreground">
      {[textoFecha(nota.fecha), nota.turno_id ? "Sesión" : null, fueEditada(nota) ? "Editada" : null].filter(Boolean).join(" · ")}
    </span>
  );
}

function TarjetaNota({
  nota,
  alEditar,
  fijar,
  borrar,
  alAvisar,
}: {
  nota: Nota;
  alEditar: () => void;
  fijar: (notaId: string, fijar: boolean) => Promise<{ error: string | null }>;
  borrar: (notaId: string) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  return (
    <article className={cn("flex flex-col gap-3 rounded-lg border p-4", nota.fijada && "border-primary/50 bg-primary/5")}>
      <div className="flex items-center justify-between gap-2">
        <DatosNota nota={nota} />
        {nota.fijada && (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pin className="size-3.5" /> Fijada
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words">{nota.texto}</p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-11" onClick={alEditar} disabled={ocupado}>
          <Pencil /> Editar
        </Button>
        <Button
          variant="ghost"
          className="h-11"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await fijar(nota.id, !nota.fijada);
              alAvisar(r.error ?? (nota.fijada ? "Nota desfijada." : "Nota fijada arriba de la ficha ✓"));
            })
          }
        >
          {nota.fijada ? (
            <>
              <PinOff /> Desfijar
            </>
          ) : (
            <>
              <Pin /> Fijar
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="h-11 text-destructive"
          disabled={ocupado}
          onClick={() => {
            if (!window.confirm(`¿Borrar la nota del ${textoFecha(nota.fecha)}?\nNo se puede deshacer.`)) return;
            iniciar(async () => {
              const r = await borrar(nota.id);
              alAvisar(r.error ?? "Nota borrada.");
            });
          }}
        >
          <Trash2 /> Borrar
        </Button>
      </div>
    </article>
  );
}

function FormularioNota({
  accion,
  hoy,
  valores,
  fechaInicial,
  titulo,
  textoBoton,
  alCancelar,
  alGuardar,
}: {
  accion: AccionForm;
  hoy: string;
  valores?: Nota;
  fechaInicial: string;
  titulo: string;
  textoBoton: string;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  // Se cierra cuando el servidor confirma que guardó.
  async function enviarYCerrar(anterior: EstadoFormularioPaciente, formulario: FormData) {
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    return resultado;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, { errores: {}, guardadoEn: null } as EstadoFormularioPaciente);
  const e = estado.errores;
  const enviado = estado.enviado;
  const prefijo = valores?.id ?? "nueva";

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <h3 className="font-medium">{titulo}</h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-fecha`}>Fecha</Label>
        <Input
          id={`${prefijo}-fecha`}
          name="fecha"
          type="date"
          max={hoy}
          defaultValue={enviado?.fecha ?? fechaInicial}
          aria-invalid={!!e.fecha}
          className="h-12"
        />
        {e.fecha && <p className="text-sm text-destructive">{e.fecha}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-texto`}>Nota</Label>
        <Textarea
          id={`${prefijo}-texto`}
          name="texto"
          rows={6}
          maxLength={MAXIMO_NOTA}
          defaultValue={enviado?.texto ?? valores?.texto ?? ""}
          aria-invalid={!!e.texto}
          // Una nota nueva se empieza a escribir enseguida.
          autoFocus={!valores}
        />
        {e.texto && <p className="text-sm text-destructive">{e.texto}</p>}
      </div>
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Guardando…" : textoBoton}
      </Button>
      <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}
