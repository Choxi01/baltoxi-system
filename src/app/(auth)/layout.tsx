// Pantallas de ingreso: una tarjeta centrada, cómoda en iPhone.
export default function LayoutIngreso({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-[max(3rem,env(safe-area-inset-top))] sm:items-center">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
