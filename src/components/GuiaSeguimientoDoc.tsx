import { useState } from "react";
import type { DatosCotizacion } from "./BoletaDoc";

export type EstadoGuia = "COTIZADO" | "EN_TRANSITO" | "EN_REPARTO" | "ENTREGADO";

interface EventoSeguimiento {
  estado: EstadoGuia;
  ubicacion: string;
  detalle: string;
  hora: string;
}

interface GuiaSeguimientoDocProps {
  cotizacion: DatosCotizacion;
  baseUrl?: string;
  token?: string;
}

const SECUENCIA_SIMULACION: {
  estado: EstadoGuia;
  ubicacion: string;
  detalle: string;
}[] = [
  {
    estado: "COTIZADO",
    ubicacion: "Agencia origen",
    detalle: "Tarifa confirmada y guía emitida a partir de la boleta.",
  },
  {
    estado: "EN_TRANSITO",
    ubicacion: "Centro de clasificación",
    detalle: "Envío despachado en ruta hacia destino.",
  },
  {
    estado: "EN_REPARTO",
    ubicacion: "Agencia destino",
    detalle: "Unidad asignada para entrega final.",
  },
  {
    estado: "ENTREGADO",
    ubicacion: "Destino registrado",
    detalle: "Envío entregado conforme.",
  },
];

export function GuiaSeguimientoDoc({
  cotizacion,
  baseUrl,
  token,
}: GuiaSeguimientoDocProps) {
  const [pasoIdx, setPasoIdx] = useState(0);
  const [simulando, setSimulando] = useState(false);
  const [historial, setHistorial] = useState<EventoSeguimiento[]>([
    {
      ...SECUENCIA_SIMULACION[0],
      ubicacion: cotizacion.origen || SECUENCIA_SIMULACION[0].ubicacion,
      hora: new Date().toLocaleTimeString(),
    },
  ]);

  const estadoActual = SECUENCIA_SIMULACION[pasoIdx].estado;

  async function simularSiguientePaso() {
    setSimulando(true);
    const nextIdx = (pasoIdx + 1) % SECUENCIA_SIMULACION.length;
    const paso = SECUENCIA_SIMULACION[nextIdx];
    const ubicacionFinal =
      nextIdx === 0
        ? cotizacion.origen
        : nextIdx === SECUENCIA_SIMULACION.length - 1
          ? cotizacion.destino
          : paso.ubicacion;

    if (baseUrl && window.serpostApi?.request) {
      try {
        await window.serpostApi.request({
          baseUrl,
          token: token || "",
          path: `/envios/${encodeURIComponent(cotizacion.codigoEnvio)}`,
          method: "PUT",
          body: { estado: paso.estado },
        });
      } catch {
        // Si el backend local no expone PUT /envios/:codigo, la simulación local sigue funcionando
      }
    }

    setPasoIdx(nextIdx);
    setHistorial((prev) => [
      {
        estado: paso.estado,
        ubicacion: ubicacionFinal,
        detalle: paso.detalle,
        hora: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
    setSimulando(false);
  }

  return (
    <article className="panel doc-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Continuidad de Boleta N° {cotizacion.numeroBoleta}</p>
          <h2>Guía de Seguimiento · {cotizacion.codigoGuia}</h2>
        </div>

        <div className="inline-inputs">
          <span className="badge ok">{estadoActual}</span>
          <button
            type="button"
            className="primary-button"
            disabled={simulando}
            onClick={() => void simularSiguientePaso()}
          >
            {simulando ? "Simulando..." : "Simular siguiente estado"}
          </button>
        </div>
      </div>

      <div className="grid-form">
        <p><strong>Envío:</strong> {cotizacion.codigoEnvio}</p>
        <p><strong>Ruta:</strong> {cotizacion.origen} → {cotizacion.destino}</p>
      </div>

      <div className="rule-checker">
        <strong>Historial de seguimiento (simulación):</strong>
        <ul>
          {historial.map((ev, i) => (
            <li key={`${ev.estado}-${ev.hora}-${i}`}>
              <strong>[{ev.hora}] {ev.estado}</strong> — {ev.ubicacion}: {ev.detalle}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}