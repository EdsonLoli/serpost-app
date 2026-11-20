import { useEffect, useState } from "react";

interface ClientesViewProps {
  baseUrl: string;
  token: string;
}

interface Cliente {
  id?: string;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  direccion: string;
  telefono: string;
  correo: string;
  rol: string;
}

const EMPTY_CLIENTE: Cliente = {
  tipo_documento: "DNI",
  numero_documento: "",
  nombres: "",
  direccion: "",
  telefono: "",
  correo: "",
  rol: "remitente",
};

function validarReglasCliente(c: Cliente): string[] {
  const errores: string[] = [];
  if (!c.nombres.trim() || c.nombres.trim().length > 100) {
    errores.push("Nombres: obligatorio y máximo 100 caracteres.");
  }
  if (!c.direccion.trim() || c.direccion.trim().length > 150) {
    errores.push("Dirección: obligatoria y máxima 150 caracteres.");
  }
  if (!/^9\d{8}$/.test(c.telefono.trim())) {
    errores.push("Teléfono: debe tener exactamente 9 dígitos y empezar con 9.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.correo.trim()) || c.correo.length > 120) {
    errores.push("Correo: formato inválido o supera 120 caracteres.");
  }
  const doc = c.numero_documento.trim();
  if (c.tipo_documento === "DNI" && !/^\d{8}$/.test(doc)) {
    errores.push("DNI: debe tener exactamente 8 dígitos.");
  } else if (c.tipo_documento === "RUC" && !/^\d{11}$/.test(doc)) {
    errores.push("RUC: debe tener exactamente 11 dígitos.");
  } else if (!doc || doc.length > 20) {
    errores.push("Número de documento: obligatorio y máximo 20 caracteres.");
  }
  return errores;
}

export function ClientesView({ baseUrl, token }: ClientesViewProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState<Cliente>(EMPTY_CLIENTE);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [ruleWarnings, setRuleWarnings] = useState<string[]>([]);
  const [bypassRules, setBypassRules] = useState(false);

  async function cargarClientes() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: "/clientes",
        method: "GET",
      });
      if (res.ok && Array.isArray(res.data)) {
        setClientes(res.data);
      } else {
        setErrorMsg(res.error || `Error GET /clientes (HTTP ${res.status})`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarClientes();
  }, [baseUrl]);

  function handleChange(field: keyof Cliente, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    setRuleWarnings(validarReglasCliente(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    const warnings = validarReglasCliente(form);
    setRuleWarnings(warnings);
    if (!bypassRules && warnings.length > 0) {
      setErrorMsg("Corrige las reglas o activa 'Enviar igual para probar respuesta del backend (400)'.");
      return;
    }

    setLoading(true);
    const isEdit = Boolean(editId);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: isEdit ? `/clientes/${encodeURIComponent(editId!)}` : "/clientes",
      method: isEdit ? "PUT" : "POST",
      body: form,
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(
        isEdit
          ? `Cliente actualizado (HTTP ${res.status}).`
          : `Cliente creado (HTTP ${res.status}).`
      );
      setForm(EMPTY_CLIENTE);
      setEditId(null);
      await cargarClientes();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "Error en la operación"}`);
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
      path: `/clientes/${encodeURIComponent(id)}`,
      method: "DELETE",
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(`Cliente eliminado (HTTP ${res.status}).`);
      await cargarClientes();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo eliminar"}`);
    }
  }

  function startEdit(c: Cliente) {
    setEditId(c.id || null);
    setForm({
      tipo_documento: c.tipo_documento || "DNI",
      numero_documento: c.numero_documento || "",
      nombres: c.nombres || "",
      direccion: c.direccion || "",
      telefono: c.telefono || "",
      correo: c.correo || "",
      rol: c.rol || "remitente",
    });
    setRuleWarnings(validarReglasCliente(c));
    setStatusMsg("");
    setErrorMsg("");
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Gestión CRUD + Reglas</p>
          <h1>Clientes ({clientes.length})</h1>
        </div>
        <button className="primary-button" type="button" onClick={cargarClientes} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar lista (GET)"}
        </button>
      </div>

      {statusMsg && <div className="notice success">{statusMsg}</div>}
      {errorMsg && <div className="notice error">{errorMsg}</div>}

      <form className="grid-form" onSubmit={handleSubmit}>
        <label>
          Tipo documento
          <select value={form.tipo_documento} onChange={(e) => handleChange("tipo_documento", e.target.value)}>
            <option value="DNI">DNI (8 dígitos)</option>
            <option value="RUC">RUC (11 dígitos)</option>
            <option value="CE">CE</option>
          </select>
        </label>

        <label>
          N° documento
          <input
            value={form.numero_documento}
            onChange={(e) => handleChange("numero_documento", e.target.value)}
            placeholder="44571480"
          />
        </label>

        <label>
          Nombres (máx 100)
          <input
            maxLength={120}
            value={form.nombres}
            onChange={(e) => handleChange("nombres", e.target.value)}
            placeholder="Ana Pérez"
          />
        </label>

        <label>
          Teléfono (9 dígitos, inicia en 9)
          <input
            maxLength={15}
            value={form.telefono}
            onChange={(e) => handleChange("telefono", e.target.value)}
            placeholder="987654321"
          />
        </label>

        <label>
          Dirección (máx 150)
          <input
            maxLength={170}
            value={form.direccion}
            onChange={(e) => handleChange("direccion", e.target.value)}
            placeholder="Av. Pacífico 123"
          />
        </label>

        <label>
          Correo
          <input
            value={form.correo}
            onChange={(e) => handleChange("correo", e.target.value)}
            placeholder="cliente@correo.com"
          />
        </label>

        <label>
          Rol
          <select value={form.rol} onChange={(e) => handleChange("rol", e.target.value)}>
            <option value="remitente">remitente</option>
            <option value="destinatario">destinatario</option>
          </select>
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={loading}>
            {editId ? "Guardar cambios (PUT)" : "Registrar cliente (POST)"}
          </button>
          {editId && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditId(null);
                setForm(EMPTY_CLIENTE);
              }}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="rules-box">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={bypassRules}
            onChange={(e) => setBypassRules(e.target.checked)}
          />
          Enviar igual aunque falle una regla local (útil para probar respuestas 400 del backend)
        </label>
        {ruleWarnings.length > 0 && (
          <ul className="warnings-list">
            {ruleWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Documento</th>
              <th>Nombres</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={7}>No hay clientes cargados o la lista está vacía.</td>
              </tr>
            ) : (
              clientes.map((c, idx) => (
                <tr key={c.id || idx}>
                  <td className="mono">{c.id ? `${c.id.slice(0, 8)}...` : "-"}</td>
                  <td>{c.tipo_documento} {c.numero_documento}</td>
                  <td>{c.nombres}</td>
                  <td>{c.telefono}</td>
                  <td>{c.correo}</td>
                  <td>{c.rol}</td>
                  <td className="actions-cell">
                    <button type="button" onClick={() => startEdit(c)}>Editar</button>
                    <button type="button" className="danger-btn" onClick={() => handleDelete(c.id)}>
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
