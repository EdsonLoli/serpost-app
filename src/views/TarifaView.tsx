import { useState } from "react";

interface TarifaViewProps {
  baseUrl: string;
  token: string;
}

type TipoServicio = "ESTANDAR" | "EXPRESS" | "CARGO";
type ZonaEnvio = "LOCAL" | "NACIONAL" | "EXTREMA";

export function TarifaView({ baseUrl, token }: TarifaViewProps) {
  const [pesoKg, setPesoKg] = useState("2.5");
  const [maxPesoKg, setMaxPesoKg] = useState("30");
  const [servicio, setServicio] = useState<TipoServicio>("ESTANDAR");
  const [zona, setZona] = useState<ZonaEnvio>("NACIONAL");
  const [destino, setDestino] = useState("Lima Cercado 101");
  const [incluirIgv, setIncluirIgv] = useState(true);
  const [apiMsg, setApiMsg] = useState("");

  const pesoNormalizado = Number(String(pesoKg).replace(",", "."));
  const maxNormalizado = Number(String(maxPesoKg).replace(",", "."));

  const pesoValido =
    !Number.isNaN(pesoNormalizado) &&
    pesoNormalizado > 0 &&
    (Number.isNaN(maxNormalizado) || maxNormalizado <= 0 || pesoNormalizado <= maxNormalizado);

  const tarifaBaseMap: Record<TipoServicio, number> = {
    ESTANDAR: 10,
    EXPRESS: 18,
    CARGO: 25,
  };

  const costoKgMap: Record<TipoServicio, number> = {
    ESTANDAR: 3.5,
    EXPRESS: 6.0,
    CARGO: 4.5,
  };

  const multiplicadorZonaMap: Record<ZonaEnvio, number> = {
    LOCAL: 1.0,
    NACIONAL: 1.25,
    EXTREMA: 1.5,
  };

  const subtotal = pesoValido
    ? Number(
        (
          (tarifaBaseMap[servicio] + pesoNormalizado * costoKgMap[servicio]) *
          multiplicadorZonaMap[zona]
        ).toFixed(2)
      )
    : 0;

  const igv = incluirIgv ? Number((subtotal * 0.18).toFixed(2)) : 0;
  const total = Number((subtotal + igv).toFixed(2));

  async function consultarTarifaBackend() {
    setApiMsg("");
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/tarifas?peso=${encodeURIComponent(String(pesoNormalizado))}&zona=${encodeURIComponent(zona)}&servicio=${encodeURIComponent(servicio)}`,
      method: "GET",
    });
    if (res.ok) {
      setApiMsg(`Backend respondió HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    } else {
      setApiMsg(`Cálculo local aplicado (endpoint /tarifas devolvió HTTP ${res.status}).`);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Cotizador de Envíos y Reglas de Peso</p>
          <h1>Calculadora de Tarifa</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => void consultarTarifaBackend()}>
          Consultar /tarifas (GET)
        </button>
      </div>

      {apiMsg && <div className="notice success">{apiMsg}</div>}

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
            checked={incluirIgv}
            onChange={(e) => setIncluirIgv(e.target.checked)}
          />
          Incluir IGV (18%)
        </label>
      </div>

      <div className="rule-checker">
        <strong>Resultado del cálculo:</strong>
        <div className="inline-inputs">
          <span className={pesoValido ? "badge ok" : "badge err"}>
            {pesoValido ? "Peso válido" : "Peso inválido o excede límite"}
          </span>
          <span>Subtotal: <strong>S/ {subtotal.toFixed(2)}</strong></span>
          <span>IGV: <strong>S/ {igv.toFixed(2)}</strong></span>
          <span>Total estimado: <strong>S/ {total.toFixed(2)}</strong></span>
        </div>
      </div>
    </section>
  );
}