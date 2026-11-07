"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { startTransition, useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EstadoPlantilla } from "@/lib/anamnesis/acciones-plantillas";
import type { PlantillaAnamnesis } from "@/lib/anamnesis/datos";
import {
  aEditor,
  aEstructura,
  agregarCampo,
  cambiarCampo,
  cambiarSeccion,
  contarCampos,
  moverCampo,
  moverSeccion,
  quitarCampo,
  quitarSeccion,
  seccionNueva,
  type CampoEditor,
  type SeccionEditor,
} from "@/lib/anamnesis/editor";
import { LIMITES, NOMBRE_TIPO, TIPOS_CAMPO, type TipoCampo } from "@/lib/anamnesis/plantilla";
import type { ErroresFormulario } from "@/lib/config/validacion";
import { cn } from "@/lib/utils";

// Configuración > Anamnesis (tarea A6): plantillas con secciones y campos.
// Cambiar una plantilla no modifica las anamnesis ya hechas (cada una guarda su copia).

/** Clave solo para la pantalla (React), nunca se guarda. */
const clave = () => crypto.randomUUID();

type AccionForm = (anterior: EstadoPlantilla, formulario: FormData) => Promise<EstadoPlantilla>;

export function TabAnamnesis({
  plantillas,
  crear,
  actualizar,
  cambiarActiva,
}: {
  plantillas: PlantillaAnamnesis[];
  crear: AccionForm;
  actualizar: (id: string, anterior: EstadoPlantilla, formulario: FormData) => Promise<EstadoPlantilla>;
  cambiarActiva: (id: string, activa: boolean) => Promise<{ error: string | null }>;
}) {
  // Qué se está editando: una plantilla (por id), "nueva" o nada.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function abrir(id: string | null) {
    setAviso(null);
    setAbierto(id);
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Las preguntas de la anamnesis. Al empezar la anamnesis de un paciente se copia la plantilla: si después la cambiás, las
        anamnesis ya hechas no cambian.
      </p>
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {plantillas.map((p) =>
        abierto === p.id ? (
          <EditorPlantilla
            key={p.id}
            plantilla={p}
            accion={actualizar.bind(null, p.id)}
            textoBoton="Guardar plantilla"
            alCancelar={() => abrir(null)}
            alGuardar={() => {
              abrir(null);
              setAviso("Guardado ✓");
            }}
          />
        ) : (
          <FilaPlantilla
            key={p.id}
            plantilla={p}
            deshabilitada={abierto !== null}
            alEditar={() => abrir(p.id)}
            cambiarActiva={cambiarActiva}
            alAvisar={setAviso}
          />
        ),
      )}

      {plantillas.length === 0 && abierto === null && <p className="text-muted-foreground">Todavía no hay plantillas.</p>}

      {abierto === "nueva" ? (
        <EditorPlantilla
          accion={crear}
          textoBoton="Agregar plantilla"
          alCancelar={() => abrir(null)}
          alGuardar={() => {
            abrir(null);
            setAviso("Plantilla agregada ✓");
          }}
        />
      ) : (
        abierto === null && (
          <Button size="touch" variant="outline" onClick={() => abrir("nueva")}>
            <Plus /> Nueva plantilla
          </Button>
        )
      )}
    </div>
  );
}

