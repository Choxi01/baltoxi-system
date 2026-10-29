import { describe, expect, it } from "vitest";
import {
  cubre,
  diaCorto,
  diasDeLaSemana,
  diasVisibles,
  fechasEntre,
  finDeMes,
  inicioDeMes,
  lunesDe,
  mover,
  rangoDeVista,
  rangoParaCargar,
  semanasDelMes,
  sumarDias,
  tituloDia,
  tituloMes,
  tituloSemana,
} from "./calendario";

describe("sumar y mover fechas", () => {
  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("inicio y fin de mes", () => {
    expect(inicioDeMes("2026-11-17")).toBe("2026-11-01");
    expect(inicioDeMes("2026-01-17", -1)).toBe("2025-12-01");
    expect(inicioDeMes("2026-12-17", 1)).toBe("2027-01-01");
    expect(finDeMes("2028-02-10")).toBe("2028-02-29");
  });

  it("lunes de la semana (el domingo es del lunes anterior)", () => {
    expect(lunesDe("2026-11-02")).toBe("2026-11-02");
    expect(lunesDe("2026-11-06")).toBe("2026-11-02");
    expect(lunesDe("2026-11-08")).toBe("2026-11-02");
  });

  it("← y → según la vista", () => {
    expect(mover("dia", "2026-11-02", 1)).toBe("2026-11-03");
    expect(mover("semana", "2026-11-02", -1)).toBe("2026-10-26");
    expect(mover("mes", "2026-11-17", 1)).toBe("2026-12-01");
  });

  it("fechas entre dos días", () => {
    expect(fechasEntre("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("días visibles", () => {
  it("lunes a viernes; sábado o domingo solo si tienen horario", () => {
    expect(diasVisibles([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    expect(diasVisibles([1, 6])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(diasVisibles([0])).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it("fechas de la semana visible", () => {
    expect(diasDeLaSemana("2026-11-04", [1, 2, 3, 4, 5])).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06",
    ]);
  });
});

describe("grilla del mes y rangos", () => {
  it("semanas de lunes a domingo que cubren el mes", () => {
    const semanas = semanasDelMes("2026-11-15");
    expect(semanas[0][0]).toBe("2026-10-26");
    expect(semanas.at(-1)![6]).toBe("2026-12-06");
    expect(semanas).toHaveLength(6);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
  });

  it("rango de cada vista", () => {
    expect(rangoDeVista("dia", "2026-11-04")).toEqual({ desde: "2026-11-04", hasta: "2026-11-04" });
    expect(rangoDeVista("semana", "2026-11-04")).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(rangoDeVista("mes", "2026-11-04")).toEqual({ desde: "2026-10-26", hasta: "2026-12-06" });
  });

  it("lo que se carga cubre el mes anterior, el actual y el siguiente", () => {
    const rango = rangoParaCargar("2026-11-04");
    expect(rango).toEqual({ desde: "2026-09-28", hasta: "2027-01-03" });
    expect(cubre(rango, "mes", "2026-10-01")).toBe(true);
    expect(cubre(rango, "mes", "2026-12-31")).toBe(true);
    expect(cubre(rango, "semana", "2026-09-28")).toBe(true);
    expect(cubre(rango, "dia", "2027-01-04")).toBe(false);
    expect(cubre(rango, "mes", "2027-01-01")).toBe(false);
  });
});

describe("títulos", () => {
  it("día, semana y mes", () => {
    expect(tituloDia("2026-11-02")).toBe("Lunes 2 de noviembre");
    expect(tituloSemana(["2026-11-02", "2026-11-06"])).toBe("2 al 6 de noviembre");
    expect(tituloSemana(["2026-11-30", "2026-12-04"])).toBe("30 de noviembre al 4 de diciembre");
    expect(tituloMes("2026-11-02")).toBe("Noviembre 2026");
    expect(diaCorto("2026-11-02")).toBe("lun 2");
  });
});
