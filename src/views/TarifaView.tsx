import { useEffect, useMemo, useState } from "react";
import type { DatosCotizacion } from "../components/BoletaDoc";

interface TarifaViewProps {
  baseUrl: string;
  token: string;
  onTarifaGenerada?: (cotizacion: DatosCotizacion) => void;
}

type TipoServicio = "ESTANDAR" | "EXPRESS" | "CARGO";
type ZonaEnvio = "LOCAL" | "NACIONAL" | "EXTREMA";

interface EnvioItem {
  id?: string;
  codigo?: string;
  id_remitente?: string;
  id_destinatario?: string;
  remitente?: string;
  destinatario?: string;
  origen?: string;
  destino?: string;
  peso_kg?: number;
  contenido?: string;
  descripcion?: string;
  linea_negocio?: string;
  estado?: string;
  tarifa_total?: number;
  ida_vuelta?: boolean;
  servicio?: TipoServicio;
  zona?: ZonaEnvio;
}

const TARIFA_BASE: Record<TipoServicio, number> = {
  ESTANDAR: 10,
  EXPRESS: 18,
  CARGO: 25,
};

const COSTO_KG: Record<TipoServicio, number> = {
  ESTANDAR: 3.5,
  EXPRESS: 6.0,
  CARGO: 4.5,
};

const MULT_ZONA: Record<ZonaEnvio, number> = {
  LOCAL: 1.0,
  NACIONAL: 1.25,
  EXTREMA: 1.5,
};

function parseNum(val: string): number {
  return Number(String(val).trim().replace(",", "."));
}

function esPendiente(env: EnvioItem): boolean {
  const est = String(env.estado || "REGISTRADO").toUpperCase();
  if (est === "ENTREGADO" || est === "RECHAZADO") return false;
  return typeof env.tarifa_total !== "number" || est === "REGISTRADO" || est === "PENDIENTE";
}

