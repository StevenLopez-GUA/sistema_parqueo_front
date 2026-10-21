import Icon from './Icon.jsx';
import { ESTADOS, TIPOS } from '../lib.js';

/**
 * Mapa 2D del lote en L, como la maqueta: al entrar quedan enfrente
 * los 3 primeros espacios (carga y privados) y a mano derecha el resto
 * (los libres). El pasillo ocupa la esquina interior de la L.
 * Las bahías tienen tamaño fijo; en pantallas angostas el lote hace
 * scroll horizontal en vez de deformarse.
 */
export default function ParkingMap({ espacios, reservas = [], seleccionado, simulador, onSeleccionar, onMover }) {
  const bahia = (e, orient) => (
    <ParkingSpot
      key={e.espacio_id}
      espacio={e}
      orient={orient}
      seleccionado={seleccionado === e.espacio_id}
      reserva={reservas.find((r) => r.espacio_id === e.espacio_id)?.placa}
      simulador={simulador}
      onSeleccionar={onSeleccionar}
      onMover={onMover}
    />
  );

  return (
    <div className="lote-scroll" tabIndex={-1}>
      <div className="lote" role="group" aria-label="Mapa del parqueo">
        <div className="lote-frente">{espacios.slice(0, 3).map((e) => bahia(e, 'arriba'))}</div>
        <div className="lote-derecha">{espacios.slice(3).map((e) => bahia(e, 'derecha'))}</div>
        <div className="lote-pasillo" aria-hidden="true">
          <span className="pasillo-txt">Pasillo de circulación</span>
          <span className="lote-entrada">
            <span className="flecha">↑</span>
            Entrada
          </span>
        </div>
      </div>
    </div>
  );
}

