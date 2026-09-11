import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Radar } from "./api";
import { RadarPanel } from "./components/RadarPanel";

function ficha(codigo = "101"): Radar {
  return {
    canton: {
      codigo,
      nombre: codigo === "101" ? "San José" : "Alajuela",
      provincia: codigo === "101" ? "San José" : "Alajuela",
    },
    periodo: { desde: "2026-03-01", hasta: "2026-08-31", mesesCompletos: 6 },
    seguridad: {
      incidentes: 50,
      mesAnterior: 20,
      ultimoMesCompleto: 30,
      mesesComparados: ["2026-07", "2026-08"],
      variacionMensualPorcentaje: 50,
      explicacionVariacion: "Dos meses completos.",
      incidentesPorMilElectores: 5,
      coberturaSuficiente: true,
      topDelitos: [],
    },
    electorado: {
      fechaCorte: "2026-08-31",
      electores: 10000,
      porcentajeNacional: 1,
      distritosPrincipales: [],
    },
    contratacion: {
      ordenes: 30,
      instituciones: 2,
      proveedores: 3,
      coberturaGeografica: 40,
      coberturaSuficiente: false,
      montosPorMoneda: [
        {
          moneda: "CRC",
          monto: 100,
          ordenes: 20,
          ordenesConMonto: 20,
          principal: 50,
          topCinco: 100,
        },
        {
          moneda: "USD",
          monto: 500,
          ordenes: 10,
          ordenesConMonto: 10,
          principal: 100,
          topCinco: 100,
        },
      ],
    },
    comparacion: {
      cantonesComparables: 6,
      medianaIncidentesPorMilElectores: 3,
      posicionRelativaIncidentes: 80,
      medianasSicopPorMoneda: [],
    },
    contextoNacional: {
      pronae: {
        anioMasReciente: null,
        totalBeneficiarios: null,
        modalidadPrincipal: null,
        evolucion: [],
      },
    },
    senales: [
      {
        codigo: "cobertura-sicop",
        titulo: "Cobertura SICOP insuficiente",
        nivel: "informativa",
        descripcion: "Faltan órdenes por localizar.",
        evidencia: [{ etiqueta: "Cobertura (%)", valor: "40" }],
        metodologia: "Mínimo 80% de órdenes geolocalizadas.",
        fuentes: ["SICOP"],
        limitaciones: ["Sede institucional."],
        preguntaSugerida: "¿Qué instituciones faltan por localizar?",
      },
    ],
    metadatos: {
      fuentes: [],
      advertencias: [
        "Correlación o coincidencia temporal no implica causalidad.",
      ],
    },
  };
}
const response = (data: unknown) =>
  Promise.resolve({ ok: true, json: async () => data });
