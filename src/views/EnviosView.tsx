import { useEffect, useMemo, useState } from "react";

interface EnviosViewProps {
  baseUrl: string;
  token: string;
}

type EstadoEnvio = "REGISTRADO" | "EN_TRANSITO" | "ENTREGADO" | "RECHAZADO";

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
  remitente: string;
  destinatario: string;
  destino: string;
  peso_kg: number;
  descripcion: string;
  estado?: EstadoEnvio | string;
  simulacion_log?: string;
}

interface EnvioFormState {
  codigo: string;
  remitente: string;
  destinatario: string;
  destino: string;
  peso_kg: string;
  descripcion: string;
}

const EMPTY_ENVIO: EnvioFormState = {
  codigo: "",
  remitente: "",
  destinatario: "",
  destino: "",
  peso_kg: "1.5",
  descripcion: "",
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

function parsePeso(val: string): number {
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

export function EnviosView({ baseUrl, token }: EnviosViewProps) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [buscarRemitente, setBuscarRemitente] = useState("");
  const [buscarDestinatario, setBuscarDestinatario] = useState("");
  const [prohibidos, setProhibidos] = useState<string[]>(PROHIBIDOS_BASE);
  const [form, setForm] = useState<EnvioFormState>(EMPTY_ENVIO);
  const [maxPesoKg, setMaxPesoKg] = useState("30");
  const [forzarEnvio, setForzarEnvio] = useState(false);
  const [simulacionEstado, setSimulacionEstado] = useState<string>("");
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
      // Ignora si no hay clientes cargados aún
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
      errs.push("Código: 4 a 25 caracteres alfanuméricos o guion (ej. ENV-001).");
    }

    const rem = data.remitente.trim();
    if (!rem || rem.length < 3 || esTextoBasura(rem)) {
      errs.push("Remitente: obligatorio y válido (sin texto basura).");
    }

    const destCliente = data.destinatario.trim();
    if (!destCliente || destCliente.length < 3 || esTextoBasura(destCliente)) {
      errs.push("Destinatario: obligatorio y válido (sin texto basura).");
    }

    const dir = data.destino.trim();
    if (dir.length < 8 || dir.length > 20) {
      errs.push("Dirección destino: debe tener entre 8 y 20 caracteres.");
    } else if (!/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s]+$/.test(dir)) {
      errs.push("Dirección destino: solo formato alfanumérico y espacios (sin signos especiales).");
    } else if (esTextoBasura(dir) || !/[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(dir)) {
      errs.push("Dirección destino: bloqueada por filtro antibasura.");
    }

    const peso = parsePeso(data.peso_kg);
    const maxP = parsePeso(limite);
    if (Number.isNaN(peso) || peso <= 0) {
      errs.push("Peso (kg): debe ser mayor que 0.");
    } else if (!Number.isNaN(maxP) && maxP > 0 && peso > maxP) {
      errs.push(`Peso (kg): excede el límite máximo de ${maxP} kg.`);
    }

    const desc = data.descripcion.trim();
    const descLower = desc.toLowerCase();
    if (!desc || desc.length < 3 || esTextoBasura(desc)) {
      errs.push("Contenido/descripción: obligatorio y sin texto basura.");
    } else {
      const prohibido = prohibidos.find((palabra) => descLower.includes(palabra));
      if (prohibido) {
        errs.push(`Contenido prohibido: se detectó "${prohibido}".`);
      }
    }

    return errs;
  }

  function handleChange(field: keyof EnvioFormState, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    setWarnings(validarReglasEnvio(next, maxPesoKg));
  }

  function seleccionarRemitente(cliente: ClienteItem) {
    const nombre = (cliente.nombres || "").trim();
    if (!nombre) return;
    handleChange("remitente", nombre);
    setBuscarRemitente(nombre);
  }

  function seleccionarDestinatario(cliente: ClienteItem) {
    const nombre = (cliente.nombres || "").trim();
    if (!nombre) return;
    const next: EnvioFormState = {
      ...form,
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

    const pesoNum = parsePeso(form.peso_kg);
    const maxNum = parsePeso(maxPesoKg);
    const tarifaEstimada = Number.isNaN(pesoNum)
      ? 10
      : Math.max(10, Math.round((10 + pesoNum * 3.5) * 100) / 100);

    const payload: Envio = {
      codigo: form.codigo.trim().toUpperCase(),
      remitente: form.remitente.trim(),
      destinatario: form.destinatario.trim(),
      destino: form.destino.trim(),
      peso_kg: pesoNum,
      descripcion: form.descripcion.trim(),
      estado: errs.length > 0 ? "RECHAZADO" : modoSimulacion ? "EN_TRANSITO" : "REGISTRADO",
      simulacion_log: modoSimulacion
        ? `Despachado a ${form.destino.trim()} (${pesoNum} kg / máx ${maxNum || 30} kg) - Tarifa sim. S/ ${tarifaEstimada}`
        : "Registrado en agencia",
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
          ? `Paquete simulado y enviado (HTTP ${res.status}) · Tarifa estimada S/ ${tarifaEstimada}.`
          : `Envío registrado (HTTP ${res.status}).`
      );
      if (modoSimulacion) {
        setSimulacionEstado(
          `SIMULACIÓN EXITOSA: ${payload.codigo} -> ${payload.estado} (${payload.destino}, ${payload.peso_kg} kg).`
        );
      }
      setForm(EMPTY_ENVIO);
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
          {loading ? "Cargando..." : "Actualizar envíos (GET)"}
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
          <span className="badge ok">
            Prohibidos activos: {prohibidos.length} términos
          </span>
          <span className="badge ok">
            Clientes cargados: {clientes.length}
          </span>
        </div>
      </div>

      <div className="grid-form">
        <label>
          Buscador de remitente (nombre o DNI/RUC)
          <input
            value={buscarRemitente}
            onChange={(e) => setBuscarRemitente(e.target.value)}
            placeholder="Buscar remitente..."
          />
          <select
            value=""
            onChange={(e) => {
              const found = clientes.find((c, idx) => (c.id || String(idx)) === e.target.value);
              if (found) seleccionarRemitente(found);
            }}
          >
            <option value="">-- Seleccionar remitente ({remitentesFiltrados.length}) --</option>
            {remitentesFiltrados.map((c, idx) => (
              <option key={c.id || idx} value={c.id || String(idx)}>
                {c.nombres} ({c.tipo_documento || "DOC"} {c.numero_documento || "-"})
              </option>
            ))}
          </select>
        </label>

        <label>
          Buscador de destinatario (nombre o DNI/RUC)
          <input
            value={buscarDestinatario}
            onChange={(e) => setBuscarDestinatario(e.target.value)}
            placeholder="Buscar destinatario..."
          />
          <select
            value=""
            onChange={(e) => {
              const found = clientes.find((c, idx) => (c.id || String(idx)) === e.target.value);
              if (found) seleccionarDestinatario(found);
            }}
          >
            <option value="">-- Seleccionar destinatario ({destinatariosFiltrados.length}) --</option>
            {destinatariosFiltrados.map((c, idx) => (
              <option key={c.id || idx} value={c.id || String(idx)}>
                {c.nombres} ({c.tipo_documento || "DOC"} {c.numero_documento || "-"})
              </option>
            ))}
          </select>
        </label>
      </div>

      <form
        className="grid-form"
        onSubmit={(e) => {
          e.preventDefault();
          void registrarYSimular(false);
        }}
      >
        <label>
          Código de paquete
          <input
            value={form.codigo}
            onChange={(e) => handleChange("codigo", e.target.value)}
            placeholder="ENV-2026-001"
          />
        </label>

        <label>
          Remitente
          <input
            value={form.remitente}
            onChange={(e) => handleChange("remitente", e.target.value)}
            placeholder="Ana Perez Quispe"
          />
        </label>

        <label>
          Destinatario
          <input
            value={form.destinatario}
            onChange={(e) => handleChange("destinatario", e.target.value)}
            placeholder="Carlos Ramos Diaz"
          />
        </label>

        <label>
          Destino (8 a 20 car., alfanumérico)
          <input
            maxLength={20}
            value={form.destino}
            onChange={(e) => handleChange("destino", e.target.value)}
            placeholder="Jr Leon Prado 450"
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
            value={form.descripcion}
            onChange={(e) => handleChange("descripcion", e.target.value)}
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
              <th>Remitente</th>
              <th>Destinatario</th>
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
                  <td>{item.remitente}</td>
                  <td>{item.destinatario}</td>
                  <td>{item.destino}</td>
                  <td>{item.peso_kg} kg</td>
                  <td>{item.descripcion}</td>
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