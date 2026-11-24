import { useState } from "react";
import type { DatosCotizacion } from "./BoletaDoc";

export type EstadoGuia = "COTIZADO" | "EN_TRANSITO" | "EN_REPARTO" | "ENTREGADO";

interface EventoSeguimiento {
  estado: EstadoGuia;
  ubicacion: string;
  detalle: string;
  fechaHora: string;
}

interface GuiaSeguimientoDocProps {
  cotizacion: DatosCotizacion;
  baseUrl?: string;
  token?: string;
  onVolverABoleta?: () => void;
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

export function GuiaSeguimientoDoc({
  cotizacion,
  baseUrl,
  token,
  onVolverABoleta,
}: GuiaSeguimientoDocProps) {
  const [pasoIdx, setPasoIdx] = useState(0);
  const [simulando, setSimulando] = useState(false);
  const [historial, setHistorial] = useState<EventoSeguimiento[]>([
    {
      ...SECUENCIA_SIMULACION[0],
      ubicacion: cotizacion.origen || SECUENCIA_SIMULACION[0].ubicacion,
      fechaHora: formatearFechaHora(),
    },
  ]);

  const ultimoPasoIdx = SECUENCIA_SIMULACION.length - 1;
  const estadoActual = SECUENCIA_SIMULACION[pasoIdx].estado;
  const estaEntregado = pasoIdx >= ultimoPasoIdx || estadoActual === "ENTREGADO";

  async function simularSiguientePaso() {
    if (estaEntregado || simulando) return;

    setSimulando(true);
    const nextIdx = Math.min(pasoIdx + 1, ultimoPasoIdx);
    const paso = SECUENCIA_SIMULACION[nextIdx];
    const ubicacionFinal =
      nextIdx === ultimoPasoIdx
        ? cotizacion.destino || paso.ubicacion
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
        // Si el backend no responde al PUT, continúa la simulación local
      }
    }

    setPasoIdx(nextIdx);
    setHistorial((prev) => [
      {
        estado: paso.estado,
        ubicacion: ubicacionFinal,
        detalle: paso.detalle,
        fechaHora: formatearFechaHora(),
      },
      ...prev,
    ]);
    setSimulando(false);
  }

  function reiniciarSimulacion() {
    setPasoIdx(0);
    setHistorial([
      {
        ...SECUENCIA_SIMULACION[0],
        ubicacion: cotizacion.origen || SECUENCIA_SIMULACION[0].ubicacion,
        fechaHora: formatearFechaHora(),
      },
    ]);
  }

  return (
    <article className="panel doc-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Continuidad de Boleta N° {cotizacion.numeroBoleta}</p>
          <h2>Guía de Seguimiento · {cotizacion.codigoGuia}</h2>
        </div>

        <div className="inline-inputs">
          {onVolverABoleta && (
            <button
              type="button"
              className="secondary-button"
              onClick={onVolverABoleta}
            >
              Volver a Boleta
            </button>
          )}
          <span className="badge ok">{estadoActual}</span>
          <button
            type="button"
            className="primary-button"
            disabled={simulando || estaEntregado}
            onClick={() => void simularSiguientePaso()}
          >
            {estaEntregado
              ? "Envío entregado"
              : simulando
                ? "Simulando..."
                : "Simular siguiente estado"}
          </button>
          {estaEntregado && (
            <button
              type="button"
              className="secondary-button"
              onClick={reiniciarSimulacion}
            >
              Reiniciar simulación
            </button>
          )}
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
            <li key={`${ev.estado}-${ev.fechaHora}-${i}`}>
              <strong>[{ev.fechaHora}] {ev.estado}</strong> — {ev.ubicacion}: {ev.detalle}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}