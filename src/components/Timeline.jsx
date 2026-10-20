import Icon from './Icon.jsx';
import { Vacio } from './ui.jsx';

export const NIVELES = {
  info:   { etiqueta: 'Información', icono: 'info' },
  alarma: { etiqueta: 'Alarma',      icono: 'alert' },
  error:  { etiqueta: 'Error',       icono: 'alertCircle' },
};

/** Icono según el texto real del evento; el nivel lo decide el backend. */
function iconoEvento(ev) {
  if (ev.nivel !== 'info') return NIVELES[ev.nivel]?.icono ?? 'info';
  const t = ev.texto.toLowerCase();
  if (t.includes('asignado al')) return 'logIn';
  if (t.includes('salida autorizada')) return 'shield';
  if (t.includes('salio')) return 'logOut';
  if (t.includes('ocupo')) return 'car';
  if (t.includes('desactivada')) return 'checkCircle';
  if (t.includes('reiniciado')) return 'reset';
  return 'info';
}

export default function Timeline({ eventos, limite }) {
  const total = eventos.length;
  const lista = [...eventos].reverse().slice(0, limite ?? total);

  if (lista.length === 0) {
    return (
      <Vacio
        icono="activity"
        titulo="Sin actividad todavía"
        texto="Los movimientos del parqueo aparecerán aquí en tiempo real."
      />
    );
  }

  return (
    <ol className="timeline">
      {lista.map((ev, i) => (
        // La posición original es estable mientras llegan eventos nuevos,
        // así solo se anima el que acaba de entrar.
        <li key={total - 1 - i} className={`tl-item nv-${ev.nivel}`}>
          <span className="tl-icono"><Icon name={iconoEvento(ev)} size={15} /></span>
          <div className="tl-cuerpo">
            <p>{ev.texto}</p>
            <div className="tl-meta">
              <span className="nivel">{NIVELES[ev.nivel]?.etiqueta ?? ev.nivel}</span>
              {ev.momento && <time>{ev.momento}</time>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
