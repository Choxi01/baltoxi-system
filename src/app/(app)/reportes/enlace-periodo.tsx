"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Flecha de mes o de semana: cambia un solo parámetro y deja los demás (la pestaña elegida, el otro período).
export function EnlacePeriodo({
  parametro,
  valor,
  etiqueta,
  children,
}: {
  parametro: "mes" | "semana";
  valor: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  const parametros = new URLSearchParams(useSearchParams());
  parametros.set(parametro, valor);
  return (
    <Link
      href={`/reportes?${parametros}`}
      aria-label={etiqueta}
      scroll={false}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border active:bg-accent"
    >
      {children}
    </Link>
  );
}
