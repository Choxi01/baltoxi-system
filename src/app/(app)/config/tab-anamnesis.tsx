"use client";

import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResultadoPlantilla } from "@/lib/anamnesis/acciones-plantillas";
import {
  aBorrador,
  agregarCampo,
  agregarSeccion,
  borradorVacio,
  cambiarCampo,
  cambiarNombre,
  cambiarTitulo,
  desdeBorrador,
  hayCambios,
  moverCampo,
  moverSeccion,
  quitarCampo,
  quitarSeccion,
  type Borrador,
  type NuevaClave,
} from "@/lib/anamnesis/borrador";
import type { PlantillaAnamnesis } from "@/lib/anamnesis/datos-plantillas";
import {
  LIMITES,
  NOMBRE_TIPO,
  TIPOS_CAMPO,
  resumenEstructura,
  validarPlantilla,
  type ErrorPlantilla,
  type TipoCampo,
} from "@/lib/anamnesis/estructura";
import { cn } from "@/lib/utils";

// Configuración > Anamnesis (tarea A6): plantillas con secciones y preguntas. Todo con botones
// (subir, bajar, quitar): nada que dependa del mouse.

type Guardar = (id: string | null, datos: unknown) => Promise<ResultadoPlantilla>;
type CambiarActiva = (id: string, activa: boolean) => Promise<{ error: string | null }>;

