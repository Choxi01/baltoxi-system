"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoFormularioConfig } from "@/lib/config/acciones";
import { formatoGs } from "@/lib/cobro/formato";
import { cn } from "@/lib/utils";

type Tarifa = { id: string; nombre: string; monto_gs: number; activa: boolean };
type AccionForm = (anterior: EstadoFormularioConfig, formulario: FormData) => Promise<EstadoFormularioConfig>;

export function TabTarifas({
  tarifas,
  crear,
  actualizar,
  cambiarActiva,
}: {
  tarifas: Tarifa[];
  crear: AccionForm;
  actualizar: (id: string, anterior: EstadoFormularioConfig, formulario: FormData) => Promise<EstadoFormularioConfig>;
  cambiarActiva: (id: string, activa: boolean) => Promise<{ error: string | null }>;
}) {
  // Qué se está editando: una tarifa (por id), "nueva" o nada.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function abrir(id: string) {
    setAviso(null);
    setAbierto(id);
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Montos con IVA incluido. Cambiar un monto no modifica los cobros ya hechos.
      </p>
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {tarifas.map((t) =>
        abierto === t.id ? (
          <FormularioTarifa
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
          <FilaTarifa key={t.id} tarifa={t} alEditar={() => abrir(t.id)} cambiarActiva={cambiarActiva} alAvisar={setAviso} />
        ),
      )}

      {abierto === "nueva" ? (
        <FormularioTarifa
          accion={crear}
          textoBoton="Agregar tarifa"
          alCancelar={() => setAbierto(null)}
          alGuardar={() => {
            setAbierto(null);
            setAviso("Tarifa agregada ✓");
          }}
        />
      ) : (
        abierto === null && (
          <Button size="touch" variant="outline" onClick={() => abrir("nueva")}>
            <Plus /> Agregar tarifa
          </Button>
        )
      )}
    </div>
  );
}

function FilaTarifa({
  tarifa,
  alEditar,
  cambiarActiva,
  alAvisar,
}: {
  tarifa: Tarifa;
  alEditar: () => void;
  cambiarActiva: (id: string, activa: boolean) => Promise<{ error: string | null }>;
  alAvisar: (texto: string | null) => void;
}) {
  const [ocupado, iniciar] = useTransition();

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", !tarifa.activa && "bg-muted/50 text-muted-foreground")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">
          {tarifa.nombre}
          {!tarifa.activa && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Desactivada</span>}
        </span>
        <span className="tabular-nums">{formatoGs(tarifa.monto_gs)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={alEditar} disabled={ocupado}>
          <Pencil /> Editar
        </Button>
        <Button
          variant="ghost"
          disabled={ocupado}
          onClick={() => {
            if (tarifa.activa && !window.confirm(`¿Desactivar ${tarifa.nombre}?\nNo se va a poder elegir para pacientes nuevos. Los que ya la tienen la conservan.`)) return;
            iniciar(async () => {
              const r = await cambiarActiva(tarifa.id, !tarifa.activa);
              alAvisar(r.error ?? (tarifa.activa ? `${tarifa.nombre} desactivada.` : `${tarifa.nombre} activada ✓`));
            });
          }}
        >
          {tarifa.activa ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}

function FormularioTarifa({
  accion,
  valores,
  textoBoton,
  alCancelar,
  alGuardar,
}: {
  accion: AccionForm;
  valores?: Tarifa;
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
  const prefijo = valores?.id ?? "nueva";
  const montoGuardado = valores ? formatoGs(valores.monto_gs).replace("Gs. ", "") : "";

  return (
    <form key={estado.revision ?? 0} action={enviar} className="flex flex-col gap-4 rounded-lg border p-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-nombre`}>Nombre</Label>
        <Input
          id={`${prefijo}-nombre`}
          name="nombre"
          defaultValue={estado.enviado?.nombre ?? valores?.nombre ?? ""}
          autoComplete="off"
          aria-invalid={!!e.nombre}
        />
        {e.nombre && <p className="text-sm text-destructive">{e.nombre}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefijo}-monto`}>Monto (Gs.)</Label>
        <Input
          id={`${prefijo}-monto`}
          name="monto_gs"
          inputMode="numeric"
          placeholder="Ej. 290.000"
          defaultValue={estado.enviado?.monto_gs ?? montoGuardado}
          aria-invalid={!!e.monto_gs}
        />
        {e.monto_gs && <p className="text-sm text-destructive">{e.monto_gs}</p>}
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
