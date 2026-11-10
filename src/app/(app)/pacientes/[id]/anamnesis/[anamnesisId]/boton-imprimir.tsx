"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BotonImprimir() {
  return (
    <Button type="button" className="h-12 print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" /> Imprimir
    </Button>
  );
}