function FilaPlantilla({
  plantilla,
  deshabilitada,
  alEditar,
  cambiarActiva,
  alAvisar,
}: {
  plantilla: PlantillaAnamnesis;
  deshabilitada: boolean;
  alEditar: () => void;
  cambiarActiva: (id: string, activa: boolean) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  const e = plantilla.estructura;
  const resumen = e
    ? `${e.secciones.length} ${e.secciones.length === 1 ? "sección" : "secciones"} · ${contarCampos(e)} ${contarCampos(e) === 1 ? "campo" : "campos"}`
    : "No se pudo leer esta plantilla.";

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", !plantilla.activa && "bg-muted/50 text-muted-foreground")}>
      <div className="flex flex-col gap-1">
        <span className="font-medium">{plantilla.nombre}</span>
        <span className={cn("text-sm text-muted-foreground", !e && "text-destructive")}>{resumen}</span>
        {!plantilla.activa && (
          <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs">Desactivada</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={alEditar} disabled={ocupado || deshabilitada}>
          <Pencil /> Editar
        </Button>
        <Button
          variant="ghost"
          disabled={ocupado || deshabilitada}
          onClick={() => {
            if (
              plantilla.activa &&
              !window.confirm(`¿Desactivar ${plantilla.nombre}?\nNo se va a poder usar para anamnesis nuevas. Las ya hechas no cambian.`)
            )
              return;
            iniciar(async () => {
              const r = await cambiarActiva(plantilla.id, !plantilla.activa);
              alAvisar(r.error ?? (plantilla.activa ? `${plantilla.nombre} desactivada.` : `${plantilla.nombre} activada ✓`));
            });
          }}
        >
          {plantilla.activa ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}

function MensajeError({ texto }: { texto?: string }) {
  return texto ? <p className="text-sm text-destructive">{texto}</p> : null;
}

/** Botones ↑ ↓ grandes (sin arrastrar: tiene que andar con el dedo en el iPhone). */
function Flechas({
  que,
  primero,
  ultimo,
  alMover,
}: {
  que: string;
  primero: boolean;
  ultimo: boolean;
  alMover: (direccion: -1 | 1) => void;
}) {
  return (
    <>
      <Button type="button" variant="outline" className="size-11" disabled={primero} onClick={() => alMover(-1)} aria-label={`Subir ${que}`}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="outline" className="size-11" disabled={ultimo} onClick={() => alMover(1)} aria-label={`Bajar ${que}`}>
        <ArrowDown />
      </Button>
    </>
  );
}

function EditorPlantilla({
  plantilla,
  accion,
  textoBoton,
  alCancelar,
  alGuardar,
}: {
  plantilla?: PlantillaAnamnesis;
  accion: AccionForm;
  textoBoton: string;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [secciones, setSeccionesBase] = useState<SeccionEditor[]>(() => aEditor(plantilla?.estructura ?? null, clave));
  // Los errores se refieren a posiciones ("secciones.0.campos.1"): si se cambia algo, se ocultan
  // hasta el próximo guardado para no mostrarlos en el lugar equivocado.
  const [cambiosDesdeEnvio, setCambiosDesdeEnvio] = useState(0);

  function setSecciones(cambio: (s: SeccionEditor[]) => SeccionEditor[]) {
    setSeccionesBase(cambio);
    setCambiosDesdeEnvio((n) => n + 1);
  }

  async function enviarYCerrar(anterior: EstadoPlantilla, formulario: FormData) {
    setCambiosDesdeEnvio(0);
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    return resultado;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, { errores: {}, guardadoEn: null } as EstadoPlantilla);
  const errores: ErroresFormulario = cambiosDesdeEnvio === 0 ? estado.errores : {};
  const hayErrores = Object.keys(errores).length > 0;
  const prefijo = plantilla?.id ?? "nueva";

  return (
    <form
      // Se envía a mano y no con `action`: React vacía el formulario después de una acción y los
      // selectores de tipo quedaban mostrando "Texto corto" aunque el dato estaba bien.
      onSubmit={(e) => {
        e.preventDefault();
        const formulario = new FormData(e.currentTarget);
        startTransition(() => enviar(formulario));
      }}
      className="flex flex-col gap-4 rounded-lg border p-4"
      noValidate
    >
      <input type="hidden" name="estructura" value={JSON.stringify(aEstructura(secciones))} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-nombre`}>Nombre de la plantilla</Label>
        <Input
          id={`${prefijo}-nombre`}
          name="nombre"
          value={nombre}
          maxLength={LIMITES.nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="off"
          aria-invalid={!!errores.nombre}
          placeholder="Ej.: Anamnesis infantil"
        />
        <MensajeError texto={errores.nombre} />
      </div>

      {plantilla && !plantilla.estructura && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
          No se pudo leer esta plantilla: empezá de nuevo con las secciones y campos.
        </p>
      )}

      <ol className="flex flex-col gap-4">
        {secciones.map((s, i) => (
          <li key={s.clave}>
            <EditorSeccion
              seccion={s}
              indice={i}
              total={secciones.length}
              prefijo={`${prefijo}-${s.clave}`}
              errores={errores}
              alCambiar={setSecciones}
              nuevaClave={clave}
            />
          </li>
        ))}
      </ol>
      <MensajeError texto={errores.secciones} />

      <Button type="button" variant="outline" size="touch" onClick={() => setSecciones((ss) => [...ss, seccionNueva(clave)])}>
        <Plus /> Agregar sección
      </Button>

      {errores.general && (
        <p role="alert" className="text-sm text-destructive">
          {errores.general}
        </p>
      )}
      {hayErrores && !errores.general && (
        <p role="alert" className="text-sm text-destructive">
          Revisá lo marcado en rojo.
        </p>
      )}
      <p className="text-sm text-muted-foreground">Nada se guarda hasta que toques «{textoBoton}».</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="touch" variant="ghost" onClick={alCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" size="touch" disabled={enviando}>
          {enviando ? "Guardando…" : textoBoton}
        </Button>
      </div>
    </form>
  );
}

function EditorSeccion({
  seccion,
  indice: i,
  total,
  prefijo,
  errores,
  alCambiar,
  nuevaClave,
}: {
  seccion: SeccionEditor;
  indice: number;
  total: number;
  prefijo: string;
  errores: ErroresFormulario;
  alCambiar: (cambio: (s: SeccionEditor[]) => SeccionEditor[]) => void;
  nuevaClave: () => string;
}) {
  const ruta = `secciones.${i}`;
  const nombre = seccion.titulo.trim() || `Sección ${i + 1}`;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border-2 border-dashed p-3">
      <legend className="px-1 text-sm font-semibold">Sección {i + 1}</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-titulo`}>Título de la sección</Label>
        <Input
          id={`${prefijo}-titulo`}
          value={seccion.titulo}
          maxLength={LIMITES.titulo}
          onChange={(e) => alCambiar((ss) => cambiarSeccion(ss, i, { titulo: e.target.value }))}
          autoComplete="off"
          aria-invalid={!!errores[`${ruta}.titulo`]}
          placeholder="Ej.: Embarazo y parto"
        />
        <MensajeError texto={errores[`${ruta}.titulo`]} />
      </div>
      <div className="flex gap-2">
        <Flechas que={`la sección ${nombre}`} primero={i === 0} ultimo={i === total - 1} alMover={(d) => alCambiar((ss) => moverSeccion(ss, i, d))} />
        <Button
          type="button"
          variant="ghost"
          className="h-11 flex-1"
          onClick={() => {
            if (seccion.campos.length > 0 && !window.confirm(`¿Quitar la sección ${nombre} con sus ${seccion.campos.length} campos?`)) return;
            alCambiar((ss) => quitarSeccion(ss, i));
          }}
        >
          <Trash2 /> Quitar sección
        </Button>
      </div>

      <ol className="flex flex-col gap-3">
        {seccion.campos.map((c, j) => (
          <li key={c.clave}>
            <EditorCampo
              campo={c}
              indiceSeccion={i}
              indice={j}
              total={seccion.campos.length}
              prefijo={`${prefijo}-${c.clave}`}
              errores={errores}
              alCambiar={alCambiar}
            />
          </li>
        ))}
      </ol>
      <MensajeError texto={errores[`${ruta}.campos`]} />
      <Button type="button" variant="outline" className="h-11" onClick={() => alCambiar((ss) => agregarCampo(ss, i, nuevaClave))}>
        <Plus /> Agregar campo
      </Button>
    </fieldset>
  );
}

function EditorCampo({
  campo,
  indiceSeccion: i,
  indice: j,
  total,
  prefijo,
  errores,
  alCambiar,
}: {
  campo: CampoEditor;
  indiceSeccion: number;
  indice: number;
  total: number;
  prefijo: string;
  errores: ErroresFormulario;
  alCambiar: (cambio: (s: SeccionEditor[]) => SeccionEditor[]) => void;
}) {
  const ruta = `secciones.${i}.campos.${j}`;
  const cambiar = (cambio: Parameters<typeof cambiarCampo>[3]) => alCambiar((ss) => cambiarCampo(ss, i, j, cambio));
  const nombre = campo.etiqueta.trim() || `Campo ${j + 1}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-etiqueta`}>Pregunta</Label>
        <Input
          id={`${prefijo}-etiqueta`}
          value={campo.etiqueta}
          maxLength={LIMITES.etiqueta}
          onChange={(e) => cambiar({ etiqueta: e.target.value })}
          autoComplete="off"
          aria-invalid={!!errores[`${ruta}.etiqueta`]}
          placeholder="Ej.: ¿Cómo fue el embarazo?"
        />
        <MensajeError texto={errores[`${ruta}.etiqueta`] ?? errores[`${ruta}.id`]} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-tipo`}>Tipo de respuesta</Label>
        <Select
          id={`${prefijo}-tipo`}
          value={campo.tipo}
          onChange={(e) => cambiar({ tipo: e.target.value as TipoCampo })}
          aria-invalid={!!errores[`${ruta}.tipo`]}
        >
          {TIPOS_CAMPO.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TIPO[t]}
            </option>
          ))}
        </Select>
        <MensajeError texto={errores[`${ruta}.tipo`]} />
      </div>

      {campo.tipo === "opciones" && (
        <EditorOpciones
          opciones={campo.opciones}
          prefijo={prefijo}
          ruta={`${ruta}.opciones`}
          errores={errores}
          alCambiar={(opciones) => cambiar({ opciones })}
        />
      )}

      <div className="flex gap-2">
        <Flechas que={`el campo ${nombre}`} primero={j === 0} ultimo={j === total - 1} alMover={(d) => alCambiar((ss) => moverCampo(ss, i, j, d))} />
        <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => alCambiar((ss) => quitarCampo(ss, i, j))}>
          <Trash2 /> Quitar campo
        </Button>
      </div>
    </div>
  );
}

function EditorOpciones({
  opciones,
  prefijo,
  ruta,
  errores,
  alCambiar,
}: {
  opciones: string[];
  prefijo: string;
  ruta: string;
  errores: ErroresFormulario;
  alCambiar: (opciones: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Opciones</legend>
      {opciones.map((o, k) => (
        <div key={k} className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Input
              value={o}
              maxLength={LIMITES.opcion}
              onChange={(e) => alCambiar(opciones.map((x, n) => (n === k ? e.target.value : x)))}
              autoComplete="off"
              aria-label={`Opción ${k + 1}`}
              aria-invalid={!!errores[`${ruta}.${k}`]}
              placeholder={`Opción ${k + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              className="size-12 shrink-0"
              onClick={() => alCambiar(opciones.filter((_, n) => n !== k))}
              aria-label={`Quitar la opción ${k + 1}`}
            >
              <Trash2 />
            </Button>
          </div>
          <MensajeError texto={errores[`${ruta}.${k}`]} />
        </div>
      ))}
      <MensajeError texto={errores[ruta]} />
      {opciones.length < LIMITES.opciones && (
        <Button type="button" variant="outline" className="h-11" id={`${prefijo}-agregar-opcion`} onClick={() => alCambiar([...opciones, ""])}>
          <Plus /> Agregar opción
        </Button>
      )}
    </fieldset>
  );
}
