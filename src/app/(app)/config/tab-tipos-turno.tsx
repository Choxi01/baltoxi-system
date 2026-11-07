"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CLASES_COLOR, COLORES_TIPO, NOMBRE_COLOR, colorDeTipo, colorSugerido } from "@/lib/agenda/colores";
import type { EstadoFormularioConfig } from "@/lib/config/acciones";
import { CUPOS, MODALIDADES, NOMBRE_MODALIDAD, nombreCupo, type Modalidad } from "@/lib/config/validacion";
import { formatoGs } from "@/lib/cobro/formato";
import { cn } from "@/lib/utils";

type TipoTurno = {
  id: string;
  nombre: string;
  modalidad: string;
  color: string | null;
  cupo: number;
  tarifa_id: string | null;
  cobra_en_el_momento: boolean;
  genera_cobro: boolean;
  requiere_paciente: boolean;
  activo: boolean;
};
type Tarifa = { id: string; nombre: string; monto_gs: number; activa: boolean };
type AccionForm = (anterior: EstadoFormularioConfig, formulario: FormData) => Promise<EstadoFormularioConfig>;

const nombreModalidad = (m: string) => NOMBRE_MODALIDAD[m as Modalidad] ?? m;

export function TabTiposTurno({
  tipos,
  tarifas,
  crear,
  actualizar,
  cambiarActivo,
}: {
  tipos: TipoTurno[];
  tarifas: Tarifa[];
  crear: AccionForm;
  actualizar: (id: string, anterior: EstadoFormularioConfig, formulario: FormData) => Promise<EstadoFormularioConfig>;
  cambiarActivo: (id: string, activo: boolean) => Promise<{ error: string | null }>;
}) {
  // Qué se está editando: un tipo (por id), "nuevo" o nada.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function abrir(id: string) {
    setAviso(null);
    setAbierto(id);
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Cada tipo usa una tarifa fija o la del paciente. Cambiar un tipo no modifica los cobros ya hechos.
      </p>
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {tipos.map((t) =>
        abierto === t.id ? (
          <FormularioTipo
            key={t.id}
            accion={actualizar.bind(null, t.id)}
            valores={t}
            colorInicial={colorDeTipo(t.color)}
            tarifas={tarifas}
            textoBoton="Guardar cambios"
            alCancelar={() => setAbierto(null)}
            alGuardar={() => {
              setAbierto(null);
              setAviso("Guardado ✓");
            }}
          />
        ) : (
          <FilaTipo key={t.id} tipo={t} tarifas={tarifas} alEditar={() => abrir(t.id)} cambiarActivo={cambiarActivo} alAvisar={setAviso} />
        ),
      )}

      {abierto === "nuevo" ? (
        <FormularioTipo
          accion={crear}
          colorInicial={colorSugerido(tipos.map((t) => t.color))}
          tarifas={tarifas}
          textoBoton="Agregar tipo de turno"
          alCancelar={() => setAbierto(null)}
          alGuardar={() => {
            setAbierto(null);
            setAviso("Tipo de turno agregado ✓");
          }}
        />
      ) : (
        abierto === null && (
          <Button size="touch" variant="outline" onClick={() => abrir("nuevo")}>
            <Plus /> Agregar tipo de turno
          </Button>
        )
      )}
    </div>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{children}</span>;
}

