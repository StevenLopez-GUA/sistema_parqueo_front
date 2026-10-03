import { useEffect, useMemo, useRef, useState } from 'react';

const API = import.meta.env.VITE_API ?? 'http://localhost:3001';
const WS = API.replace(/^http/, 'ws');

const ETIQUETA_ESTADO = {
  LIBRE: 'Libre',
  ASIGNADO: 'Asignado',
  OCUPADO: 'Ocupado',
  AUTORIZADO: 'Autorizado',
  ALARMA: 'Alarma',
  FUERA_SERVICIO: 'Fuera de servicio',
};

const ETIQUETA_TIPO = {
  compacto: 'Compactos',
  grande: 'Grandes',
  moto: 'Motos',
  carga: 'Carga y descarga',
  reservado: 'Reservados',
};

const EJEMPLO = `REGISTRAR(compacto,P123ABC);
ASIGNAR(P123ABC);
CONSULTAR();`;

export default function App() {
  const [datos, setDatos] = useState(null);
  const [codigo, setCodigo] = useState(EJEMPLO);
  const [resultado, setResultado] = useState(null);
  const [ejecutando, setEjecutando] = useState(false);
  const areaRef = useRef(null);

  // Estado en vivo por WebSocket, con respaldo por HTTP en el primer render.
  useEffect(() => {
    fetch(`${API}/api/estado`).then((r) => r.json()).then(setDatos).catch(() => {});

    let socket;
    let reintento;
    const conectar = () => {
      socket = new WebSocket(WS);
      socket.onmessage = (e) => setDatos(JSON.parse(e.data));
      socket.onclose = () => { reintento = setTimeout(conectar, 1500); };
    };
    conectar();
    return () => { clearTimeout(reintento); socket?.close(); };
  }, []);

  async function ejecutar() {
    setEjecutando(true);
    try {
      const r = await fetch(`${API}/api/ejecutar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      setResultado(await r.json());
    } catch {
      setResultado({ errores: [{ clase: 'ERROR_HARDWARE', mensaje: 'No hay conexion con el servidor', linea: 0, columna: 0 }], salidas: [] });
    } finally {
      setEjecutando(false);
    }
  }

  const post = (ruta, cuerpo) =>
    fetch(`${API}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
    });

  function alTeclear(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); ejecutar(); }
  }

  const espacios = datos?.espacios ?? [];
  const arriba = espacios.slice(0, 5);
  const abajo = espacios.slice(5, 10);
  const enAlarma = espacios.some((e) => e.estado === 'ALARMA');
  const errores = resultado?.errores ?? [];

  const alarmas = useMemo(
    () => espacios.filter((e) => e.estado === 'ALARMA'),
    [espacios]
  );

  if (!datos) {
    return <div className="cargando">Conectando con el sistema de parqueo…</div>;
  }

  return (
    <div className={`app ${enAlarma ? 'con-alarma' : ''}`}>
      <header className="barra">
        <div className="marca">
          <span className="marca-p">P</span>
          <div>
            <h1>Sistema inteligente de parqueo</h1>
            <p>Universidad Mariano Gálvez · Sexto semestre</p>
          </div>
        </div>
        <div className="barra-derecha">
          <span className={`chip chip-${datos.modo}`}>
            {datos.modo === 'simulador' ? 'Maqueta simulada' : 'Maqueta conectada'}
          </span>
          <button className="btn-texto" onClick={() => post('/api/reiniciar')}>
            Reiniciar parqueo
          </button>
        </div>
      </header>

      {alarmas.length > 0 && (
        <div className="franja-alarma" role="alert">
          <strong>Movimiento no autorizado.</strong>{' '}
          {alarmas.map((a) => `${a.espacio} — ${a.placa ?? 'vehículo no registrado'}`).join(' · ')}
        </div>
      )}

      <section className="letrero" aria-label="Disponibilidad por tipo">
        {datos.disponibilidad.map((d) => (
          <div key={d.tipo_espacio} className={`letrero-item ${d.libres === 0 ? 'lleno' : ''}`}>
            <span className="letrero-num">{d.libres}</span>
            <span className="letrero-txt">
              {ETIQUETA_TIPO[d.tipo_espacio] ?? d.tipo_espacio}
              <em>de {d.total}</em>
            </span>
          </div>
        ))}
      </section>

      <main className="cuerpo">
        <section className="lote" aria-label="Mapa del parqueo">
          <FilaBahias
            espacios={arriba}
            orientacion="arriba"
            seleccionado={datos.seleccionado}
            simulador={datos.modo === 'simulador'}
            post={post}
          />
          <div className="pasillo">
            <span className="pasillo-txt">Pasillo de circulación</span>
          </div>
          <FilaBahias
            espacios={abajo}
            orientacion="abajo"
            seleccionado={datos.seleccionado}
            simulador={datos.modo === 'simulador'}
            post={post}
          />
        </section>

        <aside className="panel">
          <div className="consola">
            <div className="consola-cabeza">
              <h2>Consola de comandos</h2>
              <span className="atajo">Ctrl + Enter</span>
            </div>
            <textarea
              ref={areaRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={alTeclear}
              spellCheck={false}
              rows={7}
              aria-label="Código del lenguaje de parqueo"
            />
            <div className="consola-pie">
              <button className="btn" onClick={ejecutar} disabled={ejecutando}>
                {ejecutando ? 'Ejecutando…' : 'Ejecutar'}
              </button>
              {datos.modo === 'simulador' && (
                <button className="btn-texto" onClick={() => post('/api/simulador/boton')}>
                  Botón de autorización
                </button>
              )}
            </div>
          </div>

          {resultado && (
            <div className="salida">
              {errores.length > 0 && (
                <table className="tabla-errores">
                  <caption>
                    {errores.length} {errores.length === 1 ? 'error' : 'errores'}
                  </caption>
                  <thead>
                    <tr><th>Tipo</th><th>Ln</th><th>Col</th><th>Descripción</th></tr>
                  </thead>
                  <tbody>
                    {errores.map((e, i) => (
                      <tr key={i}>
                        <td><span className={`etq ${e.clase}`}>{e.clase.replace('ERROR_', '').toLowerCase()}</span></td>
                        <td>{e.linea}</td>
                        <td>{e.columna}</td>
                        <td>{e.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {(resultado.salidas ?? []).map((s, i) => (
                <p key={i} className="linea-ok">
                  <code>{s.comando}</code> {s.mensaje}
                </p>
              ))}

              {errores.length === 0 && (resultado.salidas ?? []).length === 0 && (
                <p className="vacio">No hay instrucciones que ejecutar.</p>
              )}
            </div>
          )}

          <div className="bitacora">
            <h2>Bitácora</h2>
            {datos.eventos.length === 0 ? (
              <p className="vacio">Los movimientos del parqueo aparecerán aquí.</p>
            ) : (
              <ol>
                {[...datos.eventos].reverse().slice(0, 14).map((ev, i) => (
                  <li key={i} className={`ev-${ev.nivel}`}>
                    <time>{ev.momento}</time>
                    <span>{ev.texto}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function FilaBahias({ espacios, orientacion, seleccionado, simulador, post }) {
  return (
    <div className={`fila fila-${orientacion}`}>
      {espacios.map((e) => (
        <Bahia
          key={e.espacio_id}
          espacio={e}
          seleccionado={seleccionado === e.espacio_id}
          simulador={simulador}
          post={post}
        />
      ))}
    </div>
  );
}

function Bahia({ espacio: e, seleccionado, simulador, post }) {
  const hayCarro = e.sensor_ocupado === 1;

  const seleccionar = () =>
    post('/api/seleccionar', { espacio_id: seleccionado ? null : e.espacio_id });

  const moverCarro = (ev) => {
    ev.stopPropagation();
    post('/api/simulador/sensor', { indice: e.indice_led, presente: !hayCarro });
  };

  return (
    <div
      className={`bahia est-${e.estado} ${seleccionado ? 'sel' : ''}`}
      onClick={seleccionar}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => ev.key === 'Enter' && seleccionar()}
      aria-label={`Espacio ${e.espacio}, ${ETIQUETA_ESTADO[e.estado]}`}
    >
      <div className="bahia-top">
        <span className="bahia-cod">{e.espacio}</span>
        <span className="bahia-tipo">{e.tipo_espacio}</span>
      </div>

      <div className="bahia-centro">
        {e.placa ? (
          <span className="placa">{e.placa}</span>
        ) : (
          <span className="bahia-estado">{ETIQUETA_ESTADO[e.estado]}</span>
        )}
      </div>

      <div className="bahia-pie">
        <span className={`sensor ${hayCarro ? 'on' : ''}`}>
          {hayCarro ? 'sensor detecta' : 'sensor libre'}
        </span>
        {simulador && (
          <button className="mover" onClick={moverCarro} title="Simular entrada o salida del vehículo">
            {hayCarro ? 'Sacar' : 'Meter'}
          </button>
        )}
      </div>
    </div>
  );
}
