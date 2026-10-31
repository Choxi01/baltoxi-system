import { describe, expect, it } from "vitest";
import {
  actualizarRecordatorio,
  CLAVES,
  PLANTILLAS_POR_DEFECTO,
  nombrePila,
  rellenar,
  textoCuando,
  textoDiaMensaje,
  textoHoras,
  tieneMananaViejo,
  unirNombres,
  variablesDesconocidas,
  vistaPrevia,
} from "./plantillas";

describe("rellenar", () => {
  it("reemplaza las variables", () => {
    expect(rellenar("Hola {tutor}, la sesión de {paciente} es el {dia} a las {hora}.", {
      tutor: "Laura",
      paciente: "Tomi",
      dia: "martes 4/11",
      hora: "15:00",
    })).toBe("Hola Laura, la sesión de Tomi es el martes 4/11 a las 15:00.");
  });

  it("una variable repetida se reemplaza todas las veces", () => {
    expect(rellenar("{tutor} {tutor}", { tutor: "Ana" })).toBe("Ana Ana");
  });

  it("las que no vienen quedan como están", () => {
    expect(rellenar("Hola {tutor} {otra}", { tutor: "Ana" })).toBe("Hola Ana {otra}");
  });

  it("sin datos de pago no deja '. .'", () => {
    expect(rellenar(PLANTILLAS_POR_DEFECTO.monto_periodo, {
      tutor: "Laura",
      periodo: "octubre",
      total: "Gs. 580.000",
      datos_pago: "",
    })).toBe("Hola Laura, ¿cómo estás? Te paso el monto de las sesiones de octubre: Gs. 580.000. ¡Gracias!");
  });

  it("con datos de pago queda igual", () => {
    expect(rellenar(PLANTILLAS_POR_DEFECTO.monto_periodo, {
      tutor: "Laura",
      periodo: "octubre",
      total: "Gs. 580.000",
      datos_pago: "Alias 0000000",
    })).toBe("Hola Laura, ¿cómo estás? Te paso el monto de las sesiones de octubre: Gs. 580.000. Alias 0000000. ¡Gracias!");
  });

  it("respeta los saltos de línea", () => {
    expect(rellenar("Horarios {rango}:\n{libres}", { rango: "hoy", libres: "• 9:00\n• 9:45" })).toBe("Horarios hoy:\n• 9:00\n• 9:45");
  });
});

describe("variablesDesconocidas", () => {
  it("encuentra variables mal escritas", () => {
    expect(variablesDesconocidas("Hola {tutor}, {pacinte} {pacinte}", "recordatorio_sesion")).toEqual(["pacinte"]);
  });

  it("una variable que no corresponde a esa plantilla", () => {
    expect(variablesDesconocidas("{libres}", "recordatorio_sesion")).toEqual(["libres"]);
    expect(variablesDesconocidas("{libres} {rango}", "horarios_libres")).toEqual([]);
  });

  it("los textos por defecto no tienen variables desconocidas", () => {
    for (const clave of CLAVES) expect(variablesDesconocidas(PLANTILLAS_POR_DEFECTO[clave], clave)).toEqual([]);
  });
});

describe("recordatorio: «mañana {dia}» → {cuando}", () => {
  const viejo = "Hola {tutor}, te recuerdo la sesión de {paciente} mañana {dia} a las {hora}. ¡Nos vemos!";

  it("detecta y reemplaza el texto viejo", () => {
    expect(tieneMananaViejo(viejo)).toBe(true);
    expect(tieneMananaViejo(PLANTILLAS_POR_DEFECTO.recordatorio_sesion)).toBe(false);
    expect(actualizarRecordatorio(viejo)).toBe(PLANTILLAS_POR_DEFECTO.recordatorio_sesion);
  });

  it("también con mayúscula o sin ñ", () => {
    expect(actualizarRecordatorio("Mañana {dia}")).toBe("{cuando}");
    expect(actualizarRecordatorio("manana  {dia}")).toBe("{cuando}");
  });

  it("no toca otros textos", () => {
    expect(actualizarRecordatorio("Nos vemos mañana. {dia}")).toBe("Nos vemos mañana. {dia}");
  });
});

describe("formatos", () => {
  it("nombre de pila", () => {
    expect(nombrePila("María José")).toBe("María");
    expect(nombrePila("  Tomi ")).toBe("Tomi");
  });

  it("une nombres con 'y'", () => {
    expect(unirNombres(["Tomi"])).toBe("Tomi");
    expect(unirNombres(["Tomi", "Sofi"])).toBe("Tomi y Sofi");
    expect(unirNombres(["Tomi", "Sofi", "Juli"])).toBe("Tomi, Sofi y Juli");
    expect(unirNombres(["Tomi", "Tomi"])).toBe("Tomi");
    expect(unirNombres([])).toBe("");
  });

  it("día del mensaje", () => {
    expect(textoDiaMensaje("2026-11-03")).toBe("martes 3/11");
    expect(textoDiaMensaje("2026-11-02")).toBe("lunes 2/11");
  });

  it("cuándo: mañana o el día", () => {
    expect(textoCuando("2026-11-03", "2026-11-02")).toBe("mañana");
    // Viernes 30/10 → lunes 2/11
    expect(textoCuando("2026-11-02", "2026-10-30")).toBe("el lunes 2/11");
  });

  it("horas ordenadas", () => {
    expect(textoHoras(["15:45", "09:00", "15:45"])).toBe("9:00 y 15:45");
    expect(textoHoras(["15:00"])).toBe("15:00");
  });
});

describe("vistaPrevia", () => {
  it("usa los datos de ejemplo", () => {
    expect(vistaPrevia(PLANTILLAS_POR_DEFECTO.cambio_turno, "cambio_turno")).toBe(
      "Hola Laura, te confirmo el cambio: la sesión de Tomi pasa al martes 4/11 a las 15:00.",
    );
  });
});
