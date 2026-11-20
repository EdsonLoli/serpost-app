export interface ClienteRequest {
  tipo_documento: 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';
  numero_documento: string;
  nombres: string;
  direccion: string;
  telefono: string;
  correo: string;
  rol: 'remitente' | 'destinatario';
}

export interface ClienteResponse {
  id_cliente: string;
  estado: string;
}

export interface ClienteDetails extends ClienteRequest {
  id_cliente: string;
}

export interface ApiResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
}

export interface BackendTestResult {
  name: string;
  description: string;
  passed: boolean;
  status: number | null;
  durationMs: number;
  expected: string;
  response: string;
}

declare global {
  interface Window {
    serpostApi: {
      request: (request: {
        baseUrl: string;
        token: string;
        path: string;
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: unknown;
      }) => Promise<ApiResponse>;
    };
  }
}
