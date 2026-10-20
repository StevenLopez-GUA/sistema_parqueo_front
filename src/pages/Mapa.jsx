import Icon from '../components/Icon.jsx';
import ParkingMap from '../components/ParkingMap.jsx';
import { useState } from 'react';
import { EstadoBadge, Tarjeta, Vacio, useToast } from '../components/ui.jsx';
import { ESTADOS, TIPOS, ejecutar, post } from '../lib.js';

const PLACA = /^[A-Z][0-9]{3}[A-Z]{3}$/;

export function MapaParqueo({ datos, onSeleccionar, onMover }) {
  const simulador = datos.modo === 'simulador';
  const espacios = datos.espacios;
  const libres = espacios.filter((e) => e.estado === 'LIBRE').length;

  return (
    <Tarjeta
      titulo="Mapa del parqueo"
      icono="map"
      className="mapa-tarjeta"
      extra={<span className="tarjeta-sub">{libres} de {espacios.length} libres</span>}
    >
      <ul className="leyenda leyenda-h" aria-label="Leyenda de estados">
        {Object.entries(ESTADOS).map(([k, v]) => (
          <li key={k} className={`st-${k}`}>
            <Icon name={v.icono} size={13} />
            {v.etiqueta}
          </li>
        ))}
      </ul>

      {espacios.length === 0 ? (
        <Vacio icono="map" titulo="Sin espacios" texto="El servidor no reportó espacios de parqueo." />
      ) : (
        <ParkingMap
          espacios={espacios}
          reservas={datos.reservas}
          seleccionado={datos.seleccionado}
          simulador={simulador}
          onSeleccionar={onSeleccionar}
          onMover={onMover}
        />
      )}

      <p className="nota">
        <Icon name="pointer" size={14} />
        Selecciona un espacio para ver su detalle y sus acciones (confirmar llegada, autorizar salida, apagar alarma).
        {simulador && ' Usa Meter/Sacar para simular el sensor.'}
      </p>
    </Tarjeta>
  );
}

export function DetalleEspacio({ datos, onSeleccionar, onMover }) {
  const sel = datos.espacios.find((e) => e.espacio_id === datos.seleccionado);
  return (
    <Tarjeta titulo="Detalle del espacio" icono="info" className="detalle-tarjeta">
      <div aria-live="polite">
        {sel ? (
          <Detalle
            espacio={sel}
            reserva={datos.reservas?.find((r) => r.espacio_id === sel.espacio_id)?.placa ?? null}
            simulador={datos.modo === 'simulador'}
            onSeleccionar={onSeleccionar}
            onMover={onMover}
          />
        ) : (
          <Vacio
            icono="pointer"
            titulo="Ningún espacio seleccionado"
            texto="Haz clic en una bahía del mapa para ver su estado, placa y sensor."
          />
        )}
      </div>
    </Tarjeta>
  );
}