let radarRequest: (url: string) => Promise<unknown>;
beforeEach(() => {
  radarRequest = (url) => response(ficha(url.includes("/201") ? "201" : "101"));
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.startsWith("/api/radar/")) return radarRequest(url);
      if (url === "/api/cantones")
        return response([ficha().canton, ficha("201").canton]);
      if (
        url.includes("/tse/") &&
        !url.endsWith("historico") &&
        !url.endsWith("distritos")
      )
        return response({ fechaCorte: null, total: 0, porcentajeNacional: 0 });
      if (url.includes("/pronae/resumen"))
        return response({
          totalUltimoAnio: null,
          anioMasReciente: null,
          anioConMayorTotal: null,
          modalidadPrincipalUltimoAnio: null,
        });
      return response([]);
    }),
  );
});
async function seleccionar(codigo = "101") {
  const select = screen.getByRole("combobox", { name: "Cantón" });
  await waitFor(() => expect(select).toBeEnabled());
  await userEvent.selectOptions(select, codigo);
}
describe("Radar como experiencia principal", () => {
  it("presenta el propósito, estado inicial y contexto nacional", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Radar cantonal de señales públicas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Seleccioná un cantón para reunir su ficha integrada."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Contexto nacional de empleo y apoyo social",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No está desagregado por cantón/),
    ).toBeInTheDocument();
    await screen.findByText("Sin datos nacionales PRONAE disponibles");
  });
  it("renderiza resumen y separa monedas sin presentarlas como colones mixtos", async () => {
    render(<App />);
    await seleccionar();
    expect(
      await screen.findByRole("heading", { name: "San José · San José" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CRC 100 · USD 500")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Razón de incidentes por cada 1.000 electores",
      }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tasa de criminalidad/i);
    expect(document.body.textContent).not.toContain("₡600");
  });
  it("cambia de cantón y limpia la ficha anterior mientras carga", async () => {
    render(<App />);
    await seleccionar();
    await screen.findByRole("heading", { name: "San José · San José" });
    await seleccionar("201");
    expect(
      await screen.findByRole("heading", { name: "Alajuela · Alajuela" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "San José · San José" }),
    ).not.toBeInTheDocument();
  });
  it("aplica fechas y vuelve al preset", async () => {
    render(<App />);
    await seleccionar();
    await screen.findByText("CRC 100 · USD 500");
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-08-31" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar período" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/radar/canton/101?desde=2026-07-01&hasta=2026-08-31",
      ),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Últimos seis meses completos disponibles",
      }),
    );
    expect(screen.getByLabelText("Desde")).toHaveValue("");
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/^\/api\//)),
    );
  });
  it("expone evidencia, metodología y pregunta de una señal", async () => {
    render(<App />);
    await seleccionar();
    await screen.findByText("Cobertura SICOP insuficiente");
    await userEvent.click(screen.getByText("¿Cómo se calculó?"));
    expect(
      screen.getByText("Mínimo 80% de órdenes geolocalizadas."),
    ).toBeVisible();
    expect(screen.getByText("Cobertura (%)")).toBeVisible();
    expect(
      screen.getByText("¿Qué instituciones faltan por localizar?"),
    ).toBeInTheDocument();
  });
  it("muestra loading y descarta una respuesta atrasada", async () => {
    let resolve!: (r: unknown) => void;
    radarRequest = (url) =>
      url.includes("/101")
        ? new Promise((r) => {
            resolve = r;
          })
        : response(ficha("201"));
    render(<App />);
    await seleccionar();
    expect(screen.getByText("Cargando ficha del cantón…")).toHaveAttribute(
      "role",
      "status",
    );
    await seleccionar("201");
    await screen.findByRole("heading", { name: "Alajuela · Alajuela" });
    resolve({ ok: true, json: async () => ficha("101") });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "San José · San José" }),
      ).not.toBeInTheDocument(),
    );
  });
  it("permite reintentar un error", async () => {
    radarRequest = () => Promise.reject(new Error("offline"));
    render(<App />);
    await seleccionar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar el radar",
    );
    radarRequest = () => response(ficha());
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("CRC 100 · USD 500")).toBeInTheDocument();
  });
  it("no muestra posiciones ni ceros inventados cuando falta cobertura", () => {
    const data = ficha();
    data.seguridad.incidentes = null;
    data.seguridad.incidentesPorMilElectores = null;
    data.comparacion.medianaIncidentesPorMilElectores = null;
    data.senales = [];
    data.contratacion.montosPorMoneda = [];
    render(<RadarPanel data={data} />);
    expect(
      screen.getByText(
        "Cobertura insuficiente para presentar una posición relativa.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/No se activaron señales/)).toBeInTheDocument();
    expect(screen.getAllByText("No disponible").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Percentil empírico/)).not.toBeInTheDocument();
  });
  it("conserva selección desde el detalle TSE", async () => {
    render(<App />);
    await seleccionar();
    await screen.findByText("CRC 100 · USD 500");
    await userEvent.click(screen.getByText("Electorado · detalle TSE"));
    const selector = screen.getByRole("combobox", {
      name: "Cantón del padrón electoral",
    });
    await waitFor(() => expect(selector).toBeEnabled());
    await userEvent.selectOptions(selector, "201");
    expect(screen.getByRole("combobox", { name: "Cantón" })).toHaveValue("201");
    expect(
      await screen.findByRole("heading", { name: "Alajuela · Alajuela" }),
    ).toBeInTheDocument();
  });
  it("informa PRONAE vacío sin fingir que sigue cargando", async () => {
    render(<App />);
    expect(
      await screen.findByText("Sin datos nacionales PRONAE disponibles"),
    ).toBeInTheDocument();
  });
});
