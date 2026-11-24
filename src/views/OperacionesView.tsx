import { useEffect, useMemo, useState } from "react";

interface OperacionesViewProps {
  baseUrl: string;
  token: string;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type AdminSection = "reglas" | "consola" | "crud" | "peligro";
type LineaNegocio = "Personal" | "Empresarial" | "Encomienda" | "Filatelia";
type RecursoAdmin = "clientes" | "envios" | "contenidos_prohibidos";

interface AuditEntry {
  id: string;
  timestamp: string;
  method: HttpMethod;
  path: string;
  status: number | null;
  durationMs: number;
  note: string;
}

const MULTIPLICADOR_LINEA: Record<LineaNegocio, number> = {
  Personal: 1.0,
  Empresarial: 1.15,
  Encomienda: 1.2,
  Filatelia: 0.95,
};

const PLANTILLAS_BODY: Record<RecursoAdmin, Record<string, unknown>> = {
  clientes: {
    tipo_documento: "DNI",
    numero_documento: "45678912",
    nombres: "Cliente Admin Prueba",
    direccion: "Av. Central 450",
    telefono: "987654321",
    correo: "admin.cliente@serpost.pe",
    rol: "remitente",
  },
  envios: {
    id_remitente: "UUID_REMITENTE",
    id_destinatario: "UUID_DESTINATARIO",
    peso_kg: 2.5,
    contenido: "Documentos y libros",
    linea_negocio: "Encomienda",
    origen: "Lima",
    destino: "Cusco",
    ida_vuelta: false,
    servicio: "ESTANDAR",
    zona: "NACIONAL",
  },
  contenidos_prohibidos: {
    palabra: "explosivo",
    motivo: "Material peligroso restringido por normativa postal",
    activo: true,
  },
};

function parseNum(val: string): number {
  return Number(String(val).trim().replace(",", "."));
}

function formatearFechaHora(date = new Date()): string {
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function calcularFilasJson(texto: string, minRows = 6, maxRows = 16): number {
  const lineas = texto.split("\n");
  let totalLineas = 0;

  for (const linea of lineas) {
    totalLineas += Math.max(1, Math.ceil(linea.length / 72));
  }

  return Math.min(maxRows, Math.max(minRows, totalLineas + 1));
}

export function OperacionesView({ baseUrl, token }: OperacionesViewProps) {
  const [seccionActiva, setSeccionActiva] = useState<AdminSection>("reglas");
  const [esPantallaAncha, setEsPantallaAncha] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 900 : true
  );

  useEffect(() => {
    function handleResize() {
      setEsPantallaAncha(window.innerWidth >= 900);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- Reglas de negocio y simulación ---
  const [pesoEnvio, setPesoEnvio] = useState("2.5");
  const [limiteMax, setLimiteMax] = useState("30");
  const [tarifaBase, setTarifaBase] = useState("10");
  const [costoKg, setCostoKg] = useState("3.5");
  const [igvPct, setIgvPct] = useState("18");
  const [lineaNegocio, setLineaNegocio] = useState<LineaNegocio>("Encomienda");
  const [palabrasProhibidasRaw, setPalabrasProhibidasRaw] = useState(
    "explosivo, inflamable, arma, narcotico, toxicos"
  );
  const [contenidoPrueba, setContenidoPrueba] = useState("Documentos y libros");

  // --- Consola manual ---
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/envios");
  const [jsonBodyText, setJsonBodyText] = useState<string>(
    JSON.stringify(PLANTILLAS_BODY.envios, null, 2)
  );

  // --- Segmento CRUD admin (GET / POST / PUT) ---
  const [recursoCrud, setRecursoCrud] = useState<RecursoAdmin>("envios");
  const [idCrud, setIdCrud] = useState<string>("");
  const [payloadCrudText, setPayloadCrudText] = useState<string>(
    JSON.stringify(PLANTILLAS_BODY.envios, null, 2)
  );

  // --- Zona peligrosa (DELETE) ---
  const [zonaPeligroActiva, setZonaPeligroActiva] = useState<boolean>(false);
  const [recursoDelete, setRecursoDelete] = useState<RecursoAdmin>("envios");
  const [idDelete, setIdDelete] = useState<string>("");
  const [confirmacionTexto, setConfirmacionTexto] = useState<string>("");

  // --- Estado de ejecución y respuesta ---
  const [loading, setLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [bitacora, setBitacora] = useState<AuditEntry[]>([]);

  const listaProhibidas = useMemo(() => {
    return palabrasProhibidasRaw
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0);
  }, [palabrasProhibidasRaw]);

  const evaluacionReglas = useMemo(() => {
    const peso = parseNum(pesoEnvio);
    const max = parseNum(limiteMax);
    const base = parseNum(tarifaBase);
    const kgRate = parseNum(costoKg);
    const igv = parseNum(igvPct);

    const pesoValido =
      !Number.isNaN(peso) &&
      peso > 0 &&
      (Number.isNaN(max) || max <= 0 || peso <= max);

    const multLinea = MULTIPLICADOR_LINEA[lineaNegocio] ?? 1;
    const subtotal =
      !Number.isNaN(peso) && !Number.isNaN(base) && !Number.isNaN(kgRate)
        ? Math.max(0, (base + peso * kgRate) * multLinea)
        : 0;
    const total = subtotal * (1 + (Number.isNaN(igv) ? 0 : igv / 100));

    const textoEval = contenidoPrueba.trim().toLowerCase();
    const coincidencias = listaProhibidas.filter((palabra) => textoEval.includes(palabra));

    return {
      pesoValido,
      multLinea,
      subtotal: Number(subtotal.toFixed(2)),
      total: Number(total.toFixed(2)),
      coincidencias,
      permitido: pesoValido && coincidencias.length === 0,
    };
  }, [pesoEnvio, limiteMax, tarifaBase, costoKg, igvPct, lineaNegocio, listaProhibidas, contenidoPrueba]);

  function registrarAuditoria(
    reqMethod: HttpMethod,
    reqPath: string,
    status: number | null,
    durationMs: number,
    note: string
  ) {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: formatearFechaHora(),
      method: reqMethod,
      path: reqPath,
      status,
      durationMs,
      note,
    };
    setBitacora((prev) => [entry, ...prev].slice(0, 25));
  }

  function seleccionarEndpoint(
    nextMethod: HttpMethod,
    nextPath: string,
    recursoPlantilla?: RecursoAdmin
  ) {
    setMethod(nextMethod);
    setPath(nextPath);
    setErrorMsg("");
    setStatusMsg("");
    if (recursoPlantilla && (nextMethod === "POST" || nextMethod === "PUT")) {
      setJsonBodyText(JSON.stringify(PLANTILLAS_BODY[recursoPlantilla], null, 2));
    }
  }

  function cambiarRecursoCrud(nuevoRecurso: RecursoAdmin) {
    setRecursoCrud(nuevoRecurso);
    setIdCrud("");
    setPayloadCrudText(JSON.stringify(PLANTILLAS_BODY[nuevoRecurso], null, 2));
    setErrorMsg("");
    setStatusMsg("");
  }

  async function ejecutarRequestBase(
    reqMethod: HttpMethod,
    rawPath: string,
    rawBodyText?: string,
    note = "Operación manual"
  ) {
    setErrorMsg("");
    setStatusMsg("");
    setLastResponse("");
    setLastStatus(null);
    setLastDurationMs(null);

    const trimmedPath = rawPath.trim();
    if (!trimmedPath) {
      setErrorMsg("Debes indicar una ruta de endpoint (por ejemplo /envios).");
      return;
    }
    const cleanPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;

    let parsedBody: unknown = undefined;
    if (reqMethod === "POST" || reqMethod === "PUT") {
      const texto = (rawBodyText ?? "").trim();
      if (texto.length > 0) {
        try {
          parsedBody = JSON.parse(texto);
        } catch {
          setErrorMsg("El cuerpo JSON no tiene un formato válido.");
          return;
        }
      } else {
        parsedBody = {};
      }
    }

    setLoading(true);
    const started = performance.now();
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: cleanPath,
        method: reqMethod,
        ...(parsedBody !== undefined ? { body: parsedBody } : {}),
      });
      const elapsed = Math.round(performance.now() - started);
      setLastDurationMs(elapsed);
      setLastStatus(res.status || null);

      let textoResp = "";
      if (typeof res.data === "string") {
        textoResp = res.data;
      } else if (res.data !== null && res.data !== undefined) {
        textoResp = JSON.stringify(res.data, null, 2);
      } else {
        textoResp = res.error || "Sin cuerpo de respuesta";
      }
      setLastResponse(textoResp);

      if (res.ok) {
        setStatusMsg(`${reqMethod} ${cleanPath} completado (HTTP ${res.status}).`);
      } else {
        setErrorMsg(res.error || `Error en ${reqMethod} ${cleanPath} (HTTP ${res.status})`);
      }

      registrarAuditoria(reqMethod, cleanPath, res.status || null, elapsed, note);
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : "Error ejecutando la petición.";
      setErrorMsg(msg);
      registrarAuditoria(reqMethod, cleanPath, null, elapsed, `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function ejecutarCrud(operacion: "GET" | "POST" | "PUT") {
    const cleanId = idCrud.trim();
    if (operacion === "PUT" && !cleanId) {
      setErrorMsg("Para ejecutar PUT debes ingresar el ID del registro a actualizar.");
      return;
    }
    const targetPath = cleanId
      ? `/${recursoCrud}/${encodeURIComponent(cleanId)}`
      : `/${recursoCrud}`;

    await ejecutarRequestBase(
      operacion,
      targetPath,
      operacion === "POST" || operacion === "PUT" ? payloadCrudText : undefined,
      `Admin CRUD ${operacion} en ${recursoCrud}`
    );
  }

  async function ejecutarDeletePeligroso() {
    if (!zonaPeligroActiva) {
      setErrorMsg("Activa primero la Zona Peligrosa de Administración.");
      return;
    }
    const cleanId = idDelete.trim();
    if (!cleanId) {
      setErrorMsg("Ingresa el ID exacto del registro que deseas eliminar.");
      return;
    }
    if (confirmacionTexto.trim() !== "ELIMINAR") {
      setErrorMsg('Escribe exactamente "ELIMINAR" para confirmar la operación DELETE.');
      return;
    }

    const targetPath = `/${recursoDelete}/${encodeURIComponent(cleanId)}`;
    await ejecutarRequestBase(
      "DELETE",
      targetPath,
      undefined,
      `[PELIGRO] DELETE en ${recursoDelete} (${cleanId})`
    );
    setConfirmacionTexto("");
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Panel de Administración · Endpoints, Reglas y Control CRUD</p>
          <h1>Administración de Operaciones y Reglas</h1>
        </div>
        <div className="inline-inputs">
          <span className="badge ok">GET · POST · PUT</span>
          <span className={zonaPeligroActiva ? "badge err" : "badge"}>
            {zonaPeligroActiva ? "DELETE DESBLOQUEADO" : "DELETE PROTEGIDO"}
          </span>
        </div>
      </div>

      <div className="inline-inputs">
        <button
          type="button"
          className={seccionActiva === "reglas" ? "primary-button" : "secondary-button"}
          onClick={() => setSeccionActiva("reglas")}
        >
          1. Reglas y Tarifario
        </button>
        <button
          type="button"
          className={seccionActiva === "consola" ? "primary-button" : "secondary-button"}
          onClick={() => setSeccionActiva("consola")}
        >
          2. Consola Endpoints
        </button>
        <button
          type="button"
          className={seccionActiva === "crud" ? "primary-button" : "secondary-button"}
          onClick={() => setSeccionActiva("crud")}
        >
          3. Gestión POST / PUT / GET
        </button>
        <button
          type="button"
          className={seccionActiva === "peligro" ? "primary-button" : "secondary-button"}
          onClick={() => setSeccionActiva("peligro")}
        >
          4. Zona Peligrosa (DELETE)
        </button>
      </div>

      {statusMsg && <div className="notice success">{statusMsg}</div>}
      {errorMsg && <div className="notice danger">{errorMsg}</div>}

      {seccionActiva === "reglas" && (
        <div className="rule-checker">
          <strong>Parámetros de reglas postales y simulación en vivo:</strong>
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
                <option value="Personal">Personal (x1.00)</option>
                <option value="Empresarial">Empresarial (x1.15)</option>
                <option value="Encomienda">Encomienda (x1.20)</option>
                <option value="Filatelia">Filatelia (x0.95)</option>
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
              Palabras prohibidas (separadas por coma)
              <input
                type="text"
                value={palabrasProhibidasRaw}
                onChange={(e) => setPalabrasProhibidasRaw(e.target.value)}
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
            <span className={evaluacionReglas.coincidencias.length === 0 ? "badge ok" : "badge err"}>
              {evaluacionReglas.coincidencias.length === 0
                ? "Contenido permitido"
                : `Bloqueado por: ${evaluacionReglas.coincidencias.join(", ")}`}
            </span>
            <span className={evaluacionReglas.permitido ? "badge ok" : "badge err"}>
              {evaluacionReglas.permitido ? "APTO PARA DESPACHO" : "OBSERVADO / BLOQUEADO"}
            </span>
            <span>
              Subtotal ({lineaNegocio}): <strong>S/ {evaluacionReglas.subtotal.toFixed(2)}</strong>
            </span>
            <span>
              Total c/IGV: <strong>S/ {evaluacionReglas.total.toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}

      {seccionActiva === "consola" && (
        <div className="rule-checker">
          <strong>Accesos rápidos y consola HTTP manual:</strong>
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
              onClick={() => seleccionarEndpoint("POST", "/clientes", "clientes")}
            >
              POST /clientes
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => seleccionarEndpoint("POST", "/envios", "envios")}
            >
              POST /envios
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => seleccionarEndpoint("PUT", "/clientes", "clientes")}
            >
              PUT /clientes
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => seleccionarEndpoint("PUT", "/envios", "envios")}
            >
              PUT /envios
            </button>
          </div>

          <div className="inline-inputs">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              {zonaPeligroActiva && <option value="DELETE">DELETE</option>}
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
              onClick={() => void ejecutarRequestBase(method, path, jsonBodyText, "Consola manual")}
            >
              {loading ? "Enviando..." : "Enviar"}
            </button>
          </div>

          {(method === "POST" || method === "PUT") && (
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
              Cuerpo de petición (JSON)
              <textarea
                rows={calcularFilasJson(jsonBodyText, 6, 16)}
                value={jsonBodyText}
                onChange={(e) => setJsonBodyText(e.target.value)}
                spellCheck={false}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "13px",
                  lineHeight: 1.45,
                  padding: "10px 12px",
                  borderRadius: "8px",
                }}
              />
            </label>
          )}
        </div>
      )}

      {seccionActiva === "crud" && (
        <div className="rule-checker">
          <strong>Operaciones administrativas segmentadas por recurso (POST / GET / PUT):</strong>
          <div className="grid-form">
            <label>
              Recurso objetivo
              <select
                value={recursoCrud}
                onChange={(e) => cambiarRecursoCrud(e.target.value as RecursoAdmin)}
              >
                <option value="clientes">Clientes (/clientes)</option>
                <option value="envios">Envíos (/envios)</option>
                <option value="contenidos_prohibidos">
                  Contenidos prohibidos (/contenidos_prohibidos)
                </option>
              </select>
            </label>

            <label>
              ID del registro (opcional en GET, requerido en PUT)
              <input
                type="text"
                value={idCrud}
                onChange={(e) => setIdCrud(e.target.value)}
                placeholder="UUID o identificador"
              />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginTop: "10px" }}>
            Datos para CREATE (POST) o UPDATE (PUT) — JSON
            <textarea
              rows={calcularFilasJson(payloadCrudText, 6, 16)}
              value={payloadCrudText}
              onChange={(e) => setPayloadCrudText(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "13px",
                lineHeight: 1.45,
                padding: "10px 12px",
                borderRadius: "8px",
              }}
            />
          </label>

          <div className="inline-inputs">
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={() => void ejecutarCrud("GET")}
            >
              Consultar (GET)
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={loading}
              onClick={() => void ejecutarCrud("POST")}
            >
              Crear registro (POST)
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={() => void ejecutarCrud("PUT")}
            >
              Actualizar registro (PUT)
            </button>
          </div>
        </div>
      )}

      {seccionActiva === "peligro" && (
        <div className="rule-checker notice danger">
          <strong>Zona Peligrosa de Administración — Eliminación definitiva (DELETE):</strong>
          <p className="helper">
            Esta sección permite enviar peticiones <code>DELETE</code>. Úsala solo para limpiar datos de
            prueba o corregir registros inválidos bajo supervisión administrativa.
          </p>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={zonaPeligroActiva}
              onChange={(e) => {
                setZonaPeligroActiva(e.target.checked);
                if (!e.target.checked) setConfirmacionTexto("");
              }}
            />
            Entiendo el impacto y deseo habilitar operaciones DELETE
          </label>

          <div className="grid-form">
            <label>
              Recurso a eliminar
              <select
                disabled={!zonaPeligroActiva}
                value={recursoDelete}
                onChange={(e) => setRecursoDelete(e.target.value as RecursoAdmin)}
              >
                <option value="envios">Envíos (/envios/:id)</option>
                <option value="clientes">Clientes (/clientes/:id)</option>
                <option value="contenidos_prohibidos">
                  Contenidos prohibidos (/contenidos_prohibidos/:id)
                </option>
              </select>
            </label>

            <label>
              ID del registro a eliminar
              <input
                type="text"
                disabled={!zonaPeligroActiva}
                value={idDelete}
                onChange={(e) => setIdDelete(e.target.value)}
                placeholder="Ej. b46cfe55-6cd4-4138-a0e6-2c803b554f3d"
              />
            </label>

            <label>
              Escribe <strong>ELIMINAR</strong> para confirmar
              <input
                type="text"
                disabled={!zonaPeligroActiva}
                value={confirmacionTexto}
                onChange={(e) => setConfirmacionTexto(e.target.value)}
                placeholder="ELIMINAR"
              />
            </label>
          </div>

          <div className="inline-inputs">
            <button
              type="button"
              className="primary-button"
              disabled={
                loading ||
                !zonaPeligroActiva ||
                !idDelete.trim() ||
                confirmacionTexto.trim() !== "ELIMINAR"
              }
              onClick={() => void ejecutarDeletePeligroso()}
            >
              {loading ? "Eliminando..." : "Ejecutar DELETE definitivo"}
            </button>
          </div>
        </div>
      )}

      {/* RESPUESTA BACKEND GRANDE A LA IZQUIERDA Y BITÁCORA A UN COSTADO (DERECHA) */}
      {(lastResponse || bitacora.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: esPantallaAncha ? "minmax(0, 1.55fr) minmax(300px, 1fr)" : "1fr",
            gap: "16px",
            alignItems: "start",
            marginTop: "14px",
            width: "100%",
          }}
        >
          <div
            className="test-response"
            style={{
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span>
                Respuesta HTTP: <strong>{lastStatus ?? "SIN RESP"}</strong>
                {lastDurationMs !== null ? ` (${lastDurationMs} ms)` : ""}
              </span>
              {lastResponse && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void navigator.clipboard?.writeText(lastResponse)}
                >
                  Copiar JSON
                </button>
              )}
            </div>
            <pre
              style={{
                width: "100%",
                minWidth: 0,
                minHeight: "260px",
                maxHeight: "480px",
                overflow: "auto",
                boxSizing: "border-box",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "13.5px",
                lineHeight: 1.5,
                padding: "14px",
                marginTop: "8px",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {lastResponse || "Aún no se ha ejecutado una petición en este segmento."}
            </pre>
          </div>

          <div
            className="rule-checker"
            style={{
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
              marginTop: 0,
            }}
          >
            <strong>Bitácora de operaciones de administración (sesión actual):</strong>
            {bitacora.length === 0 ? (
              <p className="helper">Sin movimientos registrados todavía.</p>
            ) : (
              <ul
                style={{
                  maxHeight: "480px",
                  overflowY: "auto",
                  margin: "8px 0 0",
                  paddingLeft: "18px",
                }}
              >
                {bitacora.map((item) => (
                  <li key={item.id} style={{ marginBottom: "6px" }}>
                    <strong>[{item.timestamp}] {item.method} {item.path}</strong> —{" "}
                    <span>HTTP {item.status ?? "ERR"} ({item.durationMs} ms)</span> · {item.note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}