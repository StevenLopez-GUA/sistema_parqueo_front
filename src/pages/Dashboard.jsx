import Icon from '../components/Icon.jsx';
import Timeline from '../components/Timeline.jsx';
import { Tarjeta, Vacio } from '../components/ui.jsx';
import { ESTADOS, MODOS, TIPOS } from '../lib.js';

const ORDEN_ESTADOS = ['LIBRE', 'ASIGNADO', 'OCUPADO', 'AUTORIZADO', 'ALARMA', 'FUERA_SERVICIO'];

export default function Dashboard({ datos, conectado, onIr }) {
  const esp = datos.espacios;
  const cuenta = (estado) => esp.filter((e) => e.estado === estado).length;

  const total = esp.length;
  const libres = cuenta('LIBRE');
  const ocupados = cuenta('OCUPADO');
  const autorizados = cuenta('AUTORIZADO');
  const asignados = cuenta('ASIGNADO');
  const alarmas = cuenta('ALARMA');
  const fuera = cuenta('FUERA_SERVICIO');
  const enUso = total - libres - fuera;
  const pctUso = total ? Math.round((enUso / total) * 100) : 0;
  const sensores = esp.filter((e) => e.sensor_ocupado === 1).length;
  const seleccionado = esp.find((e) => e.espacio_id === datos.seleccionado);
  const ultimo = datos.eventos.at(-1);

  const segmentos = ORDEN_ESTADOS.map((estado) => ({ estado, n: cuenta(estado) })).filter((s) => s.n > 0);

  const estadoSistema = !conectado
    ? { tono: 'err', texto: 'Sin conexión', icono: 'alertCircle' }
    : alarmas
      ? { tono: 'alarma', texto: 'Alerta activa', icono: 'alert' }
      : { tono: 'ok', texto: 'Operativo', icono: 'checkCircle' };

  return (
    <div className="dashboard">
      <div className="kpis">
        <StatCard icono="dashboard" titulo="Total de espacios" valor={total}
          desc={`${datos.disponibilidad.length} categorías de espacio`} tono="primario" />
        <StatCard icono="check" titulo="Disponibles" valor={libres}
          desc={total ? `${Math.round((libres / total) * 100)}% del parqueo libre` : 'Sin espacios'} tono="ok" />
        <StatCard icono="car" titulo="Ocupados" valor={ocupados}
          desc={autorizados ? `${autorizados} más con salida autorizada` : 'Vehículos estacionados'} tono="err" />
        <StatCard icono="clock" titulo="Asignados" valor={asignados}
          desc="Esperando la llegada del vehículo" tono="warn" />
        <StatCard icono="alert" titulo="En alarma" valor={alarmas}
          desc={alarmas ? 'Requiere atención inmediata' : 'Sin incidentes activos'}
          tono={alarmas ? 'alarma activa' : 'neutro'} onClick={alarmas ? () => onIr('panel') : undefined} />
      </div>

      <div className="dash-grid">
        <Tarjeta titulo="Ocupación" icono="gauge" className="dash-ocupacion">
          {total === 0 ? (
            <Vacio icono="map" titulo="Sin espacios" texto="El servidor no reportó espacios." />
          ) : (
            <div className="ocupacion">
              <Dona segmentos={segmentos} total={total} pct={pctUso} />
              <ul className="leyenda">
                {ORDEN_ESTADOS.map((estado) => (
                  <li key={estado} className={`st-${estado}`}>
                    <span className="leyenda-color" />
                    {ESTADOS[estado].etiqueta}
                    <strong>{cuenta(estado)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="medidor">
            <div className="medidor-txt">
              <span><Icon name="radio" size={14} /> Sensores detectando vehículo</span>
              <strong>{sensores} / {total}</strong>
            </div>
            <div className="barra"><span style={{ width: `${total ? (sensores / total) * 100 : 0}%` }} /></div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Disponibilidad por categoría" icono="list" className="dash-dispo">
          {datos.disponibilidad.length === 0 ? (
            <Vacio titulo="Sin datos de disponibilidad" />
          ) : (
            <ul className="dispo">
              {datos.disponibilidad.map((d) => {
                const t = TIPOS[d.tipo_espacio] ?? { plural: d.tipo_espacio, icono: 'car' };
                return (
                  <li key={d.tipo_espacio} className={d.libres === 0 ? 'lleno' : ''}>
                    <span className="dispo-icono"><Icon name={t.icono} size={16} /></span>
                    <div className="dispo-info">
                      <div className="dispo-fila">
                        <span>{t.plural}</span>
                        <strong>{d.libres}<em> / {d.total} libres</em></strong>
                      </div>
                      <div className="barra"><span style={{ width: `${d.total ? (d.libres / d.total) * 100 : 0}%` }} /></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Estado del sistema" icono="cpu" className="dash-sistema">
          <div className={`sistema-estado tono-${estadoSistema.tono}`}>
            <Icon name={estadoSistema.icono} size={20} />
            <strong>{estadoSistema.texto}</strong>
          </div>
          <dl className="datos-lista">
            <div><dt>Tiempo real</dt><dd>{conectado ? 'WebSocket en línea' : 'Reconectando…'}</dd></div>
            <div><dt>Hardware</dt><dd>{MODOS[datos.modo] ?? datos.modo}</dd></div>
            <div><dt>Alarmas activas</dt><dd>{alarmas}</dd></div>
            <div><dt>Espacio seleccionado</dt><dd>{seleccionado?.espacio ?? 'Ninguno'}</dd></div>
            <div><dt>Último evento</dt><dd>{ultimo?.momento ?? '—'}</dd></div>
          </dl>
        </Tarjeta>

        <Tarjeta
          titulo="Actividad reciente"
          icono="activity"
          className="dash-actividad"
          extra={
            <button className="btn-link" onClick={() => onIr('actividad')}>
              Ver todo <Icon name="chevron" size={14} />
            </button>
          }
        >
          <div className="scroll-y">
            <Timeline eventos={datos.eventos} limite={14} />
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

function StatCard({ icono, titulo, valor, desc, tono, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag className={`kpi tono-${tono}`} onClick={onClick}>
      <div className="kpi-cab">
        <span className="kpi-icono"><Icon name={icono} size={18} /></span>
        <span className="kpi-titulo">{titulo}</span>
      </div>
      {/* La key reinicia la animación cada vez que cambia el valor. */}
      <strong className="kpi-valor" key={valor}>{valor}</strong>
      <p className="kpi-desc">{desc}</p>
    </Tag>
  );
}

function Dona({ segmentos, total, pct }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const hueco = segmentos.length > 1 ? 3 : 0;
  let acumulado = 0;

  return (
    <div className="dona">
      <svg viewBox="0 0 140 140" role="img" aria-label={`Ocupación ${pct}%`}>
        <circle className="dona-fondo" cx="70" cy="70" r={R} />
        <g transform="rotate(-90 70 70)">
          {segmentos.map((s) => {
            const largo = (s.n / total) * C;
            const el = (
              <circle
                key={s.estado}
                className={`dona-seg st-${s.estado}`}
                cx="70" cy="70" r={R}
                strokeDasharray={`${Math.max(largo - hueco, 0.01)} ${C}`}
                strokeDashoffset={-acumulado}
              />
            );
            acumulado += largo;
            return el;
          })}
        </g>
      </svg>
      <div className="dona-centro">
        <strong>{pct}%</strong>
        <span>en uso</span>
      </div>
    </div>
  );
}
