import { describe, expect, it } from "vitest";
import { clasificarCancelacion, datosCancelacion, pendientesDeReponer } from "./cancelacion";

// Casos 2 a 5 de docs/reglas-cobro.md (aviso mínimo 48 h).
const INICIO = new Date("2026-11-05T12:00:00Z");
const horasAntes = (h: number) => new Date(INICIO.getTime() - h * 3_600_000);
const clasificar = (avisoEn: Date) => clasificarCancelacion({ inicio: INICIO, avisoEn, horasAvisoMinimas: 48 });

describe("clasificarCancelacion", () => {
  it("caso 2: 72 h antes → con aviso", () => expect(clasificar(horasAntes(72))).toBe("ausente_con_aviso"));
  it("caso 3: exactamente 48 h antes → con aviso", () => expect(clasificar(horasAntes(48))).toBe("ausente_con_aviso"));
  it("caso 4: 47 h antes → aviso tardío", () => expect(clasificar(horasAntes(47))).toBe("aviso_tardio"));
  it("caso 5: el mismo día, después de la hora → aviso tardío", () => expect(clasificar(horasAntes(-2))).toBe("aviso_tardio"));
  it("usa las horas mínimas del consultorio", () => {
    expect(clasificarCancelacion({ inicio: INICIO, avisoEn: horasAntes(30), horasAvisoMinimas: 24 })).toBe("ausente_con_aviso");
  });
});

describe("datosCancelacion", () => {
  it("cancela la profesional: queda para reponer, sin aviso", () => {
    expect(datosCancelacion("profesional", { inicio: INICIO }, horasAntes(1), 48)).toEqual({
      estado: "cancelado_profesional",
      aviso_en: null,
      reponer: true,
    });
  });

  it("cancela la familia: guarda cuándo avisó y lo clasifica", () => {
    expect(datosCancelacion("familia", { inicio: INICIO }, horasAntes(72), 48)).toEqual({
      estado: "ausente_con_aviso",
      aviso_en: "2026-11-02T12:00:00.000Z",
      reponer: false,
    });
    expect(datosCancelacion("familia", { inicio: INICIO }, horasAntes(10), 48).estado).toBe("aviso_tardio");
  });
});

describe("pendientesDeReponer", () => {
  const cancelado = (id: string) => ({ id, reponer: true, estado: "cancelado_profesional" });

  it("los cancelados por la profesional sin reposición", () => {
    expect(pendientesDeReponer([cancelado("a"), cancelado("b")], [{ repone_a: "a", estado: "agendado" }]).map((t) => t.id)).toEqual(["b"]);
  });

  it("si la reposición también se canceló, vuelve a la lista", () => {
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "ausente_con_aviso" }])).toHaveLength(1);
  });

  it("una reposición que ya pasó (vino o no vino) cuenta como repuesta", () => {
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "presente" }])).toEqual([]);
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "ausente_sin_aviso" }])).toEqual([]);
  });

  it("ignora los que no son para reponer", () => {
    expect(pendientesDeReponer([{ id: "x", reponer: false, estado: "cancelado_profesional" }], [])).toEqual([]);
  });
});
