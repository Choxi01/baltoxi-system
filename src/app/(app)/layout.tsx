import { Suspense } from "react";

import { Menu, MenuConRuta } from "@/components/app/menu";
import { exigirConsultorio } from "@/lib/auth/servidor";

// Todas las secciones internas. El proxy ya exige contraseña + código, pero
// acá se vuelve a verificar en el servidor y se exige tener consultorio.
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Suspense fallback={<Menu />}>
        <MenuConRuta />
      </Suspense>
      <main className="flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] md:px-8 md:pb-8">
        <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
          <Verificar>{children}</Verificar>
        </Suspense>
      </main>
    </div>
  );
}

async function Verificar({ children }: { children: React.ReactNode }) {
  await exigirConsultorio();
  return children;
}
