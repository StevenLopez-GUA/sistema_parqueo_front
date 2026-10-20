import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { API, MODOS } from '../lib.js';

export function Sidebar({ secciones, actual, onIr, abierto, onCerrar, alarmas }) {
  return (
    <>
      <div className={`sidebar-velo ${abierto ? 'visible' : ''}`} onClick={onCerrar} aria-hidden="true" />
      <aside className={`sidebar ${abierto ? 'abierto' : ''}`} aria-label="Navegación principal">
        <div className="sidebar-marca">
          <span className="logo" aria-hidden="true">P</span>
          <div className="sidebar-marca-txt">
            <strong>Parqueo UMG</strong>
            <span>Centro de control</span>
          </div>
          <button className="icon-btn solo-movil" onClick={onCerrar} aria-label="Cerrar menú">
            <Icon name="x" />
          </button>
        </div>

        <nav>
          <ul>
            {secciones.map((s) => (
              <li key={s.id}>
                <button
                  className={`nav-item ${actual === s.id ? 'activo' : ''}`}
                  aria-current={actual === s.id ? 'page' : undefined}
                  onClick={() => onIr(s.id)}
                  title={s.titulo}
                >
                  <Icon name={s.icono} />
                  <span className="nav-txt">{s.titulo}</span>
                  {s.id === 'panel' && alarmas > 0 && (
                    <span className="nav-badge" aria-label={`${alarmas} alarmas`}>{alarmas}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-pie">
          <span>Universidad Mariano Gálvez</span>
          <span>Sexto semestre</span>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ titulo, conectado, modo, alarmas, tema, onMenu, onAlarmas, onReiniciar, onTema }) {
  return (
    <header className="topbar">
      <button className="icon-btn solo-movil" onClick={onMenu} aria-label="Abrir menú">
        <Icon name="menu" />
      </button>

      <div className="topbar-titulo">
        <span>Sistema inteligente de parqueo</span>
        <h1>{titulo}</h1>
      </div>

      <div className="topbar-estado">
        <span className={`pill ${conectado ? 'pill-ok' : 'pill-err'}`} title="Conexión en tiempo real con el servidor">
          <span className="punto" />
          {conectado ? 'En línea' : 'Reconectando…'}
        </span>
        <span className="pill" title="Origen de los sensores">
          <Icon name={modo === 'simulador' ? 'cpu' : 'radio'} size={14} />
          {MODOS[modo] ?? modo}
        </span>
        {modo === 'http' && <SenalMaqueta />}
        <Reloj />
      </div>

      <div className="topbar-acciones">
        <button
          className={`icon-btn campana ${alarmas ? 'activa' : ''}`}
          onClick={onAlarmas}
          aria-label={alarmas ? `${alarmas} alarmas activas, ver en el mapa` : 'Sin alarmas activas'}
          title={alarmas ? `${alarmas} alarmas activas` : 'Sin alarmas activas'}
        >
          <Icon name="bell" />
          {alarmas > 0 && <span className="campana-n">{alarmas}</span>}
        </button>
        <button
          className="icon-btn"
          onClick={onTema}
          aria-label={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={tema === 'oscuro' ? 'Tema claro' : 'Tema oscuro'}
        >
          <Icon name={tema === 'oscuro' ? 'sun' : 'moon'} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onReiniciar}>
          <Icon name="reset" size={16} />
          <span className="ocultar-sm">Reiniciar</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Con la maqueta real: ¿el Arduino está mandando datos? El backend lo
 * considera en línea si recibió un POST en los últimos 8 segundos.
 */
function SenalMaqueta() {
  const [diag, setDiag] = useState(null);
  useEffect(() => {
    let vivo = true;
    const consultar = () =>
      fetch(`${API}/api/v1/maqueta`)
        .then((r) => r.json())
        .then((d) => vivo && setDiag(d))
        .catch(() => vivo && setDiag(null));
    consultar();
    const id = setInterval(consultar, 3000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const enLinea = !!diag?.enLinea;
  const hace = diag?.ultimoContacto ? Math.round((Date.now() - diag.ultimoContacto) / 1000) : null;
  return (
    <span
      className={`pill ${enLinea ? 'pill-ok' : 'pill-err'}`}
      title={hace === null ? 'El Arduino todavía no mandó datos' : `Último dato del Arduino hace ${hace} s`}
    >
      <span className="punto" />
      {enLinea ? 'Maqueta en línea' : 'Sin señal de la maqueta'}
    </span>
  );
}

/** Reloj aislado: re-renderiza solo él cada segundo, no toda la app. */
function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <time className="reloj" dateTime={ahora.toISOString()}>
      <span>{ahora.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      <strong>{ahora.toLocaleTimeString('es-GT')}</strong>
    </time>
  );
}
