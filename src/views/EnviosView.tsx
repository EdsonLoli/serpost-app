import { useEffect, useMemo, useState } from "react";

interface EnviosViewProps {
  baseUrl: string;
  token: string;
}

type EstadoEnvio = "REGISTRADO" | "EN_TRANSITO" | "ENTREGADO" | "RECHAZADO";
type LineaNegocio = "Personal" | "Empresarial" | "Encomienda" | "Filatelia";

interface ClienteItem {
  id?: string;
  tipo_documento?: string;
  numero_documento?: string;
  nombres?: string;
  direccion?: string;
  correo?: string;
  rol?: string;
}

interface Envio {
  id?: string;
  codigo: string;
  id_remitente?: string;
  id_destinatario?: string;
  remitente?: string;
  destinatario?: string;
  origen?: string;
  destino: string;
  peso_kg: number;
  contenido?: string;
  descripcion?: string;
  linea_negocio?: LineaNegocio;
  estado?: EstadoEnvio | string;
  simulacion_log?: string;
}

interface EnvioFormState {
  codigo: string;
  id_remitente: string;
  remitente: string;
  id_destinatario: string;
  destinatario: string;
  origen: string;
  destino: string;
  peso_kg: string;
  contenido: string;
  linea_negocio: LineaNegocio;
}