function Detalle({ espacio: e, reserva, simulador, onSeleccionar, onMover }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const hayCarro = e.sensor_ocupado === 1;
  const tipo = TIPOS[e.tipo_espacio] ?? { etiqueta: e.tipo_espacio, icono: 'car' };

  // La maqueta no tiene botones: llegada, autorización y apagar la alarma
  // se hacen desde aquí, con los mismos comandos de la consola.
  async function comando(codigo) {
    setEnviando(true);
    const r = await ejecutar(codigo);
    toast(r.ok ? { tipo: 'ok', titulo: r.mensaje } : { tipo: 'error', titulo: 'No se pudo completar', texto: r.mensaje });
    setEnviando(false);
  }

  // La alarma sin placa no se puede apagar con APAGAR_ALARMA: se apaga por espacio.
  async function apagarSinPlaca() {
    setEnviando(true);
    try {
      const r = await post('/api/alarmas/apagar', { espacio_id: e.espacio_id });
      toast({ tipo: 'ok', titulo: r.mensaje });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo apagar la alarma', texto: err.message });
    }
    setEnviando(false);
  }

  return (
    <div className={`detalle st-${e.estado}`}>
      <div className="detalle-cab">
        <span className="detalle-cod">{e.espacio}</span>
        <EstadoBadge estado={e.estado} />
      </div>

      {e.estado === 'ALARMA' && (
        <div className="aviso aviso-alarma" role="alert">
          <Icon name="alert" size={16} />
          Movimiento no autorizado — {e.placa ?? 'vehículo no registrado'}
        </div>
      )}

      <dl className="datos-lista">
        <div><dt>Tipo de espacio</dt><dd><Icon name={tipo.icono} size={14} /> {tipo.etiqueta}</dd></div>
        <div><dt>Placa</dt><dd>{e.placa ? <span className="placa">{e.placa}</span> : '—'}</dd></div>
        <div><dt>Tipo de vehículo</dt><dd>{TIPOS[e.tipo_vehiculo]?.etiqueta ?? e.tipo_vehiculo ?? '—'}</dd></div>
        <div>
          <dt>Sensor</dt>
          <dd className={hayCarro ? 'txt-warn' : ''}>
            <Icon name="radio" size={14} /> {hayCarro ? 'Detecta vehículo' : 'Libre'}
          </dd>
        </div>
        <div><dt>Llegada</dt><dd>{e.llegada_en ?? '—'}</dd></div>
        <div><dt>Salida autorizada</dt><dd>{e.autorizado_en ?? '—'}</dd></div>
        <div><dt>LED / sensor</dt><dd>#{e.indice_led}</dd></div>
      </dl>

      {e.tipo_espacio === 'reservado' && <PlacaAutorizada espacio={e} reserva={reserva} />}

      {e.estado === 'AUTORIZADO' && (
        <p className="nota">
          <Icon name="shield" size={14} />
          Salida autorizada: {e.espacio} se libera solo cuando el vehículo sale, y la talanquera se abre al detectarlo (tiene 60 s para llegar).
        </p>
      )}
      {e.estado === 'ALARMA' && !e.placa && (
        <p className="nota">
          <Icon name="info" size={14} />
          Vehículo no registrado: al apagar la alarma, el espacio queda libre.
        </p>
      )}

      <div className="detalle-acciones">
        {e.estado === 'ASIGNADO' && e.placa && (
          <button className="btn btn-primario" disabled={enviando} onClick={() => comando(`LLEGADA(${e.placa});`)}>
            <Icon name="car" size={16} />
            Confirmar llegada
          </button>
        )}
        {e.estado === 'OCUPADO' && e.placa && (
          <button className="btn btn-primario" disabled={enviando} onClick={() => comando(`AUTORIZAR_SALIDA(${e.placa});`)}>
            <Icon name="shield" size={16} />
            Autorizar salida
          </button>
        )}
        {e.estado === 'ALARMA' && (
          <button
            className="btn btn-peligro"
            disabled={enviando}
            onClick={() => (e.placa ? comando(`APAGAR_ALARMA(${e.placa});`) : apagarSinPlaca())}
          >
            <Icon name="bell" size={16} />
            Apagar alarma
          </button>
        )}
        {simulador && (
          <button className="btn btn-ghost" onClick={() => onMover(e, !hayCarro)}>
            <Icon name={hayCarro ? 'logOut' : 'logIn'} size={16} />
            {hayCarro ? 'Sacar vehículo' : 'Meter vehículo'}
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => onSeleccionar(null)}>
          <Icon name="x" size={16} />
          Quitar selección
        </button>
      </div>
      {!simulador && <p className="nota">Los sensores provienen de la maqueta física.</p>}
    </div>
  );
}

/**
 * Espacio privado: la única placa que puede usarlo. Cambiarla reemplaza a
 * la anterior; si esa placa tenía otro privado, lo deja libre.
 */
function PlacaAutorizada({ espacio: e, reserva }) {
  const toast = useToast();
  const [nueva, setNueva] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valida = PLACA.test(nueva);

  async function enviar(fn) {
    setEnviando(true);
    try {
      const r = await fn();
      toast({ tipo: 'ok', titulo: r.mensaje });
      setNueva('');
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo cambiar la reserva', texto: err.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="reserva">
      <div className="reserva-cab">
        <Icon name="bookmark" size={15} />
        <strong>Placa autorizada</strong>
        {reserva ? <span className="placa">{reserva}</span> : <span className="txt-tenue">Ninguna</span>}
      </div>
      <p className="nota">
        Solo esta placa puede entrar en {e.espacio}. Al registrar su entrada, la cámara recomienda este espacio.
      </p>
      <form
        className="reserva-form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (valida) enviar(() => post('/api/reservas', { espacio_id: e.espacio_id, placa: nueva }));
        }}
      >
        <input
          className={`campo ${nueva && !valida ? 'invalido' : ''}`}
          value={nueva}
          onChange={(ev) => setNueva(ev.target.value.toUpperCase())}
          placeholder="P123ABC"
          maxLength={7}
          aria-label={`Placa autorizada para ${e.espacio}`}
        />
        <button className="btn btn-primario" disabled={!valida || enviando}>
          {reserva ? 'Cambiar' : 'Autorizar'}
        </button>
      </form>
      {reserva && (
        <button
          className="btn-link"
          disabled={enviando}
          onClick={() => enviar(() => post(`/api/reservas/${e.espacio_id}`, null, 'DELETE'))}
        >
          Quitar autorización
        </button>
      )}
    </div>
  );
}
