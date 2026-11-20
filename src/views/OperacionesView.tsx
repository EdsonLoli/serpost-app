import { useMemo, useState } from "react";

interface OperacionesViewProps {
  baseUrl: string;
  token: string;
}

type HttpMethod = "GET" | "POST" | "PUT";
type LineaNegocio = "Personal" | "Empresarial" | "Encomienda" | "Filatelia";

function parseNum(val: string): number {
  return Number(String(val).trim().replace(",", "."));
}

export function OperacionesView({ baseUrl, token }: OperacionesViewProps) {
  const [pesoEnvio, setPesoEnvio] = useState("2.5");
  const [limiteMax, setLimiteMax] = useState("30");
  const [tarifaBase, setTarifaBase] = useState("10");
  const [costoKg, setCostoKg] = useState("3.5");
  const [igvPct, setIgvPct] = useState("18");
  const [lineaNegocio, setLineaNegocio] = useState<LineaNegocio>("Encomienda");
  const [palabraProhibida, setPalabraProhibida] = useState("explosivo");
  const [contenidoPrueba, setContenidoPrueba] = useState("Documentos y libros");

  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/envios");
  const [loading, setLoading] = useState(false);

  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const evaluacionReglas = useMemo(() => {
    const peso = parseNum(pesoEnvio);
    const max = parseNum(limiteMax);
    const base = parseNum(tarifaBase);
    const kgRate = parseNum(costoKg);
    const igv = parseNum(igvPct);

    const pesoValido = !Number.isNaN(peso) && peso > 0 && !Number.isNaN(max) && peso <= max;
    const subtotal =
      !Number.isNaN(peso) && !Number.isNaN(base) && !Number.isNaN(kgRate)
        ? Math.max(0, base + peso * kgRate)
        : 0;
    const total = subtotal * (1 + (Number.isNaN(igv) ? 0 : igv / 100));

    const prohibida = palabraProhibida.trim().toLowerCase();
    const contieneProhibido =
      prohibida.length > 0 && contenidoPrueba.trim().toLowerCase().includes(prohibida);

    return {
      pesoValido,
      subtotal: Number(subtotal.toFixed(2)),
      total: Number(total.toFixed(2)),
      contieneProhibido,
    };
  }, [pesoEnvio, limiteMax, tarifaBase, costoKg, igvPct, palabraProhibida, contenidoPrueba]);

  function seleccionarEndpoint(nextMethod: HttpMethod, nextPath: string) {
    setMethod(nextMethod);
    setPath(nextPath);
    setErrorMsg("");
  }

  async function enviarPeticion() {
    setErrorMsg("");
    setLastResponse("");
    setLastStatus(null);
    setLastDurationMs(null);

    const cleanPath = path.trim().startsWith("/") ? path.trim() : `/${path.trim()}`;

    setLoading(true);
    const started = performance.now();
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: cleanPath,
        method,
      });
      setLastDurationMs(Math.round(performance.now() - started));
      setLastStatus(res.status || null);

      if (typeof res.data === "string") {
        setLastResponse(res.data);
      } else if (res.data !== null && res.data !== undefined) {
        setLastResponse(JSON.stringify(res.data, null, 2));
      } else {
        setLastResponse(res.error || "Sin cuerpo de respuesta");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error ejecutando la petición.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Endpoints, Reglas de Peso y Consola Manual</p>
          <h1>Pruebas por endpoint</h1>
        </div>
      </div>

      <div className="inline-inputs">
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("GET", "/clientes")}
        >
          GET /clientes
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("GET", "/envios")}
        >
          GET /envios
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("GET", "/contenidos_prohibidos")}
        >
          GET /contenidos_prohibidos
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("POST", "/clientes")}
        >
          POST /clientes
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("POST", "/envios")}
        >
          POST /envios
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("PUT", "/clientes")}
        >
          PUT /clientes
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => seleccionarEndpoint("PUT", "/envios")}
        >
          PUT /envios
        </button>
      </div>

      <div className="rule-checker">
        <strong>Variables de reglas y simulación en vivo:</strong>
        <div className="grid-form">
          <label>
            Peso envío (kg)
            <input
              type="text"
              value={pesoEnvio}
              onChange={(e) => setPesoEnvio(e.target.value)}
            />
          </label>

          <label>
            Límite máx (kg)
            <input
              type="text"
              value={limiteMax}
              onChange={(e) => setLimiteMax(e.target.value)}
            />
          </label>

          <label>
            Línea de negocio
            <select
              value={lineaNegocio}
              onChange={(e) => setLineaNegocio(e.target.value as LineaNegocio)}
            >
              <option value="Personal">Personal</option>
              <option value="Empresarial">Empresarial</option>
              <option value="Encomienda">Encomienda</option>
              <option value="Filatelia">Filatelia</option>
            </select>
          </label>

          <label>
            Tarifa base (S/)
            <input
              type="text"
              value={tarifaBase}
              onChange={(e) => setTarifaBase(e.target.value)}
            />
          </label>

          <label>
            Costo por kg (S/)
            <input
              type="text"
              value={costoKg}
              onChange={(e) => setCostoKg(e.target.value)}
            />
          </label>

          <label>
            IGV (%)
            <input
              type="text"
              value={igvPct}
              onChange={(e) => setIgvPct(e.target.value)}
            />
          </label>

          <label>
            Palabra prohibida de prueba
            <input
              type="text"
              value={palabraProhibida}
              onChange={(e) => setPalabraProhibida(e.target.value)}
            />
          </label>

          <label>
            Contenido de prueba
            <input
              type="text"
              value={contenidoPrueba}
              onChange={(e) => setContenidoPrueba(e.target.value)}
            />
          </label>
        </div>

        <div className="inline-inputs">
          <span className={evaluacionReglas.pesoValido ? "badge ok" : "badge err"}>
            {evaluacionReglas.pesoValido ? "Dentro del límite" : "Excede límite de peso"}
          </span>
          <span className={!evaluacionReglas.contieneProhibido ? "badge ok" : "badge err"}>
            {!evaluacionReglas.contieneProhibido
              ? "Contenido permitido"
              : `Bloqueado por "${palabraProhibida}"`}
          </span>
          <span>
            Subtotal: <strong>S/ {evaluacionReglas.subtotal.toFixed(2)}</strong>
          </span>
          <span>
            Total c/IGV: <strong>S/ {evaluacionReglas.total.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <div className="inline-inputs">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
        </select>

        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/envios"
        />

        <button
          className="primary-button"
          type="button"
          disabled={loading}
          onClick={() => void enviarPeticion()}
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>

      {errorMsg && <div className="notice danger">{errorMsg}</div>}

      {lastResponse && (
        <div className="test-response">
          <span>
            Respuesta HTTP: <strong>{lastStatus ?? "SIN RESP"}</strong>
            {lastDurationMs !== null ? ` (${lastDurationMs} ms)` : ""}
          </span>
          <pre>{lastResponse}</pre>
        </div>
      )}
    </section>
  );
}