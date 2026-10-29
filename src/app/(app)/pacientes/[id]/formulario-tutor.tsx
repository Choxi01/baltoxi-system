"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EstadoFormularioTutor } from "@/lib/tutores/acciones";
import { calcularDv } from "@/lib/tutores/ruc";
import { mostrarTelefono } from "@/lib/tutores/telefono";
import { PARENTESCOS } from "@/lib/tutores/validacion";

export type ValoresTutor = {
  nombre: string;
  apellido: string | null;
  telefono_wa: string | null;
  email: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  dv: string | null;
  razon_social: string | null;
  parentesco: string;
};

type Accion = (anterior: EstadoFormularioTutor, formulario: FormData) => Promise<EstadoFormularioTutor>;
const inicial: EstadoFormularioTutor = { errores: {}, guardadoEn: null };

export function FormularioTutor({
  accion,
  valores,
  textoBoton,
  alCancelar,
  alGuardar,
}: {
  accion: Accion;
  valores?: ValoresTutor;
  textoBoton: string;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  async function enviarYCerrar(anterior: EstadoFormularioTutor, formulario: FormData) {
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    return resultado;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, inicial);
  const e = estado.errores;
  const v = (campo: string, guardado: string | null | undefined) => estado.enviado?.[campo] ?? guardado ?? "";

  // El DV del RUC se calcula mientras escriben.
  const [docTipo, setDocTipo] = useState(v("doc_tipo", valores?.doc_tipo));
  const [docNumero, setDocNumero] = useState(v("doc_numero", valores?.doc_numero));
  const dvCalculado = docTipo === "RUC" ? calcularDv(docNumero) : null;

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="t-nombre" etiqueta="Nombre" error={e.nombre}>
          <Input id="t-nombre" name="nombre" defaultValue={v("nombre", valores?.nombre)} autoComplete="off" aria-invalid={!!e.nombre} />
        </Campo>
        <Campo id="t-apellido" etiqueta="Apellido" error={e.apellido}>
          <Input id="t-apellido" name="apellido" defaultValue={v("apellido", valores?.apellido)} autoComplete="off" />
        </Campo>
      </div>
      <Campo id="t-parentesco" etiqueta="Parentesco con el paciente" error={e.parentesco}>
        <Select id="t-parentesco" name="parentesco" defaultValue={v("parentesco", valores?.parentesco)} aria-invalid={!!e.parentesco}>
          <option value="">Elegí…</option>
          {PARENTESCOS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo id="t-telefono" etiqueta="WhatsApp" error={e.telefono_wa}>
        <Input
          id="t-telefono"
          name="telefono_wa"
          type="tel"
          inputMode="tel"
          placeholder="0981 123 456"
          defaultValue={v("telefono_wa", mostrarTelefono(valores?.telefono_wa ?? null))}
          aria-invalid={!!e.telefono_wa}
        />
      </Campo>
      <Campo id="t-email" etiqueta="Email" error={e.email}>
        <Input id="t-email" name="email" type="email" inputMode="email" defaultValue={v("email", valores?.email)} aria-invalid={!!e.email} />
      </Campo>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-semibold">Datos para la factura</legend>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Select name="doc_tipo" aria-label="Tipo de documento" value={docTipo} onChange={(ev) => setDocTipo(ev.target.value)}>
            <option value="">Sin doc.</option>
            <option value="RUC">RUC</option>
            <option value="CI">CI</option>
          </Select>
          <Input
            name="doc_numero"
            inputMode="numeric"
            aria-label="Número de documento"
            placeholder="Número"
            value={docNumero}
            onChange={(ev) => setDocNumero(ev.target.value)}
            aria-invalid={!!e.doc_numero || !!e.doc_tipo}
          />
        </div>
        {(e.doc_tipo || e.doc_numero) && <p className="-mt-2 text-sm text-destructive">{e.doc_tipo ?? e.doc_numero}</p>}
        {docTipo === "RUC" && (
          <Campo id="t-dv" etiqueta="DV" error={e.dv} ayuda={dvCalculado !== null ? `Para ese RUC el DV es ${dvCalculado}. Si lo dejás vacío, se pone solo.` : undefined}>
            <Input id="t-dv" name="dv" inputMode="numeric" maxLength={1} className="w-20" defaultValue={v("dv", valores?.dv)} aria-invalid={!!e.dv} />
          </Campo>
        )}
        <Campo id="t-razon" etiqueta="Razón social" error={e.razon_social} ayuda="Si queda vacía, la factura sale a nombre y apellido.">
          <Input id="t-razon" name="razon_social" defaultValue={v("razon_social", valores?.razon_social)} />
        </Campo>
      </fieldset>

      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button type="submit" size="touch" disabled={enviando}>
          {enviando ? "Guardando…" : textoBoton}
        </Button>
        <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Campo({ id, etiqueta, error, ayuda, children }: { id: string; etiqueta: string; error?: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
