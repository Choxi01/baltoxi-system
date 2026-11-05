"use client";

import { Camera, Eye, FileText, FolderOpen, Image as IconoImagen, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { achicarImagen } from "@/lib/documentos/achicar";
import {
  NOMBRE_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO,
  clasificarArchivo,
  textoTamano,
  validarDocumento,
  type MimeGuardado,
  type TipoDocumento,
} from "@/lib/documentos/reglas";
import type { EstadoFormularioPaciente } from "@/lib/pacientes/acciones";
import { textoFecha } from "@/lib/pacientes/fecha";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

// Pestaña Documentos del expediente (tarea A7). DATOS CLÍNICOS: los archivos están en un bucket
// privado y solo se abren con links firmados de 5 minutos, que nunca se guardan.

type Documento = { id: string; tipo: string; titulo: string; fecha: string | null; mime: string; tamano_bytes: number };
type Elegido = { archivo: Blob; mime: MimeGuardado; vistaPrevia: string | null; tamano: number };

const nombreTipo = (t: string) => NOMBRE_TIPO_DOCUMENTO[t as TipoDocumento] ?? t;

export function TabDocumentos({
  documentos,
  hoy,
  prepararSubida,
  registrar,
  descartarSubida,
  pedirLink,
  borrar,
}: {
  documentos: Documento[];
  hoy: string;
  prepararSubida: (mime: string) => Promise<{ ruta: string } | { error: string }>;
  registrar: (anterior: EstadoFormularioPaciente, formulario: FormData) => Promise<EstadoFormularioPaciente>;
  descartarSubida: (ruta: string, mime: string) => Promise<void>;
  pedirLink: (documentoId: string) => Promise<{ url: string } | { error: string }>;
  borrar: (documentoId: string) => Promise<{ error: string | null }>;
}) {
  const camara = useRef<HTMLInputElement>(null);
  const archivos = useRef<HTMLInputElement>(null);
  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La vista previa es un link local al archivo: se libera al cerrarla.
  useEffect(() => {
    const url = elegido?.vistaPrevia;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [elegido]);

  async function alElegir(lista: FileList | null) {
    const archivo = lista?.[0];
    // Que se pueda volver a elegir el mismo archivo.
    if (camara.current) camara.current.value = "";
    if (archivos.current) archivos.current.value = "";
    if (!archivo) return;
    setAviso(null);
    setError(null);
    const clase = clasificarArchivo(archivo);
    if (!clase.ok) {
      setError(clase.error);
      return;
    }
    if (clase.accion === "tal_cual") {
      setElegido({ archivo, mime: "application/pdf", vistaPrevia: null, tamano: archivo.size });
      return;
    }
    setPreparando(true);
    try {
      const jpeg = await achicarImagen(archivo);
      setElegido({ archivo: jpeg, mime: "image/jpeg", vistaPrevia: URL.createObjectURL(jpeg), tamano: jpeg.size });
    } catch {
      setError("No se pudo abrir esa imagen. Probá con otra foto o con un PDF.");
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      {elegido ? (
        <FormularioDocumento
          elegido={elegido}
          hoy={hoy}
          prepararSubida={prepararSubida}
          registrar={registrar}
          descartarSubida={descartarSubida}
          alCancelar={() => setElegido(null)}
          alGuardar={() => {
            setElegido(null);
            setAviso("Documento guardado ✓");
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* capture: en el iPhone abre directo la cámara de atrás. */}
          <input ref={camara} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => alElegir(e.target.files)} />
          <input ref={archivos} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={(e) => alElegir(e.target.files)} />
          <Button size="touch" variant="outline" disabled={preparando} onClick={() => camara.current?.click()}>
            <Camera /> Sacar foto
          </Button>
          <Button size="touch" variant="outline" disabled={preparando} onClick={() => archivos.current?.click()}>
            <FolderOpen /> Elegir archivo
          </Button>
        </div>
      )}
      {preparando && <p className="text-center text-sm text-muted-foreground">Preparando la foto…</p>}

      {documentos.length === 0 && !elegido && <p className="text-muted-foreground">Todavía no hay documentos de este paciente.</p>}
      <ul className="flex flex-col gap-3">
        {documentos.map((d) => (
          <li key={d.id}>
            <TarjetaDocumento documento={d} pedirLink={pedirLink} borrar={borrar} alAvisar={setAviso} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TarjetaDocumento({
  documento,
  pedirLink,
  borrar,
  alAvisar,
}: {
  documento: Documento;
  pedirLink: (documentoId: string) => Promise<{ url: string } | { error: string }>;
  borrar: (documentoId: string) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  // Link firmado de 5 minutos: solo en memoria, mientras está abierto.
  const [link, setLink] = useState<string | null>(null);
  const esImagen = documento.mime.startsWith("image/");
  const Icono = esImagen ? IconoImagen : FileText;

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium">{documento.titulo}</span>
          <span className="text-sm text-muted-foreground">
            {[nombreTipo(documento.tipo), documento.fecha ? textoFecha(documento.fecha) : null, textoTamano(documento.tamano_bytes)].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      {link && (
        <div className="flex flex-col gap-2">
          {esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element -- link firmado que vence: no pasa por next/image
            <img src={link} alt={documento.titulo} className="max-h-[70vh] w-full rounded-md border object-contain" />
          ) : (
            <Button asChild size="touch">
              <a href={link} target="_blank" rel="noopener noreferrer">
                <FileText /> Abrir PDF
              </a>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">El link vence en 5 minutos. Para verlo después, tocá Ver otra vez.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {link ? (
          <Button variant="outline" className="h-11" onClick={() => setLink(null)}>
            <X /> Cerrar
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-11"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                alAvisar(null);
                const r = await pedirLink(documento.id);
                if ("url" in r) setLink(r.url);
                else alAvisar(r.error);
              })
            }
          >
            <Eye /> {ocupado ? "Abriendo…" : "Ver"}
          </Button>
        )}
        <Button
          variant="ghost"
          className="h-11 text-destructive"
          disabled={ocupado}
          onClick={() => {
            if (!window.confirm(`¿Borrar «${documento.titulo}»?\nSe borra el archivo y no se puede deshacer.`)) return;
            iniciar(async () => {
              const r = await borrar(documento.id);
              alAvisar(r.error ?? "Documento borrado.");
            });
          }}
        >
          <Trash2 /> Borrar
        </Button>
      </div>
    </article>
  );
}

function FormularioDocumento({
  elegido,
  hoy,
  prepararSubida,
  registrar,
  descartarSubida,
  alCancelar,
  alGuardar,
}: {
  elegido: Elegido;
  hoy: string;
  prepararSubida: (mime: string) => Promise<{ ruta: string } | { error: string }>;
  registrar: (anterior: EstadoFormularioPaciente, formulario: FormData) => Promise<EstadoFormularioPaciente>;
  descartarSubida: (ruta: string, mime: string) => Promise<void>;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  async function subirYGuardar(anterior: EstadoFormularioPaciente, formulario: FormData): Promise<EstadoFormularioPaciente> {
    const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
    const conError = (errores: EstadoFormularioPaciente["errores"]) => ({ errores, guardadoEn: null, enviado, revision: Date.now() });

    // Primero los datos: no subir el archivo si después no se va a poder guardar.
    const validacion = validarDocumento(formulario, hoy);
    if (!validacion.ok) return conError(validacion.errores);

    const preparada = await prepararSubida(elegido.mime);
    if ("error" in preparada) return conError({ general: preparada.error });

    const supabase = crearClienteNavegador();
    const { error } = await supabase.storage
      .from("documentos")
      .upload(preparada.ruta, elegido.archivo, { contentType: elegido.mime, upsert: false });
    if (error) return conError({ general: "No se pudo subir el archivo. Revisá la conexión y probá de nuevo." });

    formulario.set("ruta", preparada.ruta);
    formulario.set("mime", elegido.mime);
    const resultado = await registrar(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    else await descartarSubida(preparada.ruta, elegido.mime);
    return resultado;
  }

  const [estado, enviar, enviando] = useActionState(subirYGuardar, { errores: {}, guardadoEn: null } as EstadoFormularioPaciente);
  const e = estado.errores;
  const enviado = estado.enviado;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <h3 className="font-medium">Nuevo documento</h3>
      {elegido.vistaPrevia ? (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image
        <img src={elegido.vistaPrevia} alt="Vista previa" className="max-h-64 w-full rounded-md border object-contain" />
      ) : (
        <p className="flex items-center gap-2 rounded-md border px-3 py-3 text-sm">
          <FileText className="size-5 text-muted-foreground" /> PDF · {textoTamano(elegido.tamano)}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-tipo">Tipo</Label>
        <Select id="doc-tipo" name="tipo" defaultValue={enviado?.tipo ?? ""} aria-invalid={!!e.tipo}>
          <option value="" disabled>
            Elegí el tipo
          </option>
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TIPO_DOCUMENTO[t]}
            </option>
          ))}
        </Select>
        {e.tipo && <p className="text-sm text-destructive">{e.tipo}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-titulo">Título</Label>
        <Input id="doc-titulo" name="titulo" autoComplete="off" maxLength={120} defaultValue={enviado?.titulo ?? ""} aria-invalid={!!e.titulo} />
        {e.titulo && <p className="text-sm text-destructive">{e.titulo}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-fecha">Fecha del documento (opcional)</Label>
        <Input id="doc-fecha" name="fecha" type="date" max={hoy} defaultValue={enviado?.fecha ?? ""} aria-invalid={!!e.fecha} className="h-12" />
        {e.fecha && <p className="text-sm text-destructive">{e.fecha}</p>}
      </div>
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Subiendo…" : "Guardar documento"}
      </Button>
      <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}
