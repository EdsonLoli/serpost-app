import { useEffect, useState, type FormEvent } from 'react';
import type {
  ApiResponse,
  BackendTestResult,
  ClienteDetails,
  ClienteRequest,
  ClienteResponse,
} from './types';

const EMPTY_CLIENTE: ClienteRequest = {
  tipo_documento: 'DNI',
  numero_documento: '',
  nombres: '',
  direccion: '',
  telefono: '',
  correo: '',
  rol: 'remitente',
};

function readSetting(key: string, fallback: string) {
  return localStorage.getItem(key) || fallback;
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState(() => readSetting('serpost_api_url', 'http://localhost:8080'));
  const [token, setToken] = useState(() => readSetting('serpost_api_token', ''));
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'nuevo' | 'buscar' | 'editar'>('nuevo');
  const [cliente, setCliente] = useState<ClienteRequest>(EMPTY_CLIENTE);
  const [clienteId, setClienteId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<'clientes' | 'pruebas'>('clientes');
  const [testsRunning, setTestsRunning] = useState(false);
  const [testResults, setTestResults] = useState<BackendTestResult[]>([]);

  useEffect(() => {
    localStorage.setItem('serpost_api_url', baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    localStorage.setItem('serpost_api_token', token);
  }, [token]);

  function clearFeedback() {
    setMessage('');
    setError('');
  }

  function updateField<K extends keyof ClienteRequest>(key: K, value: ClienteRequest[K]) {
    setCliente((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    clearFeedback();
    setCliente(EMPTY_CLIENTE);
    setClienteId('');
    setMode('nuevo');
  }

  async function registrar(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    const response = await window.serpostApi.request({
      baseUrl,
      token,
      path: '/clientes',
      method: 'POST',
      body: cliente,
    });
    setBusy(false);

    if (!response.ok) {
      setError(response.error || 'No se pudo registrar el cliente.');
      return;
    }

    const data = response.data as ClienteResponse;
    setClienteId(data.id_cliente);
    setMode('editar');
    setMessage(`Cliente registrado correctamente. ID: ${data.id_cliente}`);
  }

  async function buscar(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    if (!clienteId.trim()) {
      setError('Ingrese el ID de cliente.');
      return;
    }

    setBusy(true);
    const response = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/clientes/${encodeURIComponent(clienteId.trim())}`,
      method: 'GET',
    });
    setBusy(false);

    if (!response.ok) {
      setError(response.error || 'No se encontro el cliente.');
      return;
    }

    const data = response.data as ClienteDetails;
    setCliente({
      tipo_documento: data.tipo_documento as ClienteRequest['tipo_documento'],
      numero_documento: data.numero_documento,
      nombres: data.nombres,
      direccion: data.direccion,
      telefono: data.telefono,
      correo: data.correo,
      rol: data.rol as ClienteRequest['rol'],
    });
    setMode('editar');
    setMessage('Datos del cliente cargados.');
  }

  async function actualizar(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    if (!clienteId.trim()) {
      setError('Busque o registre un cliente antes de actualizar.');
      return;
    }

    setBusy(true);
    const response = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/clientes/${encodeURIComponent(clienteId.trim())}`,
      method: 'PUT',
      body: cliente,
    });
    setBusy(false);

    if (!response.ok) {
      setError(response.error || 'No se pudo actualizar el cliente.');
      return;
    }
    setMessage('Cliente actualizado correctamente.');
  }

  async function ejecutarPrueba(
    name: string,
    description: string,
    expected: string,
    operation: () => Promise<ApiResponse>,
  ): Promise<BackendTestResult> {
    const startedAt = performance.now();
    try {
      const response = await operation();
      const passed = response.status !== 0 && expected === String(response.status);
      const durationMs = Math.round(performance.now() - startedAt);
      let responseText = '';
      if (typeof response.data === 'string') {
        responseText = response.data;
      } else if (response.data !== null) {
        responseText = JSON.stringify(response.data, null, 2);
      } else {
        responseText = response.error || 'Sin cuerpo de respuesta';
      }

      return {
        name,
        description,
        passed,
        status: response.status || null,
        durationMs,
        expected,
        response: responseText,
      };
    } catch (caught) {
      return {
        name,
        description,
        passed: false,
        status: null,
        durationMs: Math.round(performance.now() - startedAt),
        expected,
        response: caught instanceof Error ? caught.message : 'La prueba produjo un error.',
      };
    }
  }

  async function ejecutarPruebasBackend() {
    clearFeedback();
    setTestsRunning(true);
    setTestResults([]);
    const suffix = `${Date.now()}`;

    const results: BackendTestResult[] = [];
    const registrar = (result: BackendTestResult) => {
      results.push(result);
      setTestResults([...results]);
    };

    registrar(await ejecutarPrueba(
      'Autenticacion requerida',
      'GET a un cliente sin Bearer debe ser rechazado.',
      '401',
      () => window.serpostApi.request({
        baseUrl,
        token: '',
        path: '/clientes/00000000-0000-0000-0000-000000000001',
        method: 'GET',
      }),
    ));

    const clientePrueba: ClienteRequest = {
      tipo_documento: 'DNI',
      numero_documento: `4${suffix.slice(-7)}`,
      nombres: 'Ana Perez Prueba',
      direccion: 'Calle Principal 123',
      telefono: '912345678',
      correo: `ana.${suffix}@example.com`,
      rol: 'remitente',
    };

    const registro = await ejecutarPrueba(
      'Registrar cliente',
      'POST /clientes debe crear un cliente y devolver 201.',
      '201',
      () => window.serpostApi.request({
        baseUrl,
        token,
        path: '/clientes',
        method: 'POST',
        body: clientePrueba,
      }),
    );
    registrar(registro);

    if (registro.status === 201) {
      let idCliente = '';
      try {
        const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(registro.response);
        idCliente = match?.[1] || '';
      } catch {
        idCliente = '';
      }

      if (idCliente) {
        registrar(await ejecutarPrueba(
          'Consultar cliente',
          'GET /clientes/{id_cliente} debe devolver los datos registrados.',
          '200',
          () => window.serpostApi.request({
            baseUrl,
            token,
            path: `/clientes/${idCliente}`,
            method: 'GET',
          }),
        ));

        const actualizacion: ClienteRequest = {
          ...clientePrueba,
          nombres: 'Ana Perez Actualizada',
          direccion: 'Avenida Central 10',
          telefono: '',
          rol: 'destinatario',
        };
        registrar(await ejecutarPrueba(
          'Actualizar cliente',
          'PUT /clientes/{id_cliente} debe actualizar los datos.',
          '200',
          () => window.serpostApi.request({
            baseUrl,
            token,
            path: `/clientes/${idCliente}`,
            method: 'PUT',
            body: actualizacion,
          }),
        ));
      } else {
        registrar({
          name: 'Consultar y actualizar',
          description: 'La respuesta de registro no contenia un UUID valido.',
          passed: false,
          status: null,
          durationMs: 0,
          expected: 'UUID valido',
          response: registro.response,
        });
      }
    }

    const duplicadoResult = await ejecutarPrueba(
      'Documento duplicado',
      'Registrar dos veces el mismo documento debe devolver 409.',
      '409',
      () => window.serpostApi.request({
        baseUrl,
        token,
        path: '/clientes',
        method: 'POST',
        body: clientePrueba,
      }),
    );
    registrar(duplicadoResult);

    registrar(await ejecutarPrueba(
      'Validacion de campos',
      'POST sin datos obligatorios debe devolver 400.',
      '400',
      () => window.serpostApi.request({
        baseUrl,
        token,
        path: '/clientes',
        method: 'POST',
        body: { tipo_documento: 'DNI' },
      }),
    ));

    setTestsRunning(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">SP</div>
          <div>
            <strong>SERPOST SOA</strong>
            <span>Gestion de clientes</span>
          </div>
        </div>
        <div className="header-actions">
          <nav className="app-nav" aria-label="Navegacion principal">
            <button
              className={activeView === 'clientes' ? 'nav-button active' : 'nav-button'}
              type="button"
              onClick={() => setActiveView('clientes')}
            >
              Clientes
            </button>
            <button
              className={activeView === 'pruebas' ? 'nav-button active' : 'nav-button'}
              type="button"
              onClick={() => setActiveView('pruebas')}
            >
              Pruebas del backend
            </button>
          </nav>
          <button className="settings-button" type="button" onClick={() => setShowSettings(true)}>
            Configuracion
          </button>
        </div>
      </header>

      <main className="content">
        {activeView === 'clientes' ? (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Modulo operativo</p>
                <h1>Registro de clientes</h1>
              </div>
              <button className="secondary-button" type="button" onClick={reset}>Nuevo registro</button>
            </div>

            <section className="lookup-card">
              <form onSubmit={buscar} className="lookup-form">
                <div className="field field-wide">
                  <label htmlFor="cliente-id">ID del cliente (UUID)</label>
                  <input
                    id="cliente-id"
                    value={clienteId}
                    onChange={(event) => setClienteId(event.target.value)}
                    placeholder="Ejemplo: 67b1d5ac-..."
                  />
                </div>
                <button className="primary-button" type="submit" disabled={busy}>Buscar</button>
              </form>
            </section>

            {message && <div className="notice success">{message}</div>}
            {error && <div className="notice danger">{error}</div>}

            <form className="client-card" onSubmit={mode === 'editar' ? actualizar : registrar}>
              <div className="form-section">
                <h2>Datos personales</h2>
                <div className="grid two-columns">
                  <div className="field">
                    <label htmlFor="tipo">Tipo de documento</label>
                    <select id="tipo" value={cliente.tipo_documento} onChange={(event) => updateField('tipo_documento', event.target.value as ClienteRequest['tipo_documento'])}>
                      <option value="DNI">DNI</option>
                      <option value="RUC">RUC</option>
                      <option value="CE">CE</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="documento">Numero de documento</label>
                    <input id="documento" required value={cliente.numero_documento} onChange={(event) => updateField('numero_documento', event.target.value)} />
                  </div>
                  <div className="field span-two">
                    <label htmlFor="nombres">Nombres completos</label>
                    <input id="nombres" required value={cliente.nombres} onChange={(event) => updateField('nombres', event.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2>Datos de contacto</h2>
                <div className="grid two-columns">
                  <div className="field span-two">
                    <label htmlFor="direccion">Direccion</label>
                    <input id="direccion" required value={cliente.direccion} onChange={(event) => updateField('direccion', event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="telefono">Telefono</label>
                    <input id="telefono" value={cliente.telefono} onChange={(event) => updateField('telefono', event.target.value)} placeholder="9XXXXXXXX" />
                  </div>
                  <div className="field">
                    <label htmlFor="correo">Correo electronico</label>
                    <input id="correo" type="email" required value={cliente.correo} onChange={(event) => updateField('correo', event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="rol">Rol</label>
                    <select id="rol" value={cliente.rol} onChange={(event) => updateField('rol', event.target.value as ClienteRequest['rol'])}>
                      <option value="remitente">Remitente</option>
                      <option value="destinatario">Destinatario</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={reset}>Limpiar</button>
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? 'Procesando...' : mode === 'editar' ? 'Actualizar cliente' : 'Registrar cliente'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Pruebas de integracion HTTP</p>
                <h1>Pruebas del backend</h1>
              </div>
              <button className="primary-button" type="button" onClick={ejecutarPruebasBackend} disabled={testsRunning}>
                {testsRunning ? 'Ejecutando...' : 'Ejecutar todas las pruebas'}
              </button>
            </div>

            <section className="test-summary">
              <div>
                <span>URL del servicio</span>
                <strong>{baseUrl}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{testsRunning ? 'En ejecucion' : testResults.length ? `${testResults.filter((item) => item.passed).length}/${testResults.length} aprobadas` : 'Sin ejecutar'}</strong>
              </div>
            </section>

            <section className="test-list">
              {testResults.length === 0 ? (
                <div className="empty-tests">
                  <strong>No hay resultados todavia</strong>
                  <p>Ejecute las pruebas para mostrar los casos, estados HTTP y respuestas del backend.</p>
                </div>
              ) : testResults.map((result, index) => (
                <article className={result.passed ? 'test-item passed' : 'test-item failed'} key={`${result.name}-${index}`}>
                  <div className="test-item-header">
                    <div>
                      <span className="test-index">{index + 1}</span>
                      <div>
                        <h2>{result.name}</h2>
                        <p>{result.description}</p>
                      </div>
                    </div>
                    <div className="test-badges">
                      <span>{result.status ?? 'SIN RESP'}</span>
                      <span>{result.durationMs} ms</span>
                      <strong>{result.passed ? 'APROBADA' : 'FALLIDA'}</strong>
                    </div>
                  </div>
                  <div className="test-response">
                    <span>Esperado: HTTP {result.expected}</span>
                    <pre>{result.response || 'Sin contenido'}</pre>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSettings(false);
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <h2 id="settings-title">Configuracion del servicio</h2>
            <div className="field">
              <label htmlFor="api-url">URL del backend</label>
              <input id="api-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:8080" />
            </div>
            <div className="field">
              <label htmlFor="api-token">Token Bearer</label>
              <input id="api-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="JWT de acceso" />
            </div>
            <p className="helper">El backend debe ejecutarse y aceptar el token emitido por el proveedor OAuth configurado.</p>
            <div className="form-actions">
              <button className="primary-button" type="button" onClick={() => setShowSettings(false)}>Guardar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
