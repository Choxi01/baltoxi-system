"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { EstadoFormularioPaciente } from "@/lib/pacientes/acciones";
import { FormularioPaciente, type ValoresPaciente } from "../formulario-paciente";

type Accion = (anterior: EstadoFormularioPaciente, formulario: FormData) => Promise<EstadoFormularioPaciente>;

export type FilaResumen = { etiqueta: string; valor: string | null; clinico?: boolean };

// Pestaña Datos: primero un resumen para leer; con "Editar" se abre el formulario.
export function FichaDatos({
  resumen,
  accion,
  valores,
  tarifas,
  tutores,
  hoy,
}: {
  resumen: FilaResumen[];
  accion: Accion;
  valores: ValoresPaciente;
  tarifas: { id: string; nombre: string; monto_gs: number }[];
  tutores: { id: string; nombre: string; apellido: string | null }[];
  hoy: string;
}) {
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Envuelve la acción: si se guardó bien, vuelve al resumen.
  async function guardar(anterior: EstadoFormularioPaciente, formulario: FormData) {
    const resultado = await accion(anterior, formulario);
    if (resultado.guardadoEn) {
      setEditando(false);
      setGuardado(true);
    }
    return resultado;
  }

  if (editando) {
    return (
      <FormularioPaciente
        accion={guardar}
        valores={valores}
        tarifas={tarifas}
        tutores={tutores}
        hoy={hoy}
        textoBoton="Guardar cambios"
        alCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        size="touch"
        variant="outline"
        onClick={() => {
          setGuardado(false);
          setEditando(true);
        }}
      >
        <Pencil /> Editar
      </Button>
      {guardado && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Guardado ✓
        </p>
      )}
      <dl className="divide-y rounded-lg border">
        {resumen.map((fila) => (
          <div key={fila.etiqueta} className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-xs text-muted-foreground">
              {fila.etiqueta}
              {fila.clinico && " · dato clínico"}
            </dt>
            <dd className={fila.valor ? "whitespace-pre-line" : "text-muted-foreground"}>{fila.valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
