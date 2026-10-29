import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Todas las fechas de los tests en la zona del consultorio.
    env: { TZ: "America/Asuncion" },
  },
});
