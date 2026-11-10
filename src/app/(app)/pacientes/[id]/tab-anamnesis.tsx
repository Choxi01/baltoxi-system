"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Anamnesis } from "@/lib/anamnesis/datos-anamnesis";
import type { Campo, Estructura } from "@/lib/anamnesis/estructura";
import { MAXIMO_RESPUESTA, progresoRespuestas, type Respuesta, type Respuestas } from "@/lib/anamnesis/respuestas";
import { textoFecha } from "@/lib/pacientes/fecha";
import { cn } from "@/lib/utils";

// Pestaña Anamnesis del expediente (tarea A6b). DATOS CLÍNICOS: lo respondido solo se ve acá y en la
// vista para imprimir. Se guarda solo, 2 segundos después de dejar de escribir o al salir del campo.

const ESPERA_GUARDADO = 2000;
const ESPERA_REINTENTO = 5000;

type Guardar = (anamnesisId: string, respuestas: Respuestas) => Promise<{ error: string | null }>;

export function TabAnamnesis({
  pacienteId,
  anamnesis,
  plantillas,
  crear,
  guardar,
}: {
  pacienteId: string;
  anamnesis: Anamnesis[];
  plantillas: { id: string; nombre: string }[];
  crear: (plantillaId: string) => Promise<{ error: string | null }>;
  guardar: Guardar;
}) {
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const elegida = anamnesis.find((a) => a.id === elegidaId) ?? anamnesis[0];

  if (!elegida || nueva) {
    return (
      <NuevaAnamnesis
        plantillas={plantillas}
        hayOtras={anamnesis.length > 0}
        crear={async (plantillaId) => {
          const r = await crear(plantillaId);
          if (!r.error) {
            setNueva(false);
            setElegidaId(null); // la recién creada es la más nueva: queda primera
          }
          return r;
        }}
        cancelar={() => setNueva(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {anamnesis.length > 1 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="anamnesis-elegida">Anamnesis</Label>
          <Select id="anamnesis-elegida" value={elegida.id} onChange={(e) => setElegidaId(e.target.value)}>
            {anamnesis.map((a) => (
              <option key={a.id} value={a.id}>
                {textoFecha(a.fecha)} · {a.plantilla}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11">
          <Link href={`/pacientes/${pacienteId}/anamnesis/${elegida.id}`}>
            <Printer className="size-4" /> Leer e imprimir
          </Link>
        </Button>
        {plantillas.length > 0 && (
          <Button type="button" variant="ghost" className="h-11" onClick={() => setNueva(true)}>
            Nueva anamnesis
          </Button>
        )}
      </div>

      {elegida.estructura ? (
        // key: al cambiar de anamnesis se arma un formulario nuevo con sus respuestas.
        <FormularioAnamnesis
          key={elegida.id}
          anamnesisId={elegida.id}
          titulo={`${elegida.plantilla} · ${textoFecha(elegida.fecha)}`}
          estructura={elegida.estructura}
          iniciales={elegida.respuestas}
          guardar={guardar}
        />
      ) : (
        <p className="rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
          Esta anamnesis tiene un formato que no se puede leer.
        </p>
      )}
    </div>
  );
}

function NuevaAnamnesis({
  plantillas,
  hayOtras,
  crear,
  cancelar,
}: {
  plantillas: { id: string; nombre: string }[];
  hayOtras: boolean;
  crear: (plantillaId: string) => Promise<{ error: string | null }>;
  cancelar: () => void;
}) {
  const [plantillaId, setPlantillaId] = useState(plantillas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (plantillas.length === 0) {
    return (
      <p className="text-muted-foreground">
        No hay plantillas de anamnesis activas.{" "}
        <Link href="/config?pestana=anamnesis" className="text-primary underline">
          Creá una en Configuración
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!hayOtras && <p className="text-muted-foreground">Todavía no tiene anamnesis.</p>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="plantilla-anamnesis">Plantilla</Label>
        <Select id="plantilla-anamnesis" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
          {plantillas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="h-12"
          disabled={pendiente || !plantillaId}
          onClick={() =>
            iniciar(async () => {
              const r = await crear(plantillaId);
              setError(r.error);
            })
          }
        >
          {pendiente ? "Creando…" : "Crear anamnesis"}
        </Button>
        {hayOtras && (
          <Button type="button" variant="outline" className="h-12" onClick={cancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

type Estado = "guardado" | "pendiente" | "guardando" | "error";

const TEXTO_ESTADO: Record<Estado, string> = {
  guardado: "Guardado",
  pendiente: "Cambios sin guardar…",
  guardando: "Guardando…",
  error: "No se pudo guardar. Reintentando…",
};

function FormularioAnamnesis({
  anamnesisId,
  titulo,
  estructura,
  iniciales,
  guardar,
}: {
  anamnesisId: string;
  titulo: string;
  estructura: Estructura;
  iniciales: Respuestas;
  guardar: Guardar;
}) {
  const [respuestas, setRespuestas] = useState<Respuestas>(iniciales);
  const [estado, setEstado] = useState<Estado>("guardado");
  const [error, setError] = useState<string | null>(null);

  // Lo último escrito, si falta guardarlo, y si hay un guardado en curso (para no pisarse).
  const ultimas = useRef(iniciales);
  const sucio = useRef(false);
  const enCurso = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Para los temporizadores y al salir: siempre la última versión de guardarAhora.
  const guardarRef = useRef<() => Promise<void>>(async () => {});
  const programar = (ms: number) => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void guardarRef.current(), ms);
  };

  async function guardarAhora(): Promise<void> {
    clearTimeout(temporizador.current);
    if (!sucio.current || enCurso.current) return;
    sucio.current = false;
    enCurso.current = true;
    setEstado("guardando");
    let r: { error: string | null };
    try {
      r = await guardar(anamnesisId, ultimas.current);
    } catch {
      r = { error: "No se pudo guardar. Revisá la conexión." };
    }
    enCurso.current = false;
    if (r.error) {
      sucio.current = true;
      setError(r.error);
      setEstado("error");
      programar(ESPERA_REINTENTO);
      return;
    }
    setError(null);
    // Si se escribió mientras guardaba, se guarda otra vez.
    if (sucio.current) void guardarRef.current();
    else setEstado("guardado");
  }
  useEffect(() => {
    guardarRef.current = guardarAhora;
  });

  function cambiar(id: string, valor: Respuesta | undefined) {
    const nuevas = { ...ultimas.current };
    if (valor === undefined || valor === "") delete nuevas[id];
    else nuevas[id] = valor;
    ultimas.current = nuevas;
    setRespuestas(nuevas);
    sucio.current = true;
    if (!enCurso.current) setEstado("pendiente");
    programar(ESPERA_GUARDADO);
  }

  // Avisa si se cierra la pantalla con algo sin guardar; al salir del expediente, guarda lo que falte.
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (sucio.current || enCurso.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      void guardarRef.current();
    };
  }, []);

  return (
    // Salir de un campo guarda enseguida.
    <div className="flex flex-col gap-6" onBlur={() => void guardarAhora()}>
      <div className="sticky top-0 z-[1] -mx-4 flex flex-col gap-0.5 border-b bg-background/95 px-4 py-2 md:-mx-8 md:px-8">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {progresoRespuestas(estructura, respuestas)} ·{" "}
          <span className={cn(estado === "error" && "text-destructive")}>{TEXTO_ESTADO[estado]}</span>
        </p>
        {error && estado === "error" && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {estructura.secciones.map((seccion, i) => (
        <section key={i} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{seccion.titulo}</h2>
          {seccion.campos.map((campo) => (
            <CampoAnamnesis key={campo.id} campo={campo} valor={respuestas[campo.id]} cambiar={(v) => cambiar(campo.id, v)} />
          ))}
        </section>
      ))}
    </div>
  );
}

function CampoAnamnesis({
  campo,
  valor,
  cambiar,
}: {
  campo: Campo;
  valor: Respuesta | undefined;
  cambiar: (valor: Respuesta | undefined) => void;
}) {
  const id = `anamnesis-${campo.id}`;
  const texto = typeof valor === "string" ? valor : "";

  if (campo.tipo === "si_no") {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{campo.etiqueta}</legend>
        <div className="flex gap-2">
          {([true, false] as const).map((opcion) => (
            <Button
              key={String(opcion)}
              type="button"
              variant={valor === opcion ? "default" : "outline"}
              aria-pressed={valor === opcion}
              className="h-12 flex-1 sm:flex-none sm:px-8"
              // Tocar la elegida otra vez la borra.
              onClick={() => cambiar(valor === opcion ? undefined : opcion)}
            >
              {opcion ? "Sí" : "No"}
            </Button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{campo.etiqueta}</Label>
      {campo.tipo === "texto" && (
        <Input id={id} value={texto} maxLength={MAXIMO_RESPUESTA.texto} onChange={(e) => cambiar(e.target.value)} />
      )}
      {campo.tipo === "largo" && (
        <Textarea id={id} rows={4} value={texto} maxLength={MAXIMO_RESPUESTA.largo} onChange={(e) => cambiar(e.target.value)} />
      )}
      {campo.tipo === "opciones" && (
        <Select id={id} value={texto} onChange={(e) => cambiar(e.target.value)}>
          <option value="">Sin responder</option>
          {campo.opciones?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )}
      {campo.tipo === "fecha" && <Input id={id} type="date" value={texto} onChange={(e) => cambiar(e.target.value)} />}
    </div>
  );
}
