import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Timeline, { NIVELES } from '../components/Timeline.jsx';
import { Tarjeta } from '../components/ui.jsx';

export default function Actividad({ eventos }) {
  const [nivel, setNivel] = useState('');
  const filtrados = nivel ? eventos.filter((e) => e.nivel === nivel) : eventos;
  const cuenta = (n) => eventos.filter((e) => e.nivel === n).length;

  return (
    <Tarjeta
      titulo="Actividad y eventos"
      icono="activity"
      extra={<span className="tarjeta-sub">{eventos.length} eventos recibidos</span>}
    >
      <div className="filtros-chips" role="group" aria-label="Filtrar por nivel">
        <button className={`chip-filtro ${nivel === '' ? 'activo' : ''}`} onClick={() => setNivel('')} aria-pressed={nivel === ''}>
          Todos <span>{eventos.length}</span>
        </button>
        {Object.entries(NIVELES).map(([k, v]) => (
          <button
            key={k}
            className={`chip-filtro nv-${k} ${nivel === k ? 'activo' : ''}`}
            onClick={() => setNivel(k)}
            aria-pressed={nivel === k}
          >
            <Icon name={v.icono} size={13} />
            {v.etiqueta} <span>{cuenta(k)}</span>
          </button>
        ))}
      </div>

      <Timeline eventos={filtrados} />

      <p className="nota">
        <Icon name="info" size={14} />
        Eventos en vivo vía WebSocket. El servidor conserva los 60 más recientes de la sesión.
      </p>
    </Tarjeta>
  );
}
