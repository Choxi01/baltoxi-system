"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatoGs } from "@/lib/cobro/formato";
import { NOMBRE_ESTADO, ESTADOS_PACIENTE } from "@/lib/pacientes/busqueda";
import { aniosParaElegir, MESES, partirFecha } from "@/lib/pacientes/fecha";
import type { EstadoFormularioPaciente } from "@/lib/pacientes/acciones";
import { NOMBRE_PLAN, PLANES_COBRO } from "@/lib/pacientes/validacion";

export type ValoresPaciente = {
  nombre: string;
  apellido: string | null;
  fecha_nacimiento: string | null;
  colegio: string | null;
  derivado_por: string | null;
  motivo_consulta: string | null;
  estado: string;
  tarifa_id: string | null;
  monto_override_gs: number | null;
  plan_cobro: string;
  responsable_pago_id: string | null;
};

type Accion = (anterior: EstadoFormularioPaciente, formulario: FormData) => Promise<EstadoFormularioPaciente>;

const inicial: EstadoFormularioPaciente = { errores: {}, guardadoEn: null };

export function FormularioPaciente({
  accion,
  valores,
  tarifas,
  tutores,
  textoBoton,
  hoy,
  alCancelar,
}: {
  accion: Accion;
  /** "AAAA-MM-DD" en Asunción, para la lista de años. */
  hoy: string;
  /** Si está, muestra el botón Cancelar (volver al resumen sin guardar). */
  alCancelar?: () => void;
  valores?: ValoresPaciente;
  tarifas: { id: string; nombre: string; monto_gs: number }[];
  /** Tutores ya vinculados (para elegir responsable de pago). Sin esto, no se muestra el campo. */
  tutores?: { id: string; nombre: string; apellido: string | null }[];
  textoBoton: string;
}) {
  const [estado, enviar, enviando] = useActionState(accion, inicial);
  const e = estado.errores;
  // Valor inicial de cada campo: lo que se escribió (si hubo error) o lo guardado.
  const v = (campo: string, guardado: string | number | null | undefined) =>
    estado.enviado?.[campo] ?? (guardado == null ? "" : String(guardado));
  const fecha = partirFecha(valores?.fecha_nacimiento);

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-5" noValidate>
      <Seccion titulo="Datos personales">
        <Campo id="nombre" etiqueta="Nombre" error={e.nombre}>
          <Input id="nombre" name="nombre" defaultValue={v("nombre", valores?.nombre)} required autoComplete="off" aria-invalid={!!e.nombre} />
        </Campo>
        <Campo id="apellido" etiqueta="Apellido" error={e.apellido}>
          <Input id="apellido" name="apellido" defaultValue={v("apellido", valores?.apellido ?? "")} autoComplete="off" />
        </Campo>
        {/* Tres ruedas (día, mes, año): en el iPhone es más cómodo que el calendario. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Fecha de nacimiento</legend>
          <div className="grid grid-cols-[1fr_2fr_1.5fr] gap-2">
            <Select name="fecha_dia" aria-label="Día" defaultValue={v("fecha_dia", fecha.dia)} aria-invalid={!!e.fecha_nacimiento}>
              <option value="">Día</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
            <Select name="fecha_mes" aria-label="Mes" defaultValue={v("fecha_mes", fecha.mes)} aria-invalid={!!e.fecha_nacimiento}>
              <option value="">Mes</option>
              {MESES.map((mes, i) => (
                <option key={mes} value={i + 1}>
                  {mes}
                </option>
              ))}
            </Select>
            <Select name="fecha_anio" aria-label="Año" defaultValue={v("fecha_anio", fecha.anio)} aria-invalid={!!e.fecha_nacimiento}>
              <option value="">Año</option>
              {aniosParaElegir(hoy).map((anio) => (
                <option key={anio} value={anio}>
                  {anio}
                </option>
              ))}
            </Select>
          </div>
          {e.fecha_nacimiento && <p className="text-sm text-destructive">{e.fecha_nacimiento}</p>}
        </fieldset>
        <Campo id="colegio" etiqueta="Colegio" error={e.colegio}>
          <Input id="colegio" name="colegio" defaultValue={v("colegio", valores?.colegio ?? "")} />
        </Campo>
        <Campo id="derivado_por" etiqueta="Derivado por" error={e.derivado_por}>
          <Input id="derivado_por" name="derivado_por" defaultValue={v("derivado_por", valores?.derivado_por ?? "")} placeholder="Médico, colegio, otro profesional" />
        </Campo>
      </Seccion>

      <Seccion titulo="Consulta" aviso="Dato clínico: solo se ve en el expediente.">
        <Campo id="motivo_consulta" etiqueta="Motivo de consulta" error={e.motivo_consulta}>
          <Textarea id="motivo_consulta" name="motivo_consulta" defaultValue={v("motivo_consulta", valores?.motivo_consulta ?? "")} />
        </Campo>
        <Campo id="estado" etiqueta="Estado" error={e.estado}>
          <Select id="estado" name="estado" defaultValue={v("estado", valores?.estado ?? "activo")}>
            {ESTADOS_PACIENTE.map((v) => (
              <option key={v} value={v}>
                {NOMBRE_ESTADO[v]}
              </option>
            ))}
          </Select>
        </Campo>
      </Seccion>

      <Seccion titulo="Cobro">
        <Campo id="tarifa_id" etiqueta="Tarifa" error={e.tarifa_id}>
          <Select id="tarifa_id" name="tarifa_id" defaultValue={v("tarifa_id", valores?.tarifa_id ?? "")}>
            <option value="">Sin tarifa</option>
            {tarifas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {formatoGs(t.monto_gs)}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo id="monto_override_gs" etiqueta="Precio especial (opcional)" error={e.monto_override_gs} ayuda="Si lo completás, reemplaza a la tarifa en las sesiones del consultorio.">
          <Input
            id="monto_override_gs"
            name="monto_override_gs"
            inputMode="numeric"
            placeholder="Ej. 250.000"
            defaultValue={v("monto_override_gs", valores?.monto_override_gs != null ? formatoGs(valores.monto_override_gs).replace("Gs. ", "") : "")}
            aria-invalid={!!e.monto_override_gs}
          />
        </Campo>
        <Campo id="plan_cobro" etiqueta="Forma de pago" error={e.plan_cobro}>
          <Select id="plan_cobro" name="plan_cobro" defaultValue={v("plan_cobro", valores?.plan_cobro ?? "mensual")}>
            {PLANES_COBRO.map((v) => (
              <option key={v} value={v}>
                {NOMBRE_PLAN[v]}
              </option>
            ))}
          </Select>
        </Campo>
        {tutores && (
          <Campo
            id="responsable_pago_id"
            etiqueta="Responsable de pago"
            error={e.responsable_pago_id}
            ayuda={tutores.length === 0 ? "Primero agregá un tutor en la pestaña Tutores." : undefined}
          >
            <Select id="responsable_pago_id" name="responsable_pago_id" defaultValue={v("responsable_pago_id", valores?.responsable_pago_id ?? "")} disabled={tutores.length === 0}>
              <option value="">Sin elegir</option>
              {tutores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} {t.apellido}
                </option>
              ))}
            </Select>
          </Campo>
        )}
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
          {enviando ? "Guardando…" : textoBoton}
        </Button>
        {alCancelar && (
          <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
            Cancelar
          </Button>
        )}
        {estado.guardadoEn && !enviando && (
          <p role="status" className="text-center text-sm text-muted-foreground">
            Guardado ✓
          </p>
        )}
      </div>
    </form>
  );
}

function Seccion({ titulo, aviso, children }: { titulo: string; aviso?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      {aviso && <p className="-mt-2 text-xs text-muted-foreground">{aviso}</p>}
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
