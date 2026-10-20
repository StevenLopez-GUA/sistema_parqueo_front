import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Modal } from './ui.jsx';
import { API, ESTADOS, TIPOS } from '../lib.js';

const TIPOS_VEHICULO = ['compacto', 'grande', 'moto', 'carga'];

/**
 * Entrada de un vehículo desde la cámara: pregunta el tipo y el espacio.
 * Los espacios que no sirven se ven deshabilitados con el motivo; el
 * recomendado (el que elegiría ASIGNAR) viene seleccionado. Si no hay
 * ninguno libre, confirmar registra la alarma de parqueo lleno.
 */
export default function EntradaDialogo({ placa, espacios, reservas = [], onTerminado, onCancelar }) {
  const [tipo, setTipo] = useState('compacto');
  const [compatibles, setCompatibles] = useState(null); // null = cargando
  const [elegido, setElegido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const primeraCarga = useRef(true);

  useEffect(() => {
    if (!placa) return;
    setTipo('compacto');
    setElegido(null);
    setError(null);
    primeraCarga.current = true;
  }, [placa]);

  // Espacios compatibles; se recalculan si cambia el tipo o el parqueo.
  useEffect(() => {
    if (!placa) return;
    let vigente = true;
    fetch(`${API}/api/espacios/compatibles?tipo=${tipo}&placa=${placa}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vigente) return;
        // Si la placa ya estaba registrada con otro tipo, se propone ese.
        if (primeraCarga.current && d.tipoRegistrado && d.tipoRegistrado !== tipo) {
          primeraCarga.current = false;
          setTipo(d.tipoRegistrado);
          return;
        }
        primeraCarga.current = false;
        const lista = d.espacios ?? [];
        setCompatibles(lista);
        setElegido((actual) => (lista.some((e) => e.id === actual) ? actual : recomendadoDe(lista)));
      })
      .catch(() => vigente && setError('No hay conexión con el servidor'));
    return () => {
      vigente = false;
    };
  }, [placa, tipo, espacios]);

  // Si la placa tiene su espacio privado, ese es el recomendado.
  function recomendadoDe(lista) {
    const propio = lista.find((c) => reservas.some((r) => r.espacio_id === c.id && r.placa === placa));
    return (propio ?? lista[0])?.id ?? null;
  }

  const lleno = compatibles !== null && compatibles.length === 0;
  const recomendado = compatibles ? recomendadoDe(compatibles) : null;
  const codigoElegido = espacios.find((e) => e.espacio_id === elegido)?.espacio;

  function motivoNo(e) {
    if (e.estado !== 'LIBRE') return ESTADOS[e.estado]?.etiqueta ?? e.estado;
    if (e.tipo_espacio === 'reservado') {
      const r = reservas.find((x) => x.espacio_id === e.espacio_id);
      return r ? `Solo para ${r.placa}` : 'Privado sin placa autorizada';
    }
    return `No admite ${TIPOS[tipo]?.etiqueta.toLowerCase() ?? tipo}`;
  }

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/entrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placa, tipo, espacio_id: lleno ? null : elegido }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.lleno) onTerminado({ lleno: true, mensaje: d.error });
      else if (!r.ok) setError(d.error ?? `El servidor respondió ${r.status}`);
      else onTerminado({ ok: true, mensaje: d.mensaje });
    } catch {
      setError('No hay conexión con el servidor');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={!!placa} onCerrar={onCancelar} className="modal-entrada" etiqueta="Registrar entrada">
      <div className="modal-cuerpo">
        <div className="entrada-cab">
          <div>
            <h2>Registrar entrada</h2>
            <p>Elige el tipo de vehículo y el espacio donde se va a estacionar.</p>
          </div>
          <span className="placa placa-lg">{placa}</span>
        </div>

        <div className="campo-grupo">
          <span>Tipo de vehículo</span>
          <div className="segmentado" role="radiogroup" aria-label="Tipo de vehículo">
            {TIPOS_VEHICULO.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={tipo === t}
                className={tipo === t ? 'activo' : ''}
                onClick={() => setTipo(t)}
              >
                <Icon name={TIPOS[t].icono} size={16} />
                {TIPOS[t].etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="campo-grupo">
          <span>Espacio</span>
          <div className="entrada-espacios" role="radiogroup" aria-label="Espacio">
            {espacios.map((e) => {
              const sirve = compatibles?.some((c) => c.id === e.espacio_id);
              return (
                <button
                  key={e.espacio_id}
                  role="radio"
                  aria-checked={elegido === e.espacio_id}
                  disabled={!sirve}
                  className={`entrada-espacio st-${e.estado} ${elegido === e.espacio_id ? 'sel' : ''}`}
                  onClick={() => setElegido(e.espacio_id)}
                >
                  <strong>{e.espacio}</strong>
                  <span><Icon name={TIPOS[e.tipo_espacio]?.icono ?? 'car'} size={13} /> {TIPOS[e.tipo_espacio]?.etiqueta ?? e.tipo_espacio}</span>
                  <small>{compatibles === null ? '…' : sirve ? (e.espacio_id === recomendado ? 'Recomendado' : 'Disponible') : motivoNo(e)}</small>
                </button>
              );
            })}
          </div>
        </div>

        {lleno && (
          <div className="aviso aviso-alarma" role="alert">
            <Icon name="alert" size={16} />
            <span>
              Parqueo lleno: no hay espacio libre para un vehículo {TIPOS[tipo]?.etiqueta.toLowerCase()}. Al confirmar se
              registra el vehículo y la alarma de parqueo lleno.
            </span>
          </div>
        )}
        {error && (
          <div className="aviso aviso-error" role="alert">
            <Icon name="alertCircle" size={16} />
            {error}
          </div>
        )}

        <div className="modal-acciones">
          <button className="btn btn-ghost" onClick={onCancelar} disabled={enviando}>Cancelar</button>
          <button
            className={`btn ${lleno ? 'btn-peligro' : 'btn-primario'}`}
            onClick={confirmar}
            disabled={enviando || compatibles === null || (!lleno && !elegido)}
            autoFocus
          >
            <Icon name={enviando ? 'loader' : lleno ? 'alert' : 'logIn'} size={16} className={enviando ? 'girando' : ''} />
            {lleno ? 'Registrar parqueo lleno' : `Registrar entrada en ${codigoElegido ?? '…'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
