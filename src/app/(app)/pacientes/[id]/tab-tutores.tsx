"use client";

import { Check, Copy, Pencil, Plus, Star, UserMinus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EstadoFormularioTutor } from "@/lib/tutores/acciones";
import { mostrarTelefono } from "@/lib/tutores/telefono";
import { PARENTESCOS } from "@/lib/tutores/validacion";
import { FormularioTutor, type ValoresTutor } from "./formulario-tutor";

type Tutor = ValoresTutor & { id: string; token_ficha: string; otrosHijos: string[] };
type Disponible = { id: string; nombre: string; apellido: string | null; telefono_wa: string | null; hijos: string[] };
type AccionForm = (anterior: EstadoFormularioTutor, formulario: FormData) => Promise<EstadoFormularioTutor>;

export function TabTutores({
  tutores,
  responsableId,
  disponibles,
  agregarNuevo,
  vincularExistente,
  actualizar,
  quitar,
  marcarResponsable,
}: {
  tutores: Tutor[];
  responsableId: string | null;
  disponibles: Disponible[];
  agregarNuevo: AccionForm;
  vincularExistente: AccionForm;
  actualizar: (tutorId: string, anterior: EstadoFormularioTutor, formulario: FormData) => Promise<EstadoFormularioTutor>;
  quitar: (tutorId: string) => Promise<{ error: string | null }>;
  marcarResponsable: (tutorId: string) => Promise<{ error: string | null }>;
}) {
  // Qué se está editando: un tutor (por id), "nuevo", "existente" o nada.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
      {tutores.length === 0 && abierto === null && (
        <p className="text-muted-foreground">Este paciente todavía no tiene tutores.</p>
      )}

      {tutores.map((t) =>
        abierto === t.id ? (
          <FormularioTutor
            key={t.id}
            accion={actualizar.bind(null, t.id)}
            valores={t}
            textoBoton="Guardar cambios"
            alCancelar={() => setAbierto(null)}
            alGuardar={() => {
              setAbierto(null);
              setAviso("Guardado ✓");
            }}
          />
        ) : (
          <TarjetaTutor
            key={t.id}
            tutor={t}
            esResponsable={t.id === responsableId}
            alEditar={() => {
              setAviso(null);
              setAbierto(t.id);
            }}
            quitar={quitar}
            marcarResponsable={marcarResponsable}
            alAvisar={setAviso}
          />
        ),
      )}

      {abierto === "nuevo" && (
        <FormularioTutor
          accion={agregarNuevo}
          textoBoton="Agregar tutor"
          alCancelar={() => setAbierto(null)}
          alGuardar={() => {
            setAbierto(null);
            setAviso("Tutor agregado ✓");
          }}
        />
      )}
      {abierto === "existente" && (
        <ElegirExistente
          disponibles={disponibles}
          accion={vincularExistente}
          alCancelar={() => setAbierto(null)}
          alGuardar={() => {
            setAbierto(null);
            setAviso("Tutor agregado ✓");
          }}
        />
      )}

      {abierto === null && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="touch" variant="outline" className="flex-1" onClick={() => { setAviso(null); setAbierto("nuevo"); }}>
            <Plus /> Agregar tutor nuevo
          </Button>
          {disponibles.length > 0 && (
            <Button size="touch" variant="outline" className="flex-1" onClick={() => { setAviso(null); setAbierto("existente"); }}>
              <Plus /> Elegir uno ya cargado
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaTutor({
  tutor,
  esResponsable,
  alEditar,
  quitar,
  marcarResponsable,
  alAvisar,
}: {
  tutor: Tutor;
  esResponsable: boolean;
  alEditar: () => void;
  quitar: (tutorId: string) => Promise<{ error: string | null }>;
  marcarResponsable: (tutorId: string) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const nombre = `${tutor.nombre} ${tutor.apellido ?? ""}`.trim();
  const telefono = mostrarTelefono(tutor.telefono_wa);
  const documento =
    tutor.doc_tipo && tutor.doc_numero ? `${tutor.doc_tipo} ${tutor.doc_numero}${tutor.dv ? `-${tutor.dv}` : ""}` : null;

  async function copiarLink() {
    const link = `${window.location.origin}/ficha/${tutor.token_ficha}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copiá el link de la ficha:", link);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {nombre}
          {esResponsable && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Paga</span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">{tutor.parentesco}</span>
      </div>
      <dl className="grid gap-1 text-sm">
        <Dato etiqueta="WhatsApp">
          {telefono ? (
            <a href={`https://wa.me/${tutor.telefono_wa}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {telefono}
            </a>
          ) : null}
        </Dato>
        <Dato etiqueta="Email">{tutor.email}</Dato>
        <Dato etiqueta="Documento">{documento}</Dato>
        <Dato etiqueta="Razón social">{tutor.razon_social}</Dato>
        {tutor.otrosHijos.length > 0 && <Dato etiqueta="También es tutor de">{tutor.otrosHijos.join(", ")}</Dato>}
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={alEditar} disabled={ocupado}>
          <Pencil /> Editar
        </Button>
        <Button variant="outline" onClick={copiarLink}>
          {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Link de la ficha"}
        </Button>
        {!esResponsable && (
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const r = await marcarResponsable(tutor.id);
                alAvisar(r.error ?? `${tutor.nombre} es ahora quien paga ✓`);
              })
            }
          >
            <Star /> Marcar que paga
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={ocupado}
          onClick={() => {
            const extra = esResponsable ? "\nEs quien paga: el paciente va a quedar sin responsable de pago." : "";
            if (!window.confirm(`¿Quitar a ${nombre} de este paciente?${extra}`)) return;
            iniciar(async () => {
              const r = await quitar(tutor.id);
              alAvisar(r.error ?? `${tutor.nombre} ya no es tutor de este paciente.`);
            });
          }}
        >
          <UserMinus /> Quitar
        </Button>
      </div>
      {tutor.otrosHijos.length > 0 && (
        <p className="text-xs text-muted-foreground">Si editás sus datos, cambian también para {tutor.otrosHijos.join(", ")}.</p>
      )}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function ElegirExistente({
  disponibles,
  accion,
  alCancelar,
  alGuardar,
}: {
  disponibles: Disponible[];
  accion: AccionForm;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  async function enviarYCerrar(anterior: EstadoFormularioTutor, formulario: FormData) {
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    return resultado;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, { errores: {}, guardadoEn: null } as EstadoFormularioTutor);
  const e = estado.errores;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="e-tutor">Tutor</Label>
        <Select id="e-tutor" name="tutor_id" defaultValue={estado.enviado?.tutor_id ?? ""} aria-invalid={!!e.tutor_id}>
          <option value="">Elegí…</option>
          {disponibles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} {t.apellido}
              {t.hijos.length > 0 ? ` (de ${t.hijos.join(", ")})` : ""}
            </option>
          ))}
        </Select>
        {e.tutor_id && <p className="text-sm text-destructive">{e.tutor_id}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="e-parentesco">Parentesco con el paciente</Label>
        <Select id="e-parentesco" name="parentesco" defaultValue={estado.enviado?.parentesco ?? ""} aria-invalid={!!e.parentesco}>
          <option value="">Elegí…</option>
          {PARENTESCOS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        {e.parentesco && <p className="text-sm text-destructive">{e.parentesco}</p>}
      </div>
      {e.general && <p role="alert" className="text-sm text-destructive">{e.general}</p>}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Agregando…" : "Agregar tutor"}
      </Button>
      <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}
