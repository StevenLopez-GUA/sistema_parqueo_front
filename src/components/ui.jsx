import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { ESTADOS } from '../lib.js';

// ------------------------------------------------------------------
// Notificaciones tipo toast
// ------------------------------------------------------------------

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const ICONO_TOAST = { ok: 'checkCircle', error: 'alertCircle', info: 'info', alarma: 'alert' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const sig = useRef(0);

  const cerrar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (t) => {
      const id = ++sig.current;
      setToasts((lista) => [...lista.slice(-3), { tipo: 'info', ...t, id }]);
      setTimeout(() => cerrar(id), t.duracion ?? 4500);
    },
    [cerrar]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <Icon name={ICONO_TOAST[t.tipo] ?? 'info'} />
            <div className="toast-txt">
              <strong>{t.titulo}</strong>
              {t.texto && <p>{t.texto}</p>}
            </div>
            <button className="icon-btn" onClick={() => cerrar(t.id)} aria-label="Cerrar notificación">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------
// Modal (sobre <dialog> nativo: foco atrapado y Escape gratis)
// ------------------------------------------------------------------

export function Modal({ abierto, onCerrar, className = '', etiqueta, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={etiqueta}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
    >
      {abierto && children}
    </dialog>
  );
}

export function Confirmar({ abierto, titulo, texto, accion = 'Confirmar', onConfirmar, onCancelar }) {
  return (
    <Modal abierto={abierto} onCerrar={onCancelar} className="modal-confirmar" etiqueta={titulo}>
      <div className="modal-cuerpo">
        <span className="modal-icono"><Icon name="alert" size={20} /></span>
        <h2>{titulo}</h2>
        <p>{texto}</p>
        <div className="modal-acciones">
          <button className="btn btn-ghost" onClick={onCancelar} autoFocus>Cancelar</button>
          <button className="btn btn-peligro" onClick={onConfirmar}>{accion}</button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Piezas pequeñas
// ------------------------------------------------------------------

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] ?? { etiqueta: estado, icono: 'info' };
  return (
    <span className={`badge st-${estado}`}>
      <Icon name={e.icono} size={13} />
      {e.etiqueta}
    </span>
  );
}

export function Vacio({ icono = 'info', titulo, texto, children }) {
  return (
    <div className="vacio">
      <span className="vacio-icono"><Icon name={icono} size={22} /></span>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}

export function Tarjeta({ titulo, icono, extra, className = '', id, children }) {
  return (
    <section id={id} className={`tarjeta ${className}`}>
      {titulo && (
        <header className="tarjeta-cab">
          <h2>
            {icono && <Icon name={icono} size={16} />}
            {titulo}
          </h2>
          {extra}
        </header>
      )}
      {children}
    </section>
  );
}
