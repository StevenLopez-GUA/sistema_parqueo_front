import { useEffect, useState, useCallback } from 'react';
import Icon from './components/Icon.jsx';
import { Modal, Tarjeta, Vacio } from './components/ui.jsx';
import { API } from './lib.js';

const MOTIVOS = ['', 'REGISTRO', 'LLEGADA', 'SALIDA', 'ALARMA', 'MANUAL'];

/**
 * Consulta del historial fotográfico.
 * La tabla de precisión de abajo es la que sirve directo para el informe.
 */
export default function Capturas({ refrescar }) {
  const [filas, setFilas] = useState([]);
  const [precision, setPrecision] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [placa, setPlaca] = useState('');
  const [placaFiltro, setPlacaFiltro] = useState('');
  const [motivo, setMotivo] = useState('');
  const [soloFallos, setSoloFallos] = useState(false);
  const [ampliada, setAmpliada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Debounce: la búsqueda por placa espera a que el operador deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setPlacaFiltro(placa), 350);
    return () => clearTimeout(t);
  }, [placa]);

  const consultar = useCallback(async () => {
    const q = new URLSearchParams();
    if (placaFiltro) q.set('placa', placaFiltro);
    if (motivo) q.set('motivo', motivo);
    if (soloFallos) q.set('soloFallos', '1');

    setCargando(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/capturas?${q}`).then((r) => r.json()),
        fetch(`${API}/api/capturas/precision`).then((r) => r.json()),
      ]);
      setFilas(Array.isArray(r1) ? r1 : []);
      setPrecision(r2.porMetodo ?? []);
      setResumen(r2.resumen ?? []);
      setError(null);
    } catch {
      setError('No se pudo cargar el historial. Verifica que el servidor esté en ejecución.');
    } finally {
      setCargando(false);
    }
  }, [placaFiltro, motivo, soloFallos]);

  useEffect(() => { consultar(); }, [consultar, refrescar]);

  const totalRegistradas = resumen.reduce((s, r) => s + r.total, 0);
  const aciertos = precision.reduce((s, p) => s + p.aciertos, 0);
  const intentos = precision.reduce((s, p) => s + p.intentos, 0);
  const fallosVisibles = filas.filter((c) => c.acerto === 0).length;
  const hayFiltro = placa || motivo || soloFallos;

  return (
    <div className="capturas">
      <div className="mini-kpis">
        <MiniKpi icono="images" titulo="Capturas registradas" valor={totalRegistradas} />
        <MiniKpi icono="list" titulo="En esta vista" valor={filas.length} />
        <MiniKpi
          icono="gauge"
          titulo="Precisión automática"
          valor={intentos ? `${Math.round((aciertos / intentos) * 1000) / 10}%` : '—'}
          sub={intentos ? `${aciertos} de ${intentos} lecturas` : 'Sin lecturas OCR confirmadas'}
        />
        <MiniKpi icono="alertCircle" titulo="Fallos en la vista" valor={fallosVisibles} tono={fallosVisibles ? 'warn' : ''} />
      </div>

      <Tarjeta
        titulo="Historial de capturas"
        icono="images"
        extra={
          <button className="btn btn-ghost btn-sm" onClick={consultar} disabled={cargando}>
            <Icon name="reset" size={15} className={cargando ? 'girando' : ''} />
            Actualizar
          </button>
        }
      >
        <div className="filtros">
          <label className="campo-icono">
            <Icon name="search" size={16} />
            <input
              className="campo"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="Buscar por placa"
              aria-label="Buscar por placa"
            />
          </label>
          <select className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Filtrar por momento">
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>{m || 'Todos los momentos'}</option>
            ))}
          </select>
          <label className="interruptor">
            <input type="checkbox" checked={soloFallos} onChange={(e) => setSoloFallos(e.target.checked)} />
            <span className="interruptor-pista" aria-hidden="true" />
            Solo lecturas fallidas
          </label>
          {hayFiltro && (
            <button className="btn-link" onClick={() => { setPlaca(''); setMotivo(''); setSoloFallos(false); }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {error ? (
          <Vacio icono="alertCircle" titulo="Error de conexión" texto={error}>
            <button className="btn btn-ghost btn-sm" onClick={consultar}>Reintentar</button>
          </Vacio>
        ) : cargando && filas.length === 0 ? (
          <div className="galeria" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton skeleton-captura" />)}
          </div>
        ) : filas.length === 0 ? (
          <Vacio
            icono="images"
            titulo={hayFiltro ? 'Sin resultados' : 'Todavía no hay capturas'}
            texto={hayFiltro ? 'No hay capturas que coincidan con el filtro.' : 'Las fotos guardadas desde la cámara aparecerán aquí.'}
          />
        ) : (
          <div className={`galeria ${cargando ? 'actualizando' : ''}`}>
            {filas.map((c) => <TarjetaCaptura key={c.id} captura={c} onAbrir={() => setAmpliada(c)} />)}
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Precisión del reconocimiento automático" icono="gauge">
        {precision.length === 0 ? (
          <Vacio icono="gauge" titulo="Sin datos de precisión" texto="Aparecen cuando se confirman placas leídas por OCR." />
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Método</th><th>Aciertos</th><th>Intentos</th><th>Precisión</th><th>Confianza media</th></tr>
              </thead>
              <tbody>
                {precision.map((p) => (
                  <tr key={p.metodo_lectura}>
                    <td><span className="chip">{p.metodo_lectura}</span></td>
                    <td className="mono">{p.aciertos}</td>
                    <td className="mono">{p.intentos}</td>
                    <td>
                      <div className="precision-celda">
                        <div className="barra"><span style={{ width: `${p.porcentaje}%` }} /></div>
                        <span className="mono">{p.porcentaje}%</span>
                      </div>
                    </td>
                    <td className="mono">{p.confianza_promedio ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Modal abierto={!!ampliada} onCerrar={() => setAmpliada(null)} className="modal-captura" etiqueta="Detalle de la captura">
        {ampliada && <DetalleCaptura captura={ampliada} onCerrar={() => setAmpliada(null)} />}
      </Modal>
    </div>
  );
}

function MiniKpi({ icono, titulo, valor, sub, tono = '' }) {
  return (
    <div className={`mini-kpi ${tono ? `tono-${tono}` : ''}`}>
      <span className="kpi-icono"><Icon name={icono} size={16} /></span>
      <div>
        <span className="mini-kpi-titulo">{titulo}</span>
        <strong>{valor}</strong>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

function EstadoLectura({ acerto }) {
  if (acerto === 1) return <span className="chip chip-ok"><Icon name="checkCircle" size={13} />Acierto</span>;
  if (acerto === 0) return <span className="chip chip-warn"><Icon name="alertCircle" size={13} />Fallo</span>;
  return <span className="chip"><Icon name="keyboard" size={13} />Sin lectura automática</span>;
}

function TarjetaCaptura({ captura: c, onAbrir }) {
  const [rota, setRota] = useState(false);
  return (
    <figure className={`captura ${c.acerto === 0 ? 'fallo' : ''}`}>
      <button className="captura-img" onClick={onAbrir} aria-label={`Ver captura ${c.id}`}>
        {rota ? (
          <span className="img-rota"><Icon name="imageOff" size={24} />Imagen no disponible</span>
        ) : (
          <img
            src={`${API}/api/capturas/${c.id}/imagen`}
            alt={`Captura ${c.id} de ${c.placa_confirmada ?? 'vehículo sin identificar'}`}
            loading="lazy"
            onError={() => setRota(true)}
          />
        )}
        <span className="captura-motivo">{c.motivo}</span>
      </button>
      <figcaption>
        <div className="captura-fila">
          <span className="placa">{c.placa_confirmada ?? 'Sin placa'}</span>
          <EstadoLectura acerto={c.acerto} />
        </div>
        <div className="captura-meta">
          <span><Icon name="clock" size={12} />{c.momento}</span>
          <span>
            {c.metodo_lectura}
            {c.confianza != null && ` · ${c.confianza}%`}
            {c.espacio && ` · ${c.espacio}`}
          </span>
        </div>
        {c.acerto === 0 && <p className="captura-fallo">La máquina leyó {c.placa_detectada}</p>}
      </figcaption>
    </figure>
  );
}

function DetalleCaptura({ captura: c, onCerrar }) {
  const [rota, setRota] = useState(false);
  return (
    <div className="modal-captura-cuerpo">
      <div className="modal-captura-img">
        {rota ? (
          <span className="img-rota"><Icon name="imageOff" size={32} />Imagen no disponible</span>
        ) : (
          <img src={`${API}/api/capturas/${c.id}/imagen`} alt="Captura ampliada" onError={() => setRota(true)} />
        )}
      </div>
      <div className="modal-captura-info">
        <div className="detalle-cab">
          <span className="placa placa-lg">{c.placa_confirmada ?? 'Sin placa'}</span>
          <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <EstadoLectura acerto={c.acerto} />
        <dl className="datos-lista">
          <div><dt>Captura</dt><dd>#{c.id}</dd></div>
          <div><dt>Fecha y hora</dt><dd>{c.momento}</dd></div>
          <div><dt>Momento</dt><dd>{c.motivo}</dd></div>
          <div><dt>Método</dt><dd>{c.metodo_lectura}</dd></div>
          <div><dt>Confianza</dt><dd>{c.confianza != null ? `${c.confianza}%` : '—'}</dd></div>
          <div><dt>Placa detectada</dt><dd>{c.placa_detectada ?? '—'}</dd></div>
          <div><dt>Espacio</dt><dd>{c.espacio ?? '—'}</dd></div>
          {c.motivo_alarma && <div><dt>Alarma</dt><dd>{c.motivo_alarma}</dd></div>}
          {c.bytes != null && <div><dt>Tamaño</dt><dd>{Math.round(c.bytes / 1024)} KB</dd></div>}
        </dl>
      </div>
    </div>
  );
}
