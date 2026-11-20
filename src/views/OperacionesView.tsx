import { useState } from "react";

interface OperacionesViewProps {
  baseUrl: string;
  token: string;
}

export function OperacionesView({ baseUrl, token }: OperacionesViewProps) {
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">("GET");
  const [endpoint, setEndpoint] = useState("/envios");
  const [jsonBody, setJsonBody] = useState('{\n  "codigo": "ENV-001",\n  "peso_kg": 2.5,\n  "descripcion": "Paquete de prueba"\n}');
  const [pesoKg, setPesoKg] = useState("2.5");
  const [maxPesoKg, setMaxPesoKg] = useState("30");
  const [resultStatus, setResultStatus] = useState<string>("");
  const [resultBody, setResultBody] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const pesoNum = Number(pesoKg);
  const maxNum = Number(maxPesoKg);
  const pesoValido = !Number.isNaN(pesoNum) && pesoNum > 0 && pesoNum <= maxNum;

  async function enviarPeticion(customMethod = method, customPath = endpoint, customBody?: string) {
    setLoading(true);
    setResultStatus("");
    setResultBody("");

    let parsedBody: unknown = undefined;
    if (customMethod !== "GET") {
      const raw = customBody ?? jsonBody;
      if (raw.trim()) {
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          setLoading(false);
          setResultStatus("JSON inválido");
          setResultBody("El cuerpo JSON tiene un error de sintaxis.");
          return;
        }
      }
    }

    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: customPath,
      method: customMethod,
      body: parsedBody,
    });

    setLoading(false);
    setResultStatus(`HTTP ${res.status} (${res.ok ? "OK" : "Error"})`);
    setResultBody(
      typeof res.data === "string"
        ? res.data
        : JSON.stringify(res.data ?? res.error ?? "Sin contenido", null, 2)
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Endpoints, Reglas de Peso y Consola Manual</p>
          <h1>Pruebas por endpoint</h1>
        </div>
      </div>

      <div className="quick-chips">
        <button type="button" onClick={() => { setMethod("GET"); setEndpoint("/clientes"); enviarPeticion("GET", "/clientes"); }}>
          GET /clientes
        </button>
        <button type="button" onClick={() => { setMethod("GET"); setEndpoint("/envios"); enviarPeticion("GET", "/envios"); }}>
          GET /envios
        </button>
        <button type="button" onClick={() => { setMethod("GET"); setEndpoint("/contenidos_prohibidos"); enviarPeticion("GET", "/contenidos_prohibidos"); }}>
          GET /contenidos_prohibidos
        </button>
      </div>

      <div className="rule-checker">
        <strong>Validador rápido de peso y límites:</strong>
        <div className="inline-inputs">
          <label>
            Peso envío (kg)
            <input type="number" step="0.1" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
          </label>
          <label>
            Límite máx (kg)
            <input type="number" step="1" value={maxPesoKg} onChange={(e) => setMaxPesoKg(e.target.value)} />
          </label>
          <span className={pesoValido ? "badge ok" : "badge err"}>
            {pesoValido ? "Dentro del límite" : "Fuera de límite / inválido"}
          </span>
        </div>
      </div>

      <div className="console-row">
        <select value={method} onChange={(e) => setMethod(e.target.value as "GET" | "POST" | "PUT" | "DELETE")}>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="/clientes o /envios/1"
        />
        <button className="primary-button" type="button" disabled={loading} onClick={() => enviarPeticion()}>
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>

      {method !== "GET" && (
        <label className="block-label">
          Cuerpo JSON ({method})
          <textarea rows={7} value={jsonBody} onChange={(e) => setJsonBody(e.target.value)} />
        </label>
      )}

      {resultStatus && (
        <div className="response-box">
          <div className="response-header">
            <strong>Respuesta: {resultStatus}</strong>
          </div>
          <pre>{resultBody}</pre>
        </div>
      )}
    </section>
  );
}
