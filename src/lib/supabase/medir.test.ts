import { describe, expect, it } from "vitest";
import { describirPedido } from "./medir";

const BASE = "https://ejemplo.supabase.co";

describe("describirPedido", () => {
  it("muestra solo el método y la tabla, sin filtros", () => {
    expect(describirPedido(`${BASE}/rest/v1/turnos?select=id,inicio&consultorio_id=eq.123`)).toBe("GET turnos");
    expect(describirPedido(`${BASE}/rest/v1/notas?texto=eq.algo%20privado`, "PATCH")).toBe("PATCH notas");
  });

  it("funciones de la base y servicios", () => {
    expect(describirPedido(`${BASE}/rest/v1/rpc/crear_consultorio`, "POST")).toBe("POST rpc/crear_consultorio");
    expect(describirPedido(`${BASE}/auth/v1/.well-known/jwks.json`)).toBe("GET auth/.well-known");
    expect(describirPedido(`${BASE}/auth/v1/token?grant_type=refresh_token`, "POST")).toBe("POST auth/token");
  });

  it("nunca deja pasar la dirección completa", () => {
    const texto = describirPedido(`${BASE}/rest/v1/pacientes?nombre=eq.Inventado`);
    expect(texto).not.toContain("Inventado");
    expect(texto).not.toContain("?");
    expect(describirPedido("no es una url")).toBe("GET ?");
    expect(describirPedido(`${BASE}/algo/raro`)).toBe("GET otro");
  });
});
