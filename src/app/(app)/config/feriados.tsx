"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EstadoFormularioBloqueo } from "@/lib/agenda/acciones";
import { proximosBloqueos, textoBloqueo } from "@/lib/agenda/horario";
import { MESES } from "@/lib/pacientes/fecha";

type Bloqueo = { id: string; desde: string; hasta: string; motivo: string | null };
type AccionForm = (anterior: EstadoFormularioBloqueo, formulario: FormData) => Promise<EstadoFormularioBloqueo>;

// Feriados y vacaciones: días sin agenda. Se cargan a mano (las fechas de
// algunos feriados cambian cada año por decreto).
export function Feriados({
  bloqueos,
  hoy,
  agregar,
  borrar,
}: {
  bloqueos: Bloqueo[];
  /** "AAAA-MM-DD" en Asunción. */
  hoy: string;
  agregar: AccionForm;
  borrar: (id: string) => Promise<{ error: string | null }>;
}) {
  const [agregando, setAgregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Los borrados se esconden al instante, sin esperar a que el servidor mande la lista nueva.
  const [borrados, setBorrados] = useState<string[]>([]);
  const [borrando, iniciar] = useTransition();

  const proximos = proximosBloqueos(
    bloqueos.filter((b) => !borrados.includes(b.id)),
    hoy,
  );

  return (
    <div className="flex flex-col gap-4">
      {agregando ? (
        <FormularioBloqueo
          accion={agregar}
          hoy={hoy}
          alCancelar={() => setAgregando(false)}
          alGuardar={(r) => {
            setAgregando(false);
            setAviso(textoGuardado(r));
          }}
        />
      ) : (
        <Button
          size="touch"
          variant="outline"
          onClick={() => {
            setAviso(null);
            setAgregando(true);
          }}
        >
          <Plus /> Agregar feriado o vacaciones
        </Button>
      )}
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {proximos.length === 0 ? (
        <p className="text-muted-foreground">No hay feriados ni vacaciones cargados de acá en adelante.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {proximos.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2 pl-4 pr-1">
              <div className="flex flex-col">
                <span>{textoBloqueo(b)}</span>
                {b.motivo && <span className="text-sm text-muted-foreground">{b.motivo}</span>}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="size-12 text-destructive"
                aria-label={`Borrar ${textoBloqueo(b)}`}
                disabled={borrando}
                onClick={() => {
                  if (!window.confirm(`¿Borrar ${textoBloqueo(b)}${b.motivo ? ` (${b.motivo})` : ""}? Esos días vuelven a tener agenda.`)) return;
                  setAviso(null);
                  iniciar(async () => {
                    const r = await borrar(b.id);
                    if (r.error) setAviso(r.error);
                    else setBorrados((xs) => [...xs, b.id]);
                  });
                }}
              >
                <Trash2 className="size-5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inicial: EstadoFormularioBloqueo = { errores: {}, guardadoEn: null };

/** "Guardado ✓", más lo que pasó con los turnos que ya estaban en esos días. */
function textoGuardado(r: EstadoFormularioBloqueo): string {
  const partes = ["Guardado ✓"];
  const fijos = r.turnosFijosQuitados ?? 0;
  const aMano = r.turnosAMano ?? 0;
  if (fijos > 0) partes.push(`Se quitaron ${fijos} ${fijos === 1 ? "turno fijo" : "turnos fijos"} de esos días.`);
  if (aMano > 0) {
    partes.push(`Ojo: ${aMano === 1 ? "queda 1 turno agendado" : `quedan ${aMano} turnos agendados`} a mano esos días; revisalos en la agenda.`);
  }
  return partes.join(" ");
}

function FormularioBloqueo({
  accion,
  hoy,
  alCancelar,
  alGuardar,
}: {
  accion: AccionForm;
  hoy: string;
  alCancelar: () => void;
  alGuardar: (resultado: EstadoFormularioBloqueo) => void;
}) {
  async function guardar(anterior: EstadoFormularioBloqueo, formulario: FormData) {
    const r = await accion(anterior, formulario);
    if (r.guardadoEn) alGuardar(r);
    return r;
  }
  const [estado, enviar, enviando] = useActionState(guardar, inicial);
  const e = estado.errores;
  const anio = Number(hoy.slice(0, 4));
  const anios = [anio - 1, anio, anio + 1, anio + 2];

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <RuedasFecha prefijo="desde" titulo="Desde" anios={anios} enviado={estado.enviado} predeterminado={hoy} error={e.desde} />
      <RuedasFecha prefijo="hasta" titulo="Hasta (dejalo vacío si es un solo día)" anios={anios} enviado={estado.enviado} error={e.hasta} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="motivo">Motivo (opcional)</Label>
        <Input id="motivo" name="motivo" placeholder="Ej. Feriado, vacaciones, congreso" maxLength={100} defaultValue={estado.enviado?.motivo ?? ""} aria-invalid={!!e.motivo} />
        {e.motivo && <p className="text-sm text-destructive">{e.motivo}</p>}
      </div>
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button type="submit" size="touch" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Tres ruedas (día, mes, año), igual que la fecha de nacimiento. */
function RuedasFecha({
  prefijo,
  titulo,
  anios,
  enviado,
  predeterminado,
  error,
}: {
  prefijo: string;
  titulo: string;
  anios: number[];
  enviado?: Record<string, string>;
  /** "AAAA-MM-DD" para arrancar elegido; sin esto, las ruedas arrancan vacías. */
  predeterminado?: string;
  error?: string;
}) {
  const [a, m, d] = predeterminado ? predeterminado.split("-").map(Number) : [];
  const v = (campo: string, guardado?: number) => enviado?.[`${prefijo}_${campo}`] ?? (guardado ? String(guardado) : "");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{titulo}</legend>
      <div className="grid grid-cols-[1fr_2fr_1.5fr] gap-2">
        <Select name={`${prefijo}_dia`} aria-label={`${titulo}: día`} defaultValue={v("dia", d)} aria-invalid={!!error}>
          <option value="">Día</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </Select>
        <Select name={`${prefijo}_mes`} aria-label={`${titulo}: mes`} defaultValue={v("mes", m)} aria-invalid={!!error}>
          <option value="">Mes</option>
          {MESES.map((mes, i) => (
            <option key={mes} value={i + 1}>
              {mes}
            </option>
          ))}
        </Select>
        <Select name={`${prefijo}_anio`} aria-label={`${titulo}: año`} defaultValue={v("anio", a)} aria-invalid={!!error}>
          <option value="">Año</option>
          {anios.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