export function ParkingSpot({ espacio: e, orient, seleccionado, reserva, simulador, onSeleccionar, onMover }) {
  const hayCarro = e.sensor_ocupado === 1;
  const tipo = TIPOS[e.tipo_espacio] ?? { etiqueta: e.tipo_espacio, icono: 'car' };
  const est = ESTADOS[e.estado] ?? { etiqueta: e.estado, icono: 'info' };

  const seleccionar = () => onSeleccionar(seleccionado ? null : e.espacio_id);

  return (
    <div
      className={`spot st-${e.estado} ${orient} ${seleccionado ? 'sel' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={seleccionado}
      aria-label={`Espacio ${e.espacio}, ${tipo.etiqueta}, ${est.etiqueta}${e.placa ? `, placa ${e.placa}` : ''}${
        hayCarro ? ', sensor detecta vehículo' : ''
      }`}
      onClick={seleccionar}
      onKeyDown={(ev) => {
        if (ev.target !== ev.currentTarget) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          seleccionar();
        }
      }}
    >
      <div className="spot-cab">
        <span className="spot-cod">{e.espacio}</span>
        <span className="spot-tipo" title={tipo.etiqueta}>
          <Icon name={tipo.icono} size={14} />
        </span>
      </div>

      <div className="spot-centro">
        {hayCarro ? (
          <span className="veh-wrap" key="veh">
            <Vehiculo tipo={e.tipo_vehiculo ?? e.tipo_espacio} />
          </span>
        ) : (
          <span className="spot-marca"><Icon name={tipo.icono} size={28} /></span>
        )}
        {e.tipo_espacio === 'reservado' && !e.placa && (
          <span className="spot-reserva" title={reserva ? `Reservado para ${reserva}` : 'Sin placa autorizada'}>
            {reserva ? `Solo ${reserva}` : 'Sin reserva'}
          </span>
        )}
        {e.placa && <span className="placa">{e.placa}</span>}
        {e.estado === 'ALARMA' && (
          <span className="spot-alerta" aria-hidden="true"><Icon name="alert" size={14} /></span>
        )}
      </div>

      <div className="spot-pie">
        <span className="spot-estado">
          <Icon name={est.icono} size={13} />
          {est.etiqueta}
        </span>
        <span
          className={`sensor ${hayCarro ? 'on' : ''}`}
          title={hayCarro ? 'Sensor: detecta vehículo' : 'Sensor: libre'}
        >
          <Icon name="radio" size={13} />
        </span>
      </div>

      {simulador && (
        <button
          className="spot-mover"
          onClick={(ev) => {
            ev.stopPropagation();
            onMover(e, !hayCarro);
          }}
          title="Simular entrada o salida del vehículo"
        >
          <Icon name={hayCarro ? 'logOut' : 'logIn'} size={13} />
          {hayCarro ? 'Sacar' : 'Meter'}
        </button>
      )}
    </div>
  );
}

/** Vehículo visto desde arriba, con el frente hacia arriba. */
export function Vehiculo({ tipo }) {
  if (tipo === 'moto') {
    return (
      <svg viewBox="0 0 48 96" className="vehiculo" aria-hidden="true">
        <rect className="llanta" x="20" y="6" width="8" height="20" rx="4" />
        <rect className="llanta" x="20" y="70" width="8" height="20" rx="4" />
        <rect className="carroceria" x="17" y="22" width="14" height="52" rx="7" />
        <rect className="detalle" x="8" y="26" width="32" height="4" rx="2" />
        <ellipse className="vidrio" cx="24" cy="54" rx="5" ry="11" />
      </svg>
    );
  }

  if (tipo === 'carga') {
    return (
      <svg viewBox="0 0 48 96" className="vehiculo" aria-hidden="true">
        <rect className="llanta" x="4" y="12" width="5" height="12" rx="2" />
        <rect className="llanta" x="39" y="12" width="5" height="12" rx="2" />
        <rect className="llanta" x="3" y="72" width="5" height="14" rx="2" />
        <rect className="llanta" x="40" y="72" width="5" height="14" rx="2" />
        <rect className="carroceria" x="8" y="4" width="32" height="24" rx="8" />
        <path className="vidrio" d="M12 13 Q24 8 36 13 L34 22 H14 Z" />
        <rect className="carroceria caja" x="6" y="30" width="36" height="62" rx="3" />
        <path className="detalle" d="M12 42h24M12 54h24M12 66h24M12 78h24" />
      </svg>
    );
  }

  const grande = tipo === 'grande';
  return (
    <svg viewBox="0 0 48 96" className="vehiculo" aria-hidden="true">
      <rect className="llanta" x={grande ? 4 : 7} y="16" width="5" height="14" rx="2" />
      <rect className="llanta" x={grande ? 39 : 36} y="16" width="5" height="14" rx="2" />
      <rect className="llanta" x={grande ? 4 : 7} y="66" width="5" height="14" rx="2" />
      <rect className="llanta" x={grande ? 39 : 36} y="66" width="5" height="14" rx="2" />
      <rect className="carroceria" x={grande ? 7 : 10} y={grande ? 4 : 8} width={grande ? 34 : 28} height={grande ? 88 : 80} rx="11" />
      <rect className="faro" x={grande ? 11 : 13} y={grande ? 6 : 10} width="6" height="3" rx="1.5" />
      <rect className="faro" x={grande ? 31 : 29} y={grande ? 6 : 10} width="6" height="3" rx="1.5" />
      <path className="vidrio" d={grande ? 'M11 26 Q24 19 37 26 L35 36 H13 Z' : 'M14 28 Q24 22 34 28 L32 38 H16 Z'} />
      <rect className="techo" x={grande ? 12 : 15} y={grande ? 38 : 40} width={grande ? 24 : 18} height={grande ? 34 : 24} rx="3" />
      {grande && <path className="detalle" d="M16 44v22M32 44v22" />}
      <path className="vidrio" d={grande ? 'M13 76 H35 L37 84 Q24 88 11 84 Z' : 'M16 66 H32 L34 74 Q24 78 14 74 Z'} />
      <rect className="carroceria" x={grande ? 3 : 6} y="32" width="4" height="5" rx="1.5" />
      <rect className="carroceria" x={grande ? 41 : 38} y="32" width="4" height="5" rx="1.5" />
    </svg>
  );
}
