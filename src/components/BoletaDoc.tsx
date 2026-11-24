export interface DatosCotizacion {
  codigoEnvio: string;
  numeroBoleta: string;
  codigoGuia: string;
  fecha: string;
  cliente: string;
  documento: string;
  origen: string;
  destino: string;
  pesoKg: number;
  lineaNegocio: string;
  idaYVuelta: boolean;
  subtotal: number;
  igv: number;
  total: number;
}

interface BoletaDocProps {
  cotizacion: DatosCotizacion;
  onContinuarAGuia: () => void;
}

export function BoletaDoc({ cotizacion, onContinuarAGuia }: BoletaDocProps) {
  return (
    <article className="panel doc-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Comprobante de tarifa</p>
          <h2>Boleta N° {cotizacion.numeroBoleta}</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={onContinuarAGuia}
        >
          Continuar a Guía
        </button>
      </div>

      <div className="grid-form">
        <p><strong>Cliente:</strong> {cotizacion.cliente} ({cotizacion.documento})</p>
        <p><strong>Fecha:</strong> {cotizacion.fecha}</p>
        <p><strong>Ruta:</strong> {cotizacion.origen} → {cotizacion.destino}</p>
        <p>
          <strong>Servicio:</strong> {cotizacion.lineaNegocio} ({cotizacion.pesoKg} kg)
          {cotizacion.idaYVuelta ? " · Ida y vuelta" : ""}
        </p>
      </div>

      <div className="rule-checker">
        <p>Subtotal: <strong>S/ {cotizacion.subtotal.toFixed(2)}</strong></p>
        <p>IGV: <strong>S/ {cotizacion.igv.toFixed(2)}</strong></p>
        <p>Total: <strong>S/ {cotizacion.total.toFixed(2)}</strong></p>
      </div>
    </article>
  );
}