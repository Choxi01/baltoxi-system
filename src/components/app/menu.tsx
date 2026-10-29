"use client";

import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  FileText,
  Menu as IconoMas,
  MessageCircle,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECCIONES, seccionActiva } from "@/lib/navegacion";
import { BotonSalir } from "./boton-salir";
import { cn } from "@/lib/utils";

const ICONOS: Record<string, LucideIcon> = {
  "/hoy": CalendarCheck,
  "/agenda": CalendarDays,
  "/pacientes": Users,
  "/cobros": Wallet,
  "/mensajes": MessageCircle,
  "/facturar": FileText,
  "/reportes": BarChart3,
  "/config": Settings,
};

// Lee la ruta actual para marcar la sección activa. Next.js pide que esto
// vaya dentro de <Suspense> (ver el layout de (app)).
export function MenuConRuta() {
  return <Menu ruta={usePathname()} />;
}

// iPhone: barra fija abajo con 4 secciones + "Más".
// iPad y Mac (pantallas medianas en adelante): menú lateral con todo.
// Sin `ruta` (mientras carga) se muestra sin ninguna sección marcada.
export function Menu({ ruta = "" }: { ruta?: string }) {

  return (
    <>
      <nav
        aria-label="Menú"
        className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {SECCIONES.filter((s) => s.principal).map((s) => (
            <li key={s.href}>
              <ItemBarra href={s.href} titulo={s.titulo} icono={ICONOS[s.href]} activo={seccionActiva(ruta, s.href)} />
            </li>
          ))}
          <li>
            <ItemBarra
              href="/mas"
              titulo="Más"
              icono={IconoMas}
              activo={
                seccionActiva(ruta, "/mas") ||
                SECCIONES.some((s) => !s.principal && seccionActiva(ruta, s.href))
              }
            />
          </li>
        </ul>
      </nav>

      <nav aria-label="Menú" className="hidden w-60 shrink-0 flex-col border-r p-3 md:flex">
        <ul className="flex flex-1 flex-col gap-1">
          {SECCIONES.map((s) => {
            const Icono = ICONOS[s.href];
            const activo = seccionActiva(ruta, s.href);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium active:opacity-70",
                    activo ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  <Icono className="size-5" />
                  {s.titulo}
                </Link>
              </li>
            );
          })}
        </ul>
        <BotonSalir className="h-11 w-full rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent/60" />
      </nav>
    </>
  );
}

function ItemBarra({
  href,
  titulo,
  icono: Icono,
  activo,
}: {
  href: string;
  titulo: string;
  icono: LucideIcon;
  activo: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium active:opacity-60",
        activo ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icono className="size-6" />
      {titulo}
    </Link>
  );
}