export function TabAnamnesis({
  plantillas,
  guardar,
  cambiarActiva,
}: {
  plantillas: PlantillaAnamnesis[];
  guardar: Guardar;
  cambiarActiva: CambiarActiva;
}) {
  // Qué se está editando: una plantilla (por id), "nueva" o nada.
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const editando = abierta === "nueva" ? null : plantillas.find((p) => p.id === abierta);
  if (abierta !== null && editando !== undefined) {
    return (
      <EditorPlantilla
        key={abierta}
        plantilla={editando}
        guardar={guardar}
        alCerrar={(texto) => {
          setAbierta(null);
          setAviso(texto);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Las preguntas de la anamnesis. Al crear la anamnesis de un paciente se copia la plantilla: si después la cambiás,
        las anamnesis ya creadas no cambian.
      </p>
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {plantillas.length === 0 && <p className="py-4 text-center text-muted-foreground">Todavía no hay plantillas.</p>}

      {plantillas.map((p) => (
        <FilaPlantilla
          key={p.id}
          plantilla={p}
          alEditar={() => {
            setAviso(null);
            setAbierta(p.id);
          }}
          cambiarActiva={cambiarActiva}
          alAvisar={setAviso}
        />
      ))}

      <Button
        size="touch"
        variant="outline"
        onClick={() => {
          setAviso(null);
          setAbierta("nueva");
        }}
      >
        <Plus /> Nueva plantilla
      </Button>
    </div>
  );
}

function FilaPlantilla({
  plantilla,
  alEditar,
  cambiarActiva,
  alAvisar,
}: {
  plantilla: PlantillaAnamnesis;
  alEditar: () => void;
  cambiarActiva: CambiarActiva;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  const { nombre, activa, estructura } = plantilla;

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", !activa && "bg-muted/50 text-muted-foreground")}>
      <div className="flex flex-col gap-1">
        <span className="font-medium break-words">
          {nombre}
          {!activa && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Desactivada</span>}
        </span>
        <span className="text-sm text-muted-foreground">
          {estructura ? resumenEstructura(estructura) : "Esta plantilla tiene un formato que no se puede editar."}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={alEditar} disabled={ocupado || !estructura}>
          <Pencil /> Editar
        </Button>
        <Button
          variant="ghost"
          disabled={ocupado}
          onClick={() => {
            if (activa && !window.confirm(`¿Desactivar ${nombre}?\nNo se va a poder elegir para anamnesis nuevas. Las que ya se crearon no cambian.`))
              return;
            iniciar(async () => {
              const r = await cambiarActiva(plantilla.id, !activa);
              alAvisar(r.error ?? (activa ? `${nombre} desactivada.` : `${nombre} activada ✓`));
            });
          }}
        >
          {activa ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}

const nuevaClave: NuevaClave = () => crypto.randomUUID();

/** Claves nuevas donde la primera es `primera` (para enfocar lo que se acaba de agregar). */
function clavesEmpezandoCon(primera: string): NuevaClave {
  let usada = false;
  return () => {
    if (usada) return nuevaClave();
    usada = true;
    return primera;
  };
}

/** Botones grandes de subir, bajar y quitar. */
function Botones({
  que,
  puedeSubir,
  puedeBajar,
  alSubir,
  alBajar,
  alQuitar,
}: {
  que: string;
  puedeSubir: boolean;
  puedeBajar: boolean;
  alSubir: () => void;
  alBajar: () => void;
  alQuitar: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="outline" size="icon" className="size-11" aria-label={`Subir ${que}`} disabled={!puedeSubir} onClick={alSubir}>
        <ChevronUp className="size-5" />
      </Button>
      <Button type="button" variant="outline" size="icon" className="size-11" aria-label={`Bajar ${que}`} disabled={!puedeBajar} onClick={alBajar}>
        <ChevronDown className="size-5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive" aria-label={`Quitar ${que}`} onClick={alQuitar}>
        <Trash2 className="size-5" />
      </Button>
    </div>
  );
}

function ErrorCampo({ id, error }: { id: string; error: ErrorPlantilla | undefined }) {
  if (!error) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {error.detalle}
    </p>
  );
}

function EditorPlantilla({
  plantilla,
  guardar,
  alCerrar,
}: {
  /** null: plantilla nueva. */
  plantilla: PlantillaAnamnesis | null;
  guardar: Guardar;
  alCerrar: (aviso: string | null) => void;
}) {
  const [original] = useState<Borrador>(() =>
    plantilla?.estructura ? aBorrador(plantilla.nombre, plantilla.estructura, nuevaClave) : borradorVacio(nuevaClave),
  );
  const [b, setB] = useState<Borrador>(original);
  // Después del primer intento de guardar, los problemas se muestran y se actualizan mientras se corrige.
  const [intentado, setIntentado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enfocar, setEnfocar] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const cambios = hayCambios(original, b);
  const validacion = validarPlantilla(desdeBorrador(b));
  const errores = intentado && !validacion.ok ? validacion.errores : [];
  const error = (ruta: string) => errores.find((e) => e.ruta === ruta);

  // Avisar si se cierra o recarga la página con cambios sin guardar.
  useEffect(() => {
    if (!cambios) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cambios]);

  function cambiar(nuevo: Borrador) {
    setErrorGeneral(null);
    setB(nuevo);
  }

  function enviar() {
    setIntentado(true);
    setErrorGeneral(null);
    if (!validacion.ok) return;
    iniciar(async () => {
      const r = await guardar(plantilla?.id ?? null, validacion.datos);
      if (r.ok) alCerrar(plantilla ? "Plantilla guardada ✓" : "Plantilla creada ✓");
      else setErrorGeneral(r.errores.map((e) => e.mensaje).join(" "));
    });
  }

  function cancelar() {
    if (cambios && !window.confirm("¿Salir sin guardar? Se pierden los cambios.")) return;
    alCerrar(null);
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h2 className="text-lg font-semibold">{plantilla ? "Editar plantilla" : "Nueva plantilla"}</h2>
      {plantilla && (
        <p className="text-sm text-muted-foreground">Los cambios no modifican las anamnesis ya creadas con esta plantilla.</p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="plantilla-nombre">Nombre de la plantilla</Label>
        <Input
          id="plantilla-nombre"
          value={b.nombre}
          maxLength={LIMITES.nombre}
          placeholder="Ej. Anamnesis infantil"
          autoComplete="off"
          onChange={(e) => cambiar(cambiarNombre(b, e.target.value))}
          aria-invalid={!!error("nombre")}
          aria-describedby={error("nombre") ? "plantilla-nombre-error" : undefined}
        />
        <ErrorCampo id="plantilla-nombre-error" error={error("nombre")} />
      </div>

      {b.secciones.map((s, i) => {
        const rutaS = `estructura.secciones.${i}`;
        const queS = `sección ${i + 1}`;
        return (
          <section key={s.clave} aria-label={`Sección ${i + 1}`} className="flex flex-col gap-3 rounded-xl border-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Sección {i + 1}</h3>
              <Botones
                que={queS}
                puedeSubir={i > 0}
                puedeBajar={i < b.secciones.length - 1}
                alSubir={() => cambiar(moverSeccion(b, i, -1))}
                alBajar={() => cambiar(moverSeccion(b, i, 1))}
                alQuitar={() => {
                  const n = s.campos.length;
                  const nombre = s.titulo.trim() ? `"${s.titulo.trim()}"` : `la sección ${i + 1}`;
                  if (n > 0 && !window.confirm(`¿Quitar ${nombre} con sus ${n === 1 ? "1 pregunta" : `${n} preguntas`}?`)) return;
                  cambiar(quitarSeccion(b, i));
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${s.clave}-titulo`}>Título de la sección</Label>
              <Input
                id={`${s.clave}-titulo`}
                value={s.titulo}
                maxLength={LIMITES.titulo}
                placeholder="Ej. Embarazo y parto"
                autoComplete="off"
                autoFocus={enfocar === s.clave}
                onChange={(e) => cambiar(cambiarTitulo(b, i, e.target.value))}
                aria-invalid={!!error(`${rutaS}.titulo`)}
              />
              <ErrorCampo id={`${s.clave}-titulo-error`} error={error(`${rutaS}.titulo`)} />
            </div>

            {s.campos.map((c, j) => {
              const rutaC = `${rutaS}.campos.${j}`;
              return (
                <div key={c.clave} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Pregunta {j + 1}</span>
                    <Botones
                      que={`pregunta ${j + 1} de la ${queS}`}
                      puedeSubir={j > 0}
                      puedeBajar={j < s.campos.length - 1}
                      alSubir={() => cambiar(moverCampo(b, i, j, -1))}
                      alBajar={() => cambiar(moverCampo(b, i, j, 1))}
                      alQuitar={() => {
                        if (c.etiqueta.trim() && !window.confirm(`¿Quitar la pregunta "${c.etiqueta.trim()}"?`)) return;
                        cambiar(quitarCampo(b, i, j));
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${c.clave}-etiqueta`}>Pregunta</Label>
                    <Input
                      id={`${c.clave}-etiqueta`}
                      value={c.etiqueta}
                      maxLength={LIMITES.etiqueta}
                      placeholder="Ej. ¿Cómo fue el embarazo?"
                      autoComplete="off"
                      autoFocus={enfocar === c.clave}
                      onChange={(e) => cambiar(cambiarCampo(b, i, j, { etiqueta: e.target.value }))}
                      aria-invalid={!!error(`${rutaC}.etiqueta`)}
                    />
                    <ErrorCampo id={`${c.clave}-etiqueta-error`} error={error(`${rutaC}.etiqueta`) ?? error(`${rutaC}.id`)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${c.clave}-tipo`}>Tipo de respuesta</Label>
                    <Select
                      id={`${c.clave}-tipo`}
                      value={c.tipo}
                      onChange={(e) => cambiar(cambiarCampo(b, i, j, { tipo: e.target.value as TipoCampo }))}
                    >
                      {TIPOS_CAMPO.map((t) => (
                        <option key={t} value={t}>
                          {NOMBRE_TIPO[t]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {c.tipo === "opciones" && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${c.clave}-opciones`}>Opciones (una por renglón)</Label>
                      <Textarea
                        id={`${c.clave}-opciones`}
                        value={c.opcionesTexto}
                        rows={4}
                        placeholder={"Ej.\nNatural\nCesárea"}
                        onChange={(e) => cambiar(cambiarCampo(b, i, j, { opcionesTexto: e.target.value }))}
                        aria-invalid={!!error(`${rutaC}.opciones`)}
                      />
                      <ErrorCampo id={`${c.clave}-opciones-error`} error={error(`${rutaC}.opciones`)} />
                    </div>
                  )}
                </div>
              );
            })}
            <ErrorCampo id={`${s.clave}-campos-error`} error={error(`${rutaS}.campos`)} />

            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => {
                const clave = nuevaClave();
                setEnfocar(clave);
                cambiar(agregarCampo(b, i, clavesEmpezandoCon(clave)));
              }}
            >
              <Plus /> Agregar pregunta
            </Button>
          </section>
        );
      })}

      <ErrorCampo id="secciones-error" error={error("estructura.secciones")} />
      <Button
        type="button"
        variant="outline"
        size="touch"
        onClick={() => {
          const clave = nuevaClave();
          setEnfocar(clave);
          cambiar(agregarSeccion(b, clavesEmpezandoCon(clave)));
        }}
      >
        <Plus /> Agregar sección
      </Button>

      {errores.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
          <span className="font-medium">Revisá antes de guardar:</span>
          <ul className="list-disc pl-5">
            {errores.slice(0, 8).map((e) => (
              <li key={e.ruta}>{e.mensaje}</li>
            ))}
            {errores.length > 8 && <li>Y {errores.length - 8} más.</li>}
          </ul>
        </div>
      )}
      {errorGeneral && (
        <p role="alert" className="text-sm text-destructive">
          {errorGeneral}
        </p>
      )}

      <Button type="button" size="touch" onClick={enviar} disabled={guardando}>
        {guardando ? "Guardando…" : plantilla ? "Guardar plantilla" : "Crear plantilla"}
      </Button>
      <Button type="button" variant="ghost" onClick={cancelar} disabled={guardando}>
        Cancelar
      </Button>
    </div>
  );
}
