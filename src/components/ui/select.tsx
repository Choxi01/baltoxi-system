import * as React from "react";

import { cn } from "@/lib/utils";

// Select nativo: en iPhone abre la ruedita del sistema, que es lo más cómodo.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "flex h-12 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
