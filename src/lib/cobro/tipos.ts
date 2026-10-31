// Tipos del motor de cobro (docs/reglas-cobro.md). Solo los campos que usa el motor,
// con los nombres de la migración. Montos siempre enteros en guaraníes.

export type EstadoTurno =
  | "agendado"
  | "presente"
  | "ausente_con_aviso"
  | "aviso_tardio"
  | "ausente_sin_aviso"
  | "cancelado_profesional"
  | "reprogramado";

/** Estados que tienen regla de cobro (todos menos 'agendado'). */
export type EstadoConRegla = Exclude<EstadoTurno, "agendado">;

export type OrigenRegla = "manual" | "paciente" | "consultorio";

export type PlanCobro = "por_sesion" | "semanal" | "mensual";

export type Tarifa = { id: string; nombre: string; monto_gs: number };

export type TipoTurno = {
  tarifa_id: string | null;
  genera_cobro: boolean;
  cobra_en_el_momento: boolean;
  requiere_paciente?: boolean;
  modalidad?: "consultorio" | "domicilio" | "online" | "colegio";
};

export type Paciente = {
  id: string;
  tarifa_id: string | null;
  monto_override_gs: number | null;
  responsable_pago_id: string | null;
  plan_cobro?: PlanCobro;
};

export type Turno = {
  clase: "turno" | "reservado" | "ocupado";
  estado: EstadoTurno;
  inicio: Date | string;
  porcentaje_manual: number | null;
  motivo_excepcion?: string | null;
};

/** Regla de cobro: con `paciente_id` es excepción del paciente; sin él, del consultorio. */
export type ReglaCobro = { estado: EstadoConRegla; porcentaje: number; paciente_id: string | null };

export type SnapshotCargo = {
  tarifa: string;
  monto_base: number;
  estado: EstadoConRegla;
  porcentaje: number;
  origen_regla: OrigenRegla;
};

/** Cargo para saldos e imputación. `fecha` = "AAAA-MM-DD". */
export type Cargo = { id: string; tutor_id: string; fecha: string; monto_gs: number };

export type MedioPago = "efectivo" | "transferencia" | "qr" | "tarjeta" | "otro";

export type Pago = {
  id: string;
  tutor_id: string;
  fecha: string;
  monto_gs: number;
  medio: MedioPago;
  factura_id: string | null;
};
