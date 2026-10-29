"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormularioConfig } from "@/lib/config/acciones";

export type ValoresConsultorio = {
  nombre: string;
  profesional: string | null;
  ruc: string | null;
  dv: string | null;
  razon_social: string | null;
  direccion: string | null;
  datos_pago: string | null;
  horas_aviso_minimas: number;
  dia_limite_pago: number;
  concepto_factura: string;
};

type Accion = (anterior: EstadoFormularioConfig, formulario: FormData) => Promise<EstadoFormularioConfig>;

const inicial: EstadoFormularioConfig = { errores: {}, guardadoEn: null };

export function TabConsultorio({ accion, valores }: { accion: Accion; valores: ValoresConsultorio }) {
  const [estado, enviar, enviando] = useActionState(accion, inicial);
  const e = estado.errores;
  // Valor inicial de cada campo: lo que se escribió (si hubo error) o lo guardado.
  const v = (campo: keyof ValoresConsultorio) => estado.enviado?.[campo] ?? String(valores[campo] ?? "");

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-5 pt-4" noValidate>
      <Seccion titulo="Consultorio">
        <Campo id="nombre" etiqueta="Nombre" error={e.nombre} ayuda="Así aparece en los mensajes.">
          <Input id="nombre" name="nombre" defaultValue={v("nombre")} required autoComplete="off" aria-invalid={!!e.nombre} />
        </Campo>
        <Campo id="profesional" etiqueta="Profesional" error={e.profesional}>
          <Input id="profesional" name="profesional" defaultValue={v("profesional")} placeholder="Ej. Lic. en Fonoaudiología" autoComplete="off" />
        </Campo>
        <Campo id="direccion" etiqueta="Dirección" error={e.direccion}>
          <Input id="direccion" name="direccion" defaultValue={v("direccion")} autoComplete="off" />
        </Campo>
      </Seccion>

      <Seccion titulo="Facturación">
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Campo id="ruc" etiqueta="RUC" error={e.ruc}>
            <Input id="ruc" name="ruc" inputMode="numeric" defaultValue={v("ruc")} placeholder="Sin el DV" aria-invalid={!!e.ruc} />
          </Campo>
          <Campo id="dv" etiqueta="DV" error={e.dv}>
            <Input id="dv" name="dv" inputMode="numeric" maxLength={1} defaultValue={v("dv")} placeholder="Auto" aria-invalid={!!e.dv} />
          </Campo>
        </div>
        <Campo id="razon_social" etiqueta="Razón social" error={e.razon_social}>
          <Input id="razon_social" name="razon_social" defaultValue={v("razon_social")} autoComplete="off" />
        </Campo>
        <Campo
          id="concepto_factura"
          etiqueta="Concepto de factura"
          error={e.concepto_factura}
          ayuda="Se completa solo con los meses: “… – sesiones de octubre 2026”."
        >
          <Input id="concepto_factura" name="concepto_factura" defaultValue={v("concepto_factura")} aria-invalid={!!e.concepto_factura} />
        </Campo>
      </Seccion>

      <Seccion titulo="Cobros">
        <Campo id="datos_pago" etiqueta="Datos de pago" error={e.datos_pago} ayuda="Va en los mensajes de cobro. Ej. Alias 0000000 · Banco Ejemplo">
          <Textarea id="datos_pago" name="datos_pago" defaultValue={v("datos_pago")} />
        </Campo>
        <Campo
          id="horas_aviso_minimas"
          etiqueta="Horas mínimas de aviso"
          error={e.horas_aviso_minimas}
          ayuda="Si cancelan con menos horas, es “aviso tardío”."
        >
          <Input
            id="horas_aviso_minimas"
            name="horas_aviso_minimas"
            inputMode="numeric"
            defaultValue={v("horas_aviso_minimas")}
            aria-invalid={!!e.horas_aviso_minimas}
          />
        </Campo>
        <Campo
          id="dia_limite_pago"
          etiqueta="Plazo de pago (día del mes siguiente)"
          error={e.dia_limite_pago}
          ayuda="Para quienes pagan mensual."
        >
          <Select id="dia_limite_pago" name="dia_limite_pago" defaultValue={v("dia_limite_pago")} aria-invalid={!!e.dia_limite_pago}>
            {Array.from({ length: 28 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Día {i + 1}
              </option>
            ))}
          </Select>
        </Campo>
      </Seccion>

      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      {Object.keys(e).length > 0 && !e.general && (
        <p role="alert" className="text-sm text-destructive">
          Revisá los campos marcados.
        </p>
      )}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col gap-2 bg-background py-2 md:bottom-0">
        <Button type="submit" size="touch" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        {estado.guardadoEn && !enviando && (
          <p role="status" className="text-center text-sm text-muted-foreground">
            Guardado ✓
          </p>
        )}
      </div>
    </form>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
