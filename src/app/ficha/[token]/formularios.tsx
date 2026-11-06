"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EstadoFicha } from "@/lib/ficha/acciones";
import { calcularDv } from "@/lib/tutores/ruc";
import { mostrarTelefono } from "@/lib/tutores/telefono";
import { PARENTESCOS } from "@/lib/tutores/validacion";

// Formularios de la ficha online de la familia (tarea A8a). Textos de vos, botones grandes.

type Accion = (anterior: EstadoFicha, formulario: FormData) => Promise<EstadoFicha>;
const INICIAL: EstadoFicha = { errores: {}, guardadoEn: null };

function Campo({ id, etiqueta, error, ayuda, children }: { id: string; etiqueta: string; error?: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-sm text-muted-foreground">{ayuda}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Pie({ estado, enviando, texto }: { estado: EstadoFicha; enviando: boolean; texto: string }) {
  return (
    <>
      {estado.errores.general && (
        <p role="alert" className="text-sm text-destructive">
          {estado.errores.general}
        </p>
      )}
      {estado.guardadoEn && !enviando && (
        <p role="status" className="text-sm text-muted-foreground">
          Guardado ✓ ¡Gracias!
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Guardando…" : texto}
      </Button>
    </>
  );
}

export type ValoresTutorFicha = {
  nombre: string;
  apellido: string | null;
  telefono_wa: string | null;
  email: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  dv: string | null;
  razon_social: string | null;
};

/** Datos del tutor y datos para la factura. */
export function FormularioTutorFicha({ accion, valores }: { accion: Accion; valores: ValoresTutorFicha }) {
  const [estado, enviar, enviando] = useActionState(accion, INICIAL);
  const e = estado.errores;
  const v = (campo: keyof ValoresTutorFicha) => estado.enviado?.[campo] ?? (campo === "telefono_wa" ? mostrarTelefono(valores.telefono_wa) : valores[campo]) ?? "";
  const [docTipo, setDocTipo] = useState(v("doc_tipo"));
  const [docNumero, setDocNumero] = useState(v("doc_numero"));
  const dvCalculado = docTipo === "RUC" && docNumero ? calcularDv(docNumero.replace(/[.\s]/g, "")) : null;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="f-nombre" etiqueta="Nombre" error={e.nombre}>
          <Input id="f-nombre" name="nombre" autoComplete="given-name" defaultValue={v("nombre")} aria-invalid={!!e.nombre} />
        </Campo>
        <Campo id="f-apellido" etiqueta="Apellido" error={e.apellido}>
          <Input id="f-apellido" name="apellido" autoComplete="family-name" defaultValue={v("apellido")} />
        </Campo>
      </div>
      <Campo id="f-telefono" etiqueta="WhatsApp" error={e.telefono_wa} ayuda="Ej. 0981 123 456">
        <Input id="f-telefono" name="telefono_wa" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v("telefono_wa")} aria-invalid={!!e.telefono_wa} />
      </Campo>
      <Campo id="f-email" etiqueta="Email (opcional)" error={e.email}>
        <Input id="f-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={v("email")} aria-invalid={!!e.email} />
      </Campo>

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 font-medium">Datos para la factura</legend>
        <p className="-mt-2 text-sm text-muted-foreground">Si no necesitás factura con tus datos, dejalo vacío.</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-doc">RUC o cédula</Label>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <Select name="doc_tipo" aria-label="Tipo de documento" value={docTipo} onChange={(ev) => setDocTipo(ev.target.value)}>
              <option value="">—</option>
              <option value="RUC">RUC</option>
              <option value="CI">CI</option>
            </Select>
            <Input
              id="f-doc"
              name="doc_numero"
              inputMode="numeric"
              value={docNumero}
              onChange={(ev) => setDocNumero(ev.target.value)}
              aria-invalid={!!e.doc_numero || !!e.doc_tipo}
            />
          </div>
          {(e.doc_tipo || e.doc_numero) && <p className="text-sm text-destructive">{e.doc_tipo ?? e.doc_numero}</p>}
        </div>
        {docTipo === "RUC" && (
          <Campo id="f-dv" etiqueta="DV" error={e.dv} ayuda={dvCalculado !== null ? `Para ese RUC el DV es ${dvCalculado}. Si lo dejás vacío, se pone solo.` : undefined}>
            <Input id="f-dv" name="dv" inputMode="numeric" maxLength={1} className="w-20" defaultValue={v("dv")} aria-invalid={!!e.dv} />
          </Campo>
        )}
        <Campo id="f-razon" etiqueta="Razón social (opcional)" error={e.razon_social} ayuda="Si la dejás vacía, va tu nombre y apellido.">
          <Input id="f-razon" name="razon_social" defaultValue={v("razon_social")} />
        </Campo>
      </fieldset>
      <Pie estado={estado} enviando={enviando} texto="Guardar mis datos" />
    </form>
  );
}

export type ValoresHijo = { id: string; nombre: string; apellido: string | null; fecha_nacimiento: string | null; colegio: string | null };

/** Datos de un hijo: solo nombre, apellido, fecha de nacimiento y colegio. */
export function FormularioHijo({ accion, valores, hoy }: { accion: Accion; valores: ValoresHijo; hoy: string }) {
  const [estado, enviar, enviando] = useActionState(accion, INICIAL);
  const e = estado.errores;
  const v = (campo: keyof Omit<ValoresHijo, "id">) => estado.enviado?.[campo] ?? valores[campo] ?? "";
  const p = valores.id;
  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${p}-nombre`} etiqueta="Nombre" error={e.nombre}>
          <Input id={`${p}-nombre`} name="nombre" autoComplete="off" defaultValue={v("nombre")} aria-invalid={!!e.nombre} />
        </Campo>
        <Campo id={`${p}-apellido`} etiqueta="Apellido" error={e.apellido}>
          <Input id={`${p}-apellido`} name="apellido" autoComplete="off" defaultValue={v("apellido")} />
        </Campo>
      </div>
      <Campo id={`${p}-nacimiento`} etiqueta="Fecha de nacimiento" error={e.fecha_nacimiento}>
        <Input
          id={`${p}-nacimiento`}
          name="fecha_nacimiento"
          type="date"
          min="1900-01-01"
          max={hoy}
          className="h-12"
          defaultValue={v("fecha_nacimiento")}
          aria-invalid={!!e.fecha_nacimiento}
        />
      </Campo>
      <Campo id={`${p}-colegio`} etiqueta="Colegio (opcional)" error={e.colegio}>
        <Input id={`${p}-colegio`} name="colegio" autoComplete="off" defaultValue={v("colegio")} />
      </Campo>
      <Pie estado={estado} enviando={enviando} texto="Guardar" />
    </form>
  );
}

/** Agregar otro tutor (abuela, papá...): nombre, parentesco y WhatsApp. */
export function FormularioOtroTutor({ accion }: { accion: Accion }) {
  const [abierto, setAbierto] = useState(false);
  async function enviarYCerrar(anterior: EstadoFicha, formulario: FormData) {
    const r = await accion(anterior, formulario);
    if (r.guardadoEn) setAbierto(false);
    return r;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, INICIAL);
  const e = estado.errores;
  const v = (campo: string) => estado.enviado?.[campo] ?? "";

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        {estado.guardadoEn && (
          <p role="status" className="text-sm text-muted-foreground">
            Agregado ✓ ¡Gracias!
          </p>
        )}
        <Button size="touch" variant="outline" onClick={() => setAbierto(true)}>
          <Plus /> Agregar otro tutor
        </Button>
      </div>
    );
  }
  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="o-nombre" etiqueta="Nombre" error={e.nombre}>
          <Input id="o-nombre" name="nombre" autoComplete="off" defaultValue={v("nombre")} aria-invalid={!!e.nombre} />
        </Campo>
        <Campo id="o-apellido" etiqueta="Apellido" error={e.apellido}>
          <Input id="o-apellido" name="apellido" autoComplete="off" defaultValue={v("apellido")} />
        </Campo>
      </div>
      <Campo id="o-parentesco" etiqueta="Parentesco" error={e.parentesco}>
        <Select id="o-parentesco" name="parentesco" defaultValue={v("parentesco")} aria-invalid={!!e.parentesco}>
          <option value="" disabled>
            Elegí
          </option>
          {PARENTESCOS.map((pa) => (
            <option key={pa} value={pa}>
              {pa[0].toUpperCase() + pa.slice(1)}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo id="o-telefono" etiqueta="WhatsApp" error={e.telefono_wa} ayuda="Ej. 0981 123 456">
        <Input id="o-telefono" name="telefono_wa" type="tel" inputMode="tel" defaultValue={v("telefono_wa")} aria-invalid={!!e.telefono_wa} />
      </Campo>
      <Pie estado={estado} enviando={enviando} texto="Agregar" />
      <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}
