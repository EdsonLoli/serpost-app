import { useEffect, useState } from "react";
import {
  getSavedBackendUrl,
  getSavedToken,
  saveBackendToken,
  saveBackendUrl,
} from "./config/backend";
import { ClientesView } from "./views/ClientesView";
import { EnviosView } from "./views/EnviosView";
import { OperacionesView } from "./views/OperacionesView";
import { TarifaView } from "./views/TarifaView";

interface ApiResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
}

interface BackendTestResult {
  name: string;
  description: string;
  passed: boolean;
  status: number | null;
  durationMs: number;
  expected: string;
  response: string;
}

type ActiveTab = "clientes" | "envios" | "tarifa" | "operaciones" | "pruebas";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("clientes");
  const [baseUrl, setBaseUrl] = useState<string>(() => getSavedBackendUrl());
  const [token, setToken] = useState<string>(() => getSavedToken());
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const [testsRunning, setTestsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<BackendTestResult[]>([]);

  useEffect(() => {
    saveBackendUrl(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    saveBackendToken(token);
  }, [token]);

  async function ejecutarPrueba(
    name: string,
    description: string,
    expected: string,
    operation: () => Promise<ApiResponse>,
  ): Promise<BackendTestResult> {
    const startedAt = performance.now();
    try {
      const response = await operation();
      const passed = response.status !== 0 && expected === String(response.status);
      const durationMs = Math.round(performance.now() - startedAt);
      let responseText = "";
      if (typeof response.data === "string") {
        responseText = response.data;
      } else if (response.data !== null && response.data !== undefined) {
        responseText = JSON.stringify(response.data, null, 2);
      } else {
        responseText = response.error || "Sin cuerpo de respuesta";
      }

      return {
        name,
        description,
        passed,
        status: response.status || null,
        durationMs,
        expected,
        response: responseText,
      };
    } catch (caught) {
      return {
        name,
        description,
        passed: false,
        status: null,
        durationMs: Math.round(performance.now() - startedAt),
        expected,
        response: caught instanceof Error ? caught.message : "La prueba produjo un error.",
      };
    }
  }

  async function ejecutarPruebasBackend() {
    setTestsRunning(true);
    setTestResults([]);
    const results: BackendTestResult[] = [];
    const registrar = (item: BackendTestResult) => {
      results.push(item);
      setTestResults([...results]);
    };

    registrar(
      await ejecutarPrueba(
        "Autenticacion requerida",
        "GET a un cliente sin Bearer debe ser rechazado.",
        "401",
        () =>
          window.serpostApi.request({
            baseUrl,
            token: "",
            path: "/clientes/1",
            method: "GET",
          }),
      ),
    );

    const suffix = String(Date.now()).slice(-6);
    const clientePrueba = {
      tipo_documento: "DNI",
      numero_documento: `44${suffix}`,
      nombres: "Ana Perez Prueba",
      direccion: "Calle Principal 123",
      telefono: "912345678",
      correo: `ana.${suffix}@example.com`,
      rol: "remitente",
    };

    const registro = await ejecutarPrueba(
      "Registrar cliente",
      "POST /clientes debe crear un cliente y devolver 201.",
      "201",
      () =>
        window.serpostApi.request({
          baseUrl,
          token,
          path: "/clientes",
          method: "POST",
          body: clientePrueba,
        }),
    );
    registrar(registro);

    let idCliente = "";
    if (registro.status === 201) {
      try {
        const parsed = JSON.parse(registro.response);
        idCliente = parsed?.id ? String(parsed.id) : "";
      } catch {
        const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-zA-Z0-9_-]+)/i.exec(
          registro.response,
        );
        idCliente = match?.[1] || "";
      }

      if (idCliente) {
        registrar(
          await ejecutarPrueba(
            "Consultar cliente",
            "GET /clientes/{id_cliente} debe devolver los datos registrados.",
            "200",
            () =>
              window.serpostApi.request({
                baseUrl,
                token,
                path: `/clientes/${encodeURIComponent(idCliente)}`,
                method: "GET",
              }),
          ),
        );

        registrar(
          await ejecutarPrueba(
            "Actualizar cliente",
            "PUT /clientes/{id_cliente} debe actualizar los datos.",
            "200",
            () =>
              window.serpostApi.request({
                baseUrl,
                token,
                path: `/clientes/${encodeURIComponent(idCliente)}`,
                method: "PUT",
                body: { ...clientePrueba, nombres: "Ana Perez Actualizada" },
              }),
          ),
        );
      }
    }

    registrar(
      await ejecutarPrueba(
        "Documento duplicado",
        "Registrar dos veces el mismo documento debe devolver 409.",
        "409",
        () =>
          window.serpostApi.request({
            baseUrl,
            token,
            path: "/clientes",
            method: "POST",
            body: clientePrueba,
          }),
      ),
    );

    registrar(
      await ejecutarPrueba(
        "Validacion de campos",
        "POST sin datos obligatorios debe devolver 400.",
        "400",
        () =>
          window.serpostApi.request({
            baseUrl,
            token,
            path: "/clientes",
            method: "POST",
            body: {},
          }),
      ),
    );

    setTestsRunning(false);
  }

  const passedCount = testResults.filter((item) => item.passed).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">SP</div>
          <div>
            <strong>SERPOST SOA</strong>
            <span>Gestion de clientes y envios</span>
          </div>
        </div>

        <div className="header-actions">
          <nav className="app-nav">
            <button
              type="button"
              className={`nav-button ${activeTab === "clientes" ? "active" : ""}`}
              onClick={() => setActiveTab("clientes")}
            >
              Clientes
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "envios" ? "active" : ""}`}
              onClick={() => setActiveTab("envios")}
            >
              Envios
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "tarifa" ? "active" : ""}`}
              onClick={() => setActiveTab("tarifa")}
            >
              Tarifa
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "operaciones" ? "active" : ""}`}
              onClick={() => setActiveTab("operaciones")}
            >
              Endpoints y Reglas
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "pruebas" ? "active" : ""}`}
              onClick={() => setActiveTab("pruebas")}
            >
              Pruebas del backend
            </button>
          </nav>

          <button
            type="button"
            className="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            Configuracion
          </button>
        </div>
      </header>

      <main className="content">
        {activeTab === "clientes" && (
          <ClientesView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "envios" && (
          <EnviosView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "tarifa" && (
          <TarifaView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "operaciones" && (
          <OperacionesView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "pruebas" && (
          <section>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Pruebas de integracion HTTP</p>
                <h1>Pruebas del backend</h1>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={ejecutarPruebasBackend}
                disabled={testsRunning}
              >
                {testsRunning ? "Ejecutando..." : "Ejecutar todas las pruebas"}
              </button>
            </div>

            <div className="test-summary">
              <div>
                <span>URL del servicio</span>
                <strong>{baseUrl}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>
                  {testResults.length === 0
                    ? "Sin ejecutar"
                    : `${passedCount}/${testResults.length} aprobadas`}
                </strong>
              </div>
            </div>

            {testResults.length === 0 ? (
              <div className="empty-tests">
                <strong>No hay resultados todavia</strong>
                <p>Ejecute las pruebas para mostrar los casos, estados HTTP y respuestas del backend.</p>
              </div>
            ) : (
              <div className="test-list">
                {testResults.map((item, idx) => (
                  <article
                    key={`${item.name}-${idx}`}
                    className={`test-item ${item.passed ? "passed" : "failed"}`}
                  >
                    <div className="test-item-header">
                      <div>
                        <span className="test-index">{idx + 1}</span>
                        <div>
                          <h2>{item.name}</h2>
                          <p>{item.description}</p>
                        </div>
                      </div>
                      <div className="test-badges">
                        <span>{item.status ?? "SIN RESP"}</span>
                        <span>{item.durationMs} ms</span>
                        <strong>{item.passed ? "APROBADA" : "FALLIDA"}</strong>
                      </div>
                    </div>
                    <div className="test-response">
                      <span>Esperado: HTTP {item.expected}</span>
                      <pre>{item.response}</pre>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="settings-title">Configuracion del servicio</h2>

            <div className="field">
              <label htmlFor="api-url">URL base del backend</label>
              <input
                id="api-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:3001"
              />
            </div>

            <div className="field">
              <label htmlFor="api-token">Token Bearer</label>
              <input
                id="api-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="JWT de acceso"
              />
            </div>

            <p className="helper">
              Se guarda automaticamente en localStorage para todas las vistas y pruebas.
            </p>

            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setSettingsOpen(false)}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}