function generarCodigoAleatorio(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let bloque = "";
  for (let i = 0; i < 8; i++) {
    bloque += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ENV-${bloque}`;
}

const EMPTY_ENVIO: EnvioFormState = {
  codigo: generarCodigoAleatorio(),
  id_remitente: "",
  remitente: "",
  id_destinatario: "",
  destinatario: "",
  origen: "Lima Centro 100",
  destino: "",
  peso_kg: "1.5",
  contenido: "",
  linea_negocio: "Encomienda",
};

const BASURA_PATTERNS = [
  /^(.)\1+$/i,
  /qwerty/i,
  /asdf/i,
  /zxcv/i,
  /123456/,
  /abcdef/i,
  /prueba/i,
  /test/i,
  /xxxx/i,
  /aaaa/i,
];

const PROHIBIDOS_BASE = [
  "explosivo",
  "polvora",
  "inflamable",
  "gasolina",
  "acido",
  "arma",
  "municion",
  "droga",
  "cocaina",
  "marihuana",
  "veneno",
  "toxico",
  "bateria de litio",
  "aerosol",
];

const FLUJO_ESTADOS: EstadoEnvio[] = ["REGISTRADO", "EN_TRANSITO", "ENTREGADO"];
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseNum(val: string): number {
  return Number(String(val).trim().replace(",", "."));
}

function esTextoBasura(texto: string): boolean {
  const limpio = texto.trim().toLowerCase();
  if (!limpio) return true;
  if (BASURA_PATTERNS.some((rx) => rx.test(limpio))) return true;
  const soloLetras = limpio.replace(/[^a-zñáéíóú]/gi, "");
  if (soloLetras.length >= 5 && !/[aeiouáéíóú]/i.test(soloLetras)) {
    return true;
  }
  return false;
}

function validarDireccion8a20(dir: string, etiqueta: string): string | null {
  const clean = dir.trim();
  if (clean.length < 8 || clean.length > 20) {
    return `${etiqueta}: debe tener entre 8 y 20 caracteres.`;
  }
  if (!/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s.,#°/-]+$/.test(clean)) {
    return `${etiqueta}: contiene caracteres no permitidos.`;
  }
  if (esTextoBasura(clean) || !/[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(clean)) {
    return `${etiqueta}: bloqueada por filtro antibasura.`;
  }
  return null;
}

export function EnviosView({ baseUrl, token }: EnviosViewProps) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [buscarRemitente, setBuscarRemitente] = useState("");
  const [buscarDestinatario, setBuscarDestinatario] = useState("");
  const [prohibidos, setProhibidos] = useState<string[]>(PROHIBIDOS_BASE);

  const [form, setForm] = useState<EnvioFormState>(EMPTY_ENVIO);
  const [maxPesoKg, setMaxPesoKg] = useState("30");
  const [forzarEnvio, setForzarEnvio] = useState(false);

  const [simulacionEstado, setSimulacionEstado] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  async function cargarEnvios() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: "/envios",
        method: "GET",
      });
      if (res.ok && Array.isArray(res.data)) {
        setEnvios(res.data);
      } else if (res.status === 404) {
        setEnvios([]);
      } else {
        setErrorMsg(res.error || `Error GET /envios (HTTP ${res.status})`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al cargar envíos");
    } finally {
      setLoading(false);
    }
  }

  async function cargarClientes() {
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: "/clientes",
        method: "GET",
      });
      if (res.ok && Array.isArray(res.data)) {
        setClientes(res.data);
      }
    } catch {
      // Sin bloqueo si falla
    }
  }

  async function cargarProhibidos() {
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: "/contenidos_prohibidos",
        method: "GET",
      });
      if (res.ok && Array.isArray(res.data)) {
        const extra = res.data
          .map((item) => {
            if (typeof item === "string") return item.toLowerCase();
            if (item && typeof item === "object") {
              const obj = item as Record<string, unknown>;
              if (obj.activo === false) return "";
              return String(
                obj.palabra_clave ?? obj.nombre ?? obj.item ?? obj.descripcion ?? ""
              ).toLowerCase();
            }
            return "";
          })
          .filter(Boolean);
        if (extra.length > 0) {
          setProhibidos(Array.from(new Set([...PROHIBIDOS_BASE, ...extra])));
        }
      }
    } catch {
      // Mantiene lista base
    }
  }

  useEffect(() => {
    void cargarEnvios();
    void cargarClientes();
    void cargarProhibidos();
  }, [baseUrl]);

  const remitentesFiltrados = useMemo(() => {
    const q = buscarRemitente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      `${c.nombres ?? ""} ${c.numero_documento ?? ""} ${c.correo ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [clientes, buscarRemitente]);

  const destinatariosFiltrados = useMemo(() => {
    const q = buscarDestinatario.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      `${c.nombres ?? ""} ${c.numero_documento ?? ""} ${c.direccion ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [clientes, buscarDestinatario]);

  function validarReglasEnvio(data = form, limite = maxPesoKg): string[] {
    const errs: string[] = [];

    const cod = data.codigo.trim();
    if (cod.length < 4 || cod.length > 25 || !/^[a-zA-Z0-9-]+$/.test(cod)) {
      errs.push("Código: 4 a 25 caracteres alfanuméricos o guion.");
    }

    if (!data.id_remitente.trim() || !UUID_RX.test(data.id_remitente.trim())) {
      errs.push("Remitente: selecciona un cliente con UUID válido.");
    }

    if (!data.id_destinatario.trim() || !UUID_RX.test(data.id_destinatario.trim())) {
      errs.push("Destinatario: selecciona un cliente con UUID válido.");
    }

    const errOrigen = validarDireccion8a20(data.origen, "Origen");
    if (errOrigen) errs.push(errOrigen);

    const errDestino = validarDireccion8a20(data.destino, "Destino");
    if (errDestino) errs.push(errDestino);

    const peso = parseNum(data.peso_kg);
    const maxP = parseNum(limite);
    if (Number.isNaN(peso) || peso <= 0) {
      errs.push("Peso (kg): debe ser mayor que 0.");
    } else if (!Number.isNaN(maxP) && maxP > 0 && peso > maxP) {
      errs.push(`Peso (kg): excede el límite máximo de ${maxP} kg.`);
    }

    const cont = data.contenido.trim();
    const contLower = cont.toLowerCase();
    if (!cont || cont.length < 3 || esTextoBasura(cont)) {
      errs.push("Contenido: obligatorio y sin texto basura.");
    } else {
      const prohibido = prohibidos.find((palabra) => contLower.includes(palabra));
      if (prohibido) {
        errs.push(`Contenido prohibido: se detectó "${prohibido}".`);
      }
    }

    return errs;
  }

  function handleChange<K extends keyof EnvioFormState>(field: K, value: EnvioFormState[K]) {
    const next = { ...form, [field]: value };
    setForm(next);
    setWarnings(validarReglasEnvio(next, maxPesoKg));
  }

  function seleccionarRemitente(cliente: ClienteItem) {
    const nombre = (cliente.nombres || "").trim();
    const idCli = (cliente.id || "").trim();
    const next: EnvioFormState = {
      ...form,
      id_remitente: idCli,
      remitente: nombre,
      origen:
        cliente.direccion && cliente.direccion.trim().length >= 8
          ? cliente.direccion.trim().slice(0, 20)
          : form.origen,
    };
    setForm(next);
    setBuscarRemitente(nombre);
    setWarnings(validarReglasEnvio(next, maxPesoKg));
  }

  function seleccionarDestinatario(cliente: ClienteItem) {
    const nombre = (cliente.nombres || "").trim();
    const idCli = (cliente.id || "").trim();
    const next: EnvioFormState = {
      ...form,
      id_destinatario: idCli,
      destinatario: nombre,
      destino:
        cliente.direccion && cliente.direccion.trim().length >= 8
          ? cliente.direccion.trim().slice(0, 20)
          : form.destino,
    };
    setForm(next);
    setBuscarDestinatario(nombre);
    setWarnings(validarReglasEnvio(next, maxPesoKg));
  }

  async function registrarYSimular(modoSimulacion: boolean) {
    setStatusMsg("");
    setErrorMsg("");
    setSimulacionEstado("");

    const errs = validarReglasEnvio(form, maxPesoKg);
    setWarnings(errs);

    if (!forzarEnvio && errs.length > 0) {
      setErrorMsg("El envío no pasó las reglas. Corrige los campos o activa 'Forzar envío/simulación'.");
      if (modoSimulacion) {
        setSimulacionEstado("SIMULACIÓN RECHAZADA: paquete retenido por reglas de despacho.");
      }
      return;
    }

    const pesoNum = parseNum(form.peso_kg);
    const maxNum = parseNum(maxPesoKg);
    const tarifaEstimada = Number.isNaN(pesoNum)
      ? 10
      : Math.max(10, Math.round((10 + pesoNum * 3.5) * 100) / 100);

    const payload: Envio = {
      codigo: form.codigo.trim().toUpperCase(),
      id_remitente: form.id_remitente.trim(),
      id_destinatario: form.id_destinatario.trim(),
      remitente: form.remitente.trim(),
      destinatario: form.destinatario.trim(),
      origen: form.origen.trim(),
      destino: form.destino.trim(),
      peso_kg: pesoNum,
      contenido: form.contenido.trim(),
      descripcion: form.contenido.trim(),
      linea_negocio: form.linea_negocio,
      estado: errs.length > 0 ? "RECHAZADO" : modoSimulacion ? "EN_TRANSITO" : "REGISTRADO",
      simulacion_log: modoSimulacion
        ? `Despachado a ${form.destino.trim()} (${pesoNum} kg / máx ${maxNum || 30} kg) · Tarifa S/ ${tarifaEstimada.toFixed(2)}`
        : `Registrado (${form.linea_negocio})`,
    };

    setLoading(true);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: "/envios",
      method: "POST",
      body: payload,
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(
        modoSimulacion
          ? `Paquete simulado y enviado (HTTP ${res.status}) · Tarifa S/ ${tarifaEstimada.toFixed(2)}.`
          : `Envío registrado (HTTP ${res.status}).`
      );
      if (modoSimulacion) {
        setSimulacionEstado(
          `SIMULACIÓN EXITOSA: ${payload.codigo} -> ${payload.estado} (${payload.destino}, ${payload.peso_kg} kg).`
        );
      }
      setForm({
        ...EMPTY_ENVIO,
        codigo: generarCodigoAleatorio(),
      });
      setBuscarRemitente("");
      setBuscarDestinatario("");
      setWarnings([]);
      await cargarEnvios();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo procesar el envío"}`);
    }
  }

  async function avanzarEstadoSimulado(envio: Envio) {
    if (!envio.id) return;
    const actual = (envio.estado || "REGISTRADO") as EstadoEnvio;
    const idx = FLUJO_ESTADOS.indexOf(actual);
    const siguiente: EstadoEnvio =
      idx >= 0 && idx < FLUJO_ESTADOS.length - 1 ? FLUJO_ESTADOS[idx + 1] : "ENTREGADO";

    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/envios/${encodeURIComponent(envio.id)}`,
      method: "PUT",
      body: {
        ...envio,
        estado: siguiente,
        simulacion_log: `Estado actualizado a ${siguiente}`,
      },
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(`Envío ${envio.codigo || envio.id} ahora está en estado ${siguiente}.`);
      await cargarEnvios();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo actualizar estado"}`);
    }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    setStatusMsg("");
    setErrorMsg("");
    setLoading(true);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/envios/${encodeURIComponent(id)}`,
      method: "DELETE",
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(`Envío eliminado (HTTP ${res.status}).`);
      await cargarEnvios();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo eliminar el envío"}`);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Registro, Simulación de Paquetes y Reglas</p>
          <h1>Envíos y Simulador ({envios.length})</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => void cargarEnvios()} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar lista (GET)"}
        </button>
      </div>

      {statusMsg && <div className="notice success">{statusMsg}</div>}
      {errorMsg && <div className="notice danger">{errorMsg}</div>}
      {simulacionEstado && <div className="notice success">{simulacionEstado}</div>}

      <div className="rule-checker">
        <strong>Reglas de despacho y simulación:</strong>
        <div className="inline-inputs">
          <label>
            Peso máximo permitido (kg)
            <input
              type="text"
              value={maxPesoKg}
              onChange={(e) => {
                setMaxPesoKg(e.target.value);
                setWarnings(validarReglasEnvio(form, e.target.value));
              }}
            />
          </label>
          <span className="badge ok">Prohibidos activos: {prohibidos.length} términos</span>
          <span className="badge ok">Clientes cargados: {clientes.length}</span>
        </div>
      </div>

      <div className="rule-checker">
        <strong>Buscador de remitente y destinatario:</strong>
        <div className="grid-form">
          <label>
            Buscar remitente (nombre, DNI/RUC o UUID)
            <input
              value={buscarRemitente}
              onChange={(e) => setBuscarRemitente(e.target.value)}
              placeholder="Buscar remitente..."
            />
            <select
              value={form.id_remitente}
              onChange={(e) => {
                const found = clientes.find((c) => (c.id || "") === e.target.value);
                if (found) seleccionarRemitente(found);
              }}
            >
              <option value="">-- Seleccionar remitente ({remitentesFiltrados.length}) --</option>
              {remitentesFiltrados.map((c, idx) => (
                <option key={c.id || idx} value={c.id || ""}>
                  {c.nombres} ({c.numero_documento || "DOC"}) {c.id ? `[${c.id.slice(0, 8)}]` : "[sin UUID]"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Buscar destinatario (nombre, DNI/RUC o UUID)
            <input
              value={buscarDestinatario}
              onChange={(e) => setBuscarDestinatario(e.target.value)}
              placeholder="Buscar destinatario..."
            />
            <select
              value={form.id_destinatario}
              onChange={(e) => {
                const found = clientes.find((c) => (c.id || "") === e.target.value);
                if (found) seleccionarDestinatario(found);
              }}
            >
              <option value="">-- Seleccionar destinatario ({destinatariosFiltrados.length}) --</option>
              {destinatariosFiltrados.map((c, idx) => (
                <option key={c.id || idx} value={c.id || ""}>
                  {c.nombres} ({c.numero_documento || "DOC"}) {c.id ? `[${c.id.slice(0, 8)}]` : "[sin UUID]"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <form
        className="grid-form"
        onSubmit={(e) => {
          e.preventDefault();
          void registrarYSimular(false);
        }}
      >
        <label>
          Código de paquete (aleatorio)
          <div className="inline-inputs">
            <input
              value={form.codigo}
              onChange={(e) => handleChange("codigo", e.target.value)}
              placeholder="ENV-XXXXXXXX"
            />
            <button
              className="secondary-button"
              type="button"
              onClick={() => handleChange("codigo", generarCodigoAleatorio())}
            >
              Aleatorio
            </button>
          </div>
        </label>

        <label>
          Línea de negocio
          <select
            value={form.linea_negocio}
            onChange={(e) => handleChange("linea_negocio", e.target.value as LineaNegocio)}
          >
            <option value="Personal">Personal</option>
            <option value="Empresarial">Empresarial</option>
            <option value="Encomienda">Encomienda</option>
            <option value="Filatelia">Filatelia</option>
          </select>
        </label>

        <label>
          UUID Remitente
          <input
            value={form.id_remitente}
            onChange={(e) => handleChange("id_remitente", e.target.value)}
            placeholder="UUID del remitente"
          />
        </label>

        <label>
          UUID Destinatario
          <input
            value={form.id_destinatario}
            onChange={(e) => handleChange("id_destinatario", e.target.value)}
            placeholder="UUID del destinatario"
          />
        </label>

        <label>
          Origen (8 a 20 car., alfanumérico)
          <input
            maxLength={20}
            value={form.origen}
            onChange={(e) => handleChange("origen", e.target.value)}
            placeholder="Lima Centro 100"
          />
        </label>

        <label>
          Destino (8 a 20 car., alfanumérico)
          <input
            maxLength={20}
            value={form.destino}
            onChange={(e) => handleChange("destino", e.target.value)}
            placeholder="Av 124 Laureles B"
          />
        </label>

        <label>
          Peso paquete (kg)
          <input
            type="text"
            value={form.peso_kg}
            onChange={(e) => handleChange("peso_kg", e.target.value)}
            placeholder="1.5"
          />
        </label>

        <label>
          Contenido / Descripción
          <input
            value={form.contenido}
            onChange={(e) => handleChange("contenido", e.target.value)}
            placeholder="Libros y documentos"
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={loading}>
            Subir envío (POST)
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={loading}
            onClick={() => void registrarYSimular(true)}
          >
            Simular enviar paquete
          </button>
        </div>
      </form>

      <div className="rules-box">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={forzarEnvio}
            onChange={(e) => setForzarEnvio(e.target.checked)}
          />
          Forzar envío/simulación aunque falle una regla local (para probar respuestas del backend)
        </label>
        {warnings.length > 0 && (
          <ul className="warnings-list">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Línea</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Peso</th>
              <th>Contenido</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {envios.length === 0 ? (
              <tr>
                <td colSpan={8}>No hay envíos registrados todavía.</td>
              </tr>
            ) : (
              envios.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="mono">{item.codigo || item.id || "-"}</td>
                  <td>{item.linea_negocio || "-"}</td>
                  <td>{item.origen || "-"}</td>
                  <td>{item.destino}</td>
                  <td>{item.peso_kg} kg</td>
                  <td>{item.contenido || item.descripcion || "-"}</td>
                  <td>{item.estado || "REGISTRADO"}</td>
                  <td className="actions-cell">
                    {item.id && (
                      <button type="button" onClick={() => void avanzarEstadoSimulado(item)}>
                        Simular paso
                      </button>
                    )}
                    <button type="button" className="danger-btn" onClick={() => void handleDelete(item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}