export function TarifaView({ baseUrl, token, onTarifaGenerada }: TarifaViewProps) {
  const [envios, setEnvios] = useState<EnvioItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pesoKg, setPesoKg] = useState("2.5");
  const [maxPesoKg, setMaxPesoKg] = useState("30");
  const [servicio, setServicio] = useState<TipoServicio>("ESTANDAR");
  const [zona, setZona] = useState<ZonaEnvio>("NACIONAL");
  const [destino, setDestino] = useState("Lima Cercado 101");
  const [incluirIgv, setIncluirIgv] = useState(true);
  const [idaYVuelta, setIdaYVuelta] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
        const lista = res.data as EnvioItem[];
        setEnvios(lista);
        const pendientes = lista.filter(esPendiente);
        if (pendientes.length > 0 && !selectedId) {
          seleccionarEnvio(pendientes[0]);
        }
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

  useEffect(() => {
    void cargarEnvios();
  }, [baseUrl]);

  const enviosPendientes = useMemo(() => envios.filter(esPendiente), [envios]);

  const envioSeleccionado = useMemo(
    () => envios.find((e, idx) => (e.id || String(idx)) === selectedId) || null,
    [envios, selectedId]
  );

  function seleccionarEnvio(env: EnvioItem) {
    setSelectedId(env.id || "");
    if (typeof env.peso_kg === "number" && env.peso_kg > 0) {
      setPesoKg(String(env.peso_kg));
    }
    if (env.destino && env.destino.trim()) {
      setDestino(env.destino.trim());
    }
    if (typeof env.ida_vuelta === "boolean") {
      setIdaYVuelta(env.ida_vuelta);
    }
    setStatusMsg("");
    setErrorMsg("");
  }

  const calculo = useMemo(() => {
    const pesoNum = parseNum(pesoKg);
    const maxNum = parseNum(maxPesoKg);
    const valido =
      !Number.isNaN(pesoNum) &&
      pesoNum > 0 &&
      (Number.isNaN(maxNum) || maxNum <= 0 || pesoNum <= maxNum);

    if (!valido) {
      return { valido: false, subtotal: 0, igv: 0, total: 0 };
    }
    const factorSentido = idaYVuelta ? 2 : 1;
    const subtotal = Number(
      (
        (TARIFA_BASE[servicio] + pesoNum * COSTO_KG[servicio]) *
        MULT_ZONA[zona] *
        factorSentido
      ).toFixed(2)
    );
    const igv = incluirIgv ? Number((subtotal * 0.18).toFixed(2)) : 0;
    const total = Number((subtotal + igv).toFixed(2));
    return { valido: true, subtotal, igv, total };
  }, [pesoKg, maxPesoKg, servicio, zona, incluirIgv, idaYVuelta]);

  async function aplicarTarifaAEnvio() {
    setStatusMsg("");
    setErrorMsg("");

    if (!envioSeleccionado || !envioSeleccionado.id) {
      setErrorMsg("Selecciona un envío con ID válido para aplicarle la tarifa.");
      return;
    }
    if (!calculo.valido) {
      setErrorMsg("Revisa el peso y el límite máximo antes de aplicar la tarifa.");
      return;
    }

    const updatedPayload: EnvioItem = {
      ...envioSeleccionado,
      peso_kg: parseNum(pesoKg),
      destino: destino.trim() || envioSeleccionado.destino,
      servicio,
      zona,
      ida_vuelta: idaYVuelta,
      tarifa_total: calculo.total,
      estado: "COTIZADO",
    };

    setLoading(true);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/envios/${encodeURIComponent(envioSeleccionado.id)}`,
      method: "PUT",
      body: updatedPayload,
    });
    setLoading(false);

    if (res.ok) {
      const idBase = String(envioSeleccionado.codigo || envioSeleccionado.id);
      const idCorto = idBase.replace(/-/g, "").slice(0, 8).toUpperCase() || "000001";

      onTarifaGenerada?.({
        codigoEnvio: envioSeleccionado.id,
        numeroBoleta: `BOL-${idCorto}`,
        codigoGuia: `GUI-${idCorto}`,
        fecha: new Date().toLocaleDateString("es-PE"),
        cliente: String(
          envioSeleccionado.remitente || envioSeleccionado.id_remitente || "Cliente registrado"
        ),
        documento: String(
          envioSeleccionado.destinatario || envioSeleccionado.id_destinatario || "-"
        ),
        origen: String(envioSeleccionado.origen || ""),
        destino: String(destino.trim() || envioSeleccionado.destino || ""),
        pesoKg: parseNum(pesoKg),
        lineaNegocio: String(envioSeleccionado.linea_negocio || servicio),
        idaYVuelta,
        subtotal: calculo.subtotal,
        igv: calculo.igv,
        total: calculo.total,
      });

      setStatusMsg(
        `Tarifa S/ ${calculo.total.toFixed(2)} (${idaYVuelta ? "Ida y vuelta" : "Solo ida"}) aplicada a ${idBase} (COTIZADO).`
      );
      await cargarEnvios();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo aplicar la tarifa"}`);
    }
  }

  async function regresarAPendiente(env: EnvioItem | null) {
    setStatusMsg("");
    setErrorMsg("");

    if (!env || !env.id) {
      setErrorMsg("Selecciona un envío con ID válido para regresarlo a pendiente.");
      return;
    }

    const revertedPayload: EnvioItem = {
      ...env,
      estado: "REGISTRADO",
      tarifa_total: undefined,
      ida_vuelta: false,
    };

    setLoading(true);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/envios/${encodeURIComponent(env.id)}`,
      method: "PUT",
      body: revertedPayload,
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(
        `Envío ${env.codigo || env.id} regresado a estado REGISTRADO (pendiente).`
      );
      await cargarEnvios();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo regresar a pendiente"}`);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Cotizador, Ida/Vuelta y Reversión de Estado</p>
          <h1>Calculadora de Tarifa ({enviosPendientes.length} pendientes)</h1>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => void cargarEnvios()}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Actualizar lista (GET)"}
        </button>
      </div>

      {statusMsg && <div className="notice success">{statusMsg}</div>}
      {errorMsg && <div className="notice danger">{errorMsg}</div>}

      <div className="rule-checker">
        <strong>Selección y simulación de ambos lados:</strong>
        <div className="grid-form">
          <label>
            Seleccionar envío (pendientes o cotizados)
            <select
              value={selectedId}
              onChange={(e) => {
                const found = envios.find((item) => (item.id || "") === e.target.value);
                if (found) seleccionarEnvio(found);
                else setSelectedId("");
              }}
            >
              <option value="">-- Elegir envío ({envios.length} total / {enviosPendientes.length} pendientes) --</option>
              {envios.map((item, idx) => (
                <option key={item.id || idx} value={item.id || ""}>
                  {(item.codigo || item.id || `ENV-${idx + 1}`)} · {item.peso_kg ?? "-"} kg ·{" "}
                  {item.destino || "Sin destino"} [{item.estado || "REGISTRADO"}]
                </option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <button
              className="primary-button"
              type="button"
              disabled={loading || !envioSeleccionado?.id || !calculo.valido}
              onClick={() => void aplicarTarifaAEnvio()}
            >
              Aplicar tarifa (PUT)
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={loading || !envioSeleccionado?.id}
              onClick={() => void regresarAPendiente(envioSeleccionado)}
            >
              Regresar a pendiente
            </button>
          </div>
        </div>
      </div>

      <div className="grid-form">
        <label>
          Peso del paquete (kg)
          <input
            type="text"
            value={pesoKg}
            onChange={(e) => setPesoKg(e.target.value)}
            placeholder="2.5"
          />
        </label>

        <label>
          Límite máximo (kg)
          <input
            type="text"
            value={maxPesoKg}
            onChange={(e) => setMaxPesoKg(e.target.value)}
            placeholder="30"
          />
        </label>

        <label>
          Tipo de servicio
          <select value={servicio} onChange={(e) => setServicio(e.target.value as TipoServicio)}>
            <option value="ESTANDAR">Estándar (Base S/ 10 + S/ 3.50/kg)</option>
            <option value="EXPRESS">Express (Base S/ 18 + S/ 6.00/kg)</option>
            <option value="CARGO">Carga (Base S/ 25 + S/ 4.50/kg)</option>
          </select>
        </label>

        <label>
          Zona de envío
          <select value={zona} onChange={(e) => setZona(e.target.value as ZonaEnvio)}>
            <option value="LOCAL">Local (x1.00)</option>
            <option value="NACIONAL">Nacional (x1.25)</option>
            <option value="EXTREMA">Zona alejada / extrema (x1.50)</option>
          </select>
        </label>

        <label>
          Destino de referencia
          <input
            maxLength={20}
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Lima Cercado 101"
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={idaYVuelta}
            onChange={(e) => setIdaYVuelta(e.target.checked)}
          />
          Simular ida y vuelta (ambos lados x2)
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={incluirIgv}
            onChange={(e) => setIncluirIgv(e.target.checked)}
          />
          Incluir IGV (18%)
        </label>
      </div>

      <div className="rule-checker">
        <strong>Resultado del cálculo:</strong>
        <div className="inline-inputs">
          <span className={calculo.valido ? "badge ok" : "badge err"}>
            {calculo.valido ? "Peso válido" : "Peso inválido o excede límite"}
          </span>
          <span>Sentido: <strong>{idaYVuelta ? "Ida y vuelta (x2)" : "Solo ida (x1)"}</strong></span>
          <span>Subtotal: <strong>S/ {calculo.subtotal.toFixed(2)}</strong></span>
          <span>IGV: <strong>S/ {calculo.igv.toFixed(2)}</strong></span>
          <span>Total estimado: <strong>S/ {calculo.total.toFixed(2)}</strong></span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Destino</th>
              <th>Peso</th>
              <th>Estado</th>
              <th>Tarifa</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {envios.length === 0 ? (
              <tr>
                <td colSpan={6}>No hay envíos registrados.</td>
              </tr>
            ) : (
              envios.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="mono">{item.codigo || item.id || "-"}</td>
                  <td>{item.destino || "-"}</td>
                  <td>{item.peso_kg ?? "-"} kg</td>
                  <td>{item.estado || "REGISTRADO"}</td>
                  <td>
                    {typeof item.tarifa_total === "number"
                      ? `S/ ${item.tarifa_total.toFixed(2)}`
                      : "Pendiente"}
                  </td>
                  <td className="actions-cell">
                    <button type="button" onClick={() => seleccionarEnvio(item)}>
                      Cargar
                    </button>
                    {item.id && (
                      <button type="button" onClick={() => void regresarAPendiente(item)}>
                        Regresar
                      </button>
                    )}
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