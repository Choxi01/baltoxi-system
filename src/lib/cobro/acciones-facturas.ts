"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarParaFacturar } from "./datos-facturar";
import { mesValido, validarNumeroFactura } from "./facturar";

// Marcar facturado y deshacer (B7, docs/reglas-cobro.md sección 7).

export type ResultadoFactura = { ok: true } | { ok: false; error: string };

const CAMBIARON = "Los pagos de esta familia cambiaron. Revisá el monto y probá de nuevo.";
const UNICO_VIOLADO = "23505"; // código de Postgres: el número de factura ya existe

function revalidar() {
  revalidatePath("/facturar");
  revalidatePath("/cobros", "layout"); // la cuenta del tutor muestra "Facturado"
}

/**
 * Crea la factura y vincula los pagos. La fila se vuelve a calcular acá: del navegador solo se
 * usa a quién, de qué mes y el número. `montoVisto` es lo que Daniela tenía en pantalla: si entró
 * otro pago mientras tanto, no se guarda una factura por un monto distinto al que escribió.
 */
export async function marcarFacturado(entrada: {
  tutorId: string;
  mes: string;
  numero: string;
  montoVisto: number;
}): Promise<ResultadoFactura> {
  const hoy = hoyEnAsuncion();
  const mes = mesValido(entrada.mes, hoy);
  if (!mes || !esIdValido(entrada.tutorId)) return { ok: false, error: "No se encontró esa fila." };
  const numero = validarNumeroFactura(entrada.numero);
  if (!numero.ok) return numero;

  const { filas } = await listarParaFacturar(mes); // exige la sesión y el consultorio
  const fila = filas.find((f) => f.tutor_id === entrada.tutorId);
  if (!fila || fila.monto !== entrada.montoVisto) return { ok: false, error: CAMBIARON };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("crear_factura", {
    p_tutor: fila.tutor_id,
    p_mes: mes,
    p_numero: numero.numero,
    p_concepto: fila.concepto,
    p_emitida_en: hoy,
    p_pagos: fila.pago_ids,
  });
  if (error?.code === UNICO_VIOLADO) return { ok: false, error: "Ese número de factura ya está cargado." };
  if (error?.message.includes("Los pagos cambiaron")) return { ok: false, error: CAMBIARON };
  if (error) return { ok: false, error: "No se pudo guardar la factura. Probá de nuevo." };
  revalidar();
  return { ok: true };
}

/** Saca la factura de la app. La base deja sus pagos sin factura en la misma operación. No la anula en Marangatu. */
export async function deshacerFactura(id: string): Promise<ResultadoFactura> {
  if (!esIdValido(id)) return { ok: false, error: "Factura no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("facturas").delete().eq("consultorio_id", consultorio.id).eq("id", id).select("id");
  if (error) return { ok: false, error: "No se pudo deshacer. Probá de nuevo." };
  if (!data || data.length === 0) return { ok: false, error: "Factura no encontrada." };
  revalidar();
  return { ok: true };
}