function FilaTipo({
  tipo,
  tarifas,
  alEditar,
  cambiarActivo,
  alAvisar,
}: {
  tipo: TipoTurno;
  tarifas: Tarifa[];
  alEditar: () => void;
  cambiarActivo: (id: string, activo: boolean) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();
  const tarifa = tarifas.find((t) => t.id === tipo.tarifa_id);
  const textoTarifa = tipo.tarifa_id === null ? "Tarifa del paciente" : tarifa ? `${tarifa.nombre} · ${formatoGs(tarifa.monto_gs)}` : "Tarifa fija";

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", !tipo.activo && "bg-muted/50 text-muted-foreground")}>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 font-medium">
          <span
            className={cn("size-4 shrink-0 rounded-full", CLASES_COLOR[colorDeTipo(tipo.color)].muestra)}
            aria-label={`Color ${NOMBRE_COLOR[colorDeTipo(tipo.color)]}`}
          />
          {tipo.nombre}
        </span>
        <span className="text-sm text-muted-foreground">
          {nombreModalidad(tipo.modalidad)} · {tipo.genera_cobro ? textoTarifa : "Sin cobro"}
        </span>
        <div className="flex flex-wrap gap-1">
          {tipo.cupo > 1 && <Etiqueta>{nombreCupo(tipo.cupo)}</Etiqueta>}
          {tipo.cobra_en_el_momento && <Etiqueta>Cobra en el momento</Etiqueta>}
          {!tipo.requiere_paciente && <Etiqueta>Sin paciente</Etiqueta>}
          {!tipo.activo && <Etiqueta>Desactivado</Etiqueta>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={alEditar} disabled={ocupado}>
          <Pencil /> Editar
        </Button>
        <Button
          variant="ghost"
          disabled={ocupado}
          onClick={() => {
            if (tipo.activo && !window.confirm(`¿Desactivar ${tipo.nombre}?\nNo se va a poder elegir para turnos nuevos. Los turnos ya hechos no cambian.`)) return;
            iniciar(async () => {
              const r = await cambiarActivo(tipo.id, !tipo.activo);
              alAvisar(r.error ?? (tipo.activo ? `${tipo.nombre} desactivado.` : `${tipo.nombre} activado ✓`));
            });
          }}
        >
          {tipo.activo ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}

function Casilla({
  prefijo,
  nombre,
  texto,
  ayuda,
  marcada,
  error,
}: {
  prefijo: string;
  nombre: string;
  texto: string;
  ayuda: string;
  marcada: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${prefijo}-${nombre}`} className="flex min-h-11 items-center gap-3">
        <input id={`${prefijo}-${nombre}`} type="checkbox" name={nombre} className="size-5" defaultChecked={marcada} aria-invalid={!!error} />
        <span className="flex flex-col">
          <span>{texto}</span>
          <span className="text-xs text-muted-foreground">{ayuda}</span>
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function FormularioTipo({
  accion,
  valores,
  colorInicial,
  tarifas,
  textoBoton,
  alCancelar,
  alGuardar,
}: {
  accion: AccionForm;
  valores?: TipoTurno;
  /** El del tipo, o uno sugerido que no use otro tipo. */
  colorInicial: string;
  tarifas: Tarifa[];
  textoBoton: string;
  alCancelar: () => void;
  alGuardar: () => void;
}) {
  async function enviarYCerrar(anterior: EstadoFormularioConfig, formulario: FormData) {
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) alGuardar();
    return resultado;
  }
  const [estado, enviar, enviando] = useActionState(enviarYCerrar, { errores: {}, guardadoEn: null } as EstadoFormularioConfig);
  const e = estado.errores;
  const enviado = estado.enviado;
  const prefijo = valores?.id ?? "nuevo";
  // Las desactivadas no se ofrecen, salvo la que ya tiene este tipo.
  const opciones = tarifas.filter((t) => t.activa || t.id === valores?.tarifa_id);
  // Si hubo un error, se muestra lo que se envió (un checkbox sin marcar no viaja en el formulario).
  const marcada = (campo: "cobra_en_el_momento" | "genera_cobro" | "requiere_paciente", porDefecto: boolean) =>
    enviado ? enviado[campo] === "on" : (valores?.[campo] ?? porDefecto);

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-nombre`}>Nombre</Label>
        <Input
          id={`${prefijo}-nombre`}
          name="nombre"
          defaultValue={enviado?.nombre ?? valores?.nombre ?? ""}
          autoComplete="off"
          aria-invalid={!!e.nombre}
        />
        {e.nombre && <p className="text-sm text-destructive">{e.nombre}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-modalidad`}>Dónde se hace</Label>
        <Select
          id={`${prefijo}-modalidad`}
          name="modalidad"
          defaultValue={enviado?.modalidad ?? valores?.modalidad ?? "consultorio"}
          aria-invalid={!!e.modalidad}
        >
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {NOMBRE_MODALIDAD[m]}
            </option>
          ))}
        </Select>
        {e.modalidad && <p className="text-sm text-destructive">{e.modalidad}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-cupo`}>Chicos por sesión</Label>
        <Select id={`${prefijo}-cupo`} name="cupo" defaultValue={enviado?.cupo ?? String(valores?.cupo ?? 1)} aria-invalid={!!e.cupo}>
          {CUPOS.map((c) => (
            <option key={c} value={c}>
              {c} · {nombreCupo(c)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Doble o grupal: al reservar elegís entre 2 y ese número de chicos. Cada familia paga una sesión entera.
        </p>
        {e.cupo && <p className="text-sm text-destructive">{e.cupo}</p>}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Color en la agenda</legend>
        <div className="grid grid-cols-4 gap-2" aria-invalid={!!e.color}>
          {COLORES_TIPO.map((c) => (
            <label
              key={c}
              className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-xs has-[:checked]:border-foreground has-[:checked]:ring-2 has-[:checked]:ring-ring/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input type="radio" name="color" value={c} defaultChecked={(enviado?.color ?? colorInicial) === c} className="sr-only" />
              <span className={cn("size-5 shrink-0 rounded-full", CLASES_COLOR[c].muestra)} />
              <span>{NOMBRE_COLOR[c]}</span>
            </label>
          ))}
        </div>
        {e.color && <p className="text-sm text-destructive">{e.color}</p>}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-tarifa`}>Tarifa</Label>
        <Select
          id={`${prefijo}-tarifa`}
          name="tarifa_id"
          defaultValue={enviado?.tarifa_id ?? valores?.tarifa_id ?? ""}
          aria-invalid={!!e.tarifa_id}
        >
          <option value="">La del paciente</option>
          {opciones.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} · {formatoGs(t.monto_gs)}
              {!t.activa && " (desactivada)"}
            </option>
          ))}
        </Select>
        {e.tarifa_id && <p className="text-sm text-destructive">{e.tarifa_id}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Casilla
          prefijo={prefijo}
          nombre="requiere_paciente"
          texto="Lleva paciente"
          ayuda="Desmarcalo para cosas como una reunión de equipo."
          marcada={marcada("requiere_paciente", true)}
          error={e.requiere_paciente}
        />
        <Casilla
          prefijo={prefijo}
          nombre="genera_cobro"
          texto="Genera cobro"
          ayuda="Crea un cargo en la cuenta del paciente."
          marcada={marcada("genera_cobro", true)}
          error={e.genera_cobro}
        />
        <Casilla
          prefijo={prefijo}
          nombre="cobra_en_el_momento"
          texto="Cobra en el momento"
          ayuda="Se paga ese mismo día (ej. entrevista y anamnesis)."
          marcada={marcada("cobra_en_el_momento", false)}
          error={e.cobra_en_el_momento}
        />
      </div>
      {e.general && (
        <p role="alert" className="text-sm text-destructive">
          {e.general}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Guardando…" : textoBoton}
      </Button>
      <Button type="button" variant="ghost" onClick={alCancelar} disabled={enviando}>
        Cancelar
      </Button>
    </form>
  );
}
