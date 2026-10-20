import { useEffect, useMemo, useRef, useState } from 'react';
import Capturas from './Capturas.jsx';
import Icon from './components/Icon.jsx';
import { Sidebar, Topbar } from './components/Layout.jsx';
import { Confirmar, useToast } from './components/ui.jsx';
import { useParkingState } from './hooks/useParkingState.js';
import { useSirena } from './hooks/useSirena.js';
import { post } from './lib.js';
import Dashboard from './pages/Dashboard.jsx';
import Panel from './pages/Panel.jsx';
import Actividad from './pages/Actividad.jsx';
import Guia from './pages/Guia.jsx';

const SECCIONES = [
  { id: 'dashboard', titulo: 'Dashboard', icono: 'dashboard' },
  { id: 'panel', titulo: 'Panel de control', icono: 'map' },
  { id: 'capturas', titulo: 'Historial de capturas', icono: 'images' },
  { id: 'actividad', titulo: 'Actividad y eventos', icono: 'activity' },
  { id: 'guia', titulo: 'Guía de uso', icono: 'book' },
];

// Enlaces viejos (#mapa, #consola, #camara) llevan al panel unificado.
const ALIAS = { mapa: 'panel', consola: 'panel', camara: 'panel' };

const seccionDeHash = () => {
  const h = ALIAS[window.location.hash.slice(1)] ?? window.location.hash.slice(1);
  return SECCIONES.some((s) => s.id === h) ? h : 'dashboard';
};

function temaInicial() {
  return document.documentElement.dataset.theme === 'light' ? 'claro' : 'oscuro';
}

export default function App() {
  const { datos, conectado } = useParkingState();
  const toast = useToast();

  const [seccion, setSeccion] = useState(seccionDeHash);
  const [menu, setMenu] = useState(false);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  const [capturasVersion, setCapturasVersion] = useState(0);
  const [tema, setTema] = useState(temaInicial);

  // Navegación por hash: sobrevive a recargas y respeta atrás/adelante.
  useEffect(() => {
    const alCambiar = () => setSeccion(seccionDeHash());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  function ir(id) {
    if (window.location.hash.slice(1) !== id) window.location.hash = id;
    setSeccion(id);
    setMenu(false);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'claro' ? 'light' : 'dark';
    try { localStorage.setItem('tema', tema === 'claro' ? 'light' : 'dark'); } catch {}
  }, [tema]);

  // Notificaciones de conexión: solo en las transiciones, nunca por mensaje.
  const huboConexion = useRef(false);
  const caido = useRef(false);
  useEffect(() => {
    if (conectado) {
      if (caido.current) toast({ tipo: 'ok', titulo: 'Conexión restablecida' });
      caido.current = false;
      huboConexion.current = true;
    } else if (huboConexion.current && !caido.current) {
      caido.current = true;
      toast({ tipo: 'error', titulo: 'Conexión perdida', texto: 'Reintentando conectar con el servidor…' });
    }
  }, [conectado, toast]);

  const espacios = datos?.espacios;
  const alarmas = useMemo(() => (espacios ?? []).filter((e) => e.estado === 'ALARMA'), [espacios]);

  // Alarma sonora en la computadora; una alarma nueva la vuelve a activar.
  const [silenciada, setSilenciada] = useState(false);
  const { bloqueada: sonidoBloqueado } = useSirena(alarmas.length > 0 && !silenciada);

  // Una notificación por alarma nueva, no por cada actualización.
  const alarmasPrevias = useRef(null);
  useEffect(() => {
    if (!espacios) return;
    if (alarmasPrevias.current) {
      for (const a of alarmas) {
        if (!alarmasPrevias.current.has(a.espacio_id)) {
          toast({ tipo: 'alarma', titulo: `Alarma en ${a.espacio}`, texto: a.placa ?? 'Vehículo no registrado', duracion: 8000 });
          setSilenciada(false);
        }
      }
    }
    alarmasPrevias.current = new Set(alarmas.map((a) => a.espacio_id));
  }, [alarmas, espacios, toast]);

  async function accion(fn, exito) {
    try {
      await fn();
      if (exito) toast({ tipo: 'ok', titulo: exito });
    } catch (e) {
      toast({ tipo: 'error', titulo: 'No se pudo completar la acción', texto: e.message });
    }
  }

  const seleccionar = (id) => accion(() => post('/api/seleccionar', { espacio_id: id }));
  const mover = (e, presente) => accion(() => post('/api/simulador/sensor', { indice: e.indice_led, presente }));
  const reiniciar = () => {
    setConfirmarReinicio(false);
    accion(() => post('/api/reiniciar'), 'Parqueo reiniciado');
  };

  if (!datos) return <Cargando conectado={conectado} />;

  const actual = SECCIONES.find((s) => s.id === seccion);

  return (
    <div className={`app ${alarmas.length ? 'con-alarma' : ''}`}>
      <Sidebar
        secciones={SECCIONES}
        actual={seccion}
        onIr={ir}
        abierto={menu}
        onCerrar={() => setMenu(false)}
        alarmas={alarmas.length}
      />

      <div className="principal">
        <Topbar
          titulo={actual.titulo}
          conectado={conectado}
          modo={datos.modo}
          alarmas={alarmas.length}
          tema={tema}
          onMenu={() => setMenu(true)}
          onAlarmas={() => ir('panel')}
          onReiniciar={() => setConfirmarReinicio(true)}
          onTema={() => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'))}
        />

        {alarmas.length > 0 && (
          <div className="banda-alarma" role="alert">
            <span className="banda-icono"><Icon name="alert" size={18} /></span>
            <div className="banda-txt">
              <strong>Movimiento no autorizado</strong>
              <span>
                {alarmas.map((a) => `${a.espacio} — ${a.placa ?? 'vehículo no registrado'}`).join(' · ')}
              </span>
              {sonidoBloqueado && !silenciada && <small>Haz clic en cualquier parte para activar el sonido.</small>}
            </div>
            <button
              className="icon-btn banda-silencio"
              onClick={() => setSilenciada((s) => !s)}
              aria-label={silenciada ? 'Activar el sonido de la alarma' : 'Silenciar la alarma'}
              title={silenciada ? 'Activar sonido' : 'Silenciar'}
            >
              <Icon name={silenciada ? 'bell' : 'bellOff'} size={18} />
            </button>
            {seccion !== 'panel' && (
              <button className="btn btn-sm btn-alarma" onClick={() => ir('panel')}>
                Ver en el mapa
              </button>
            )}
          </div>
        )}

        <main className="contenido">
          {/* Todas las secciones quedan montadas: cambiar de sección no
              pierde el código de la consola, la foto ni los filtros. */}
          <section className="pagina" hidden={seccion !== 'dashboard'} aria-label="Dashboard">
            <Dashboard datos={datos} conectado={conectado} onIr={ir} />
          </section>
          <section className="pagina" hidden={seccion !== 'panel'} aria-label="Panel de control">
            <Panel
              datos={datos}
              activo={seccion === 'panel'}
              onSeleccionar={seleccionar}
              onMover={mover}
              onCapturaGuardada={() => setCapturasVersion((v) => v + 1)}
            />
          </section>
          <section className="pagina" hidden={seccion !== 'capturas'} aria-label="Historial de capturas">
            <Capturas refrescar={capturasVersion} />
          </section>
          <section className="pagina" hidden={seccion !== 'actividad'} aria-label="Actividad y eventos">
            <Actividad eventos={datos.eventos} />
          </section>
          <section className="pagina" hidden={seccion !== 'guia'} aria-label="Guía de uso">
            <Guia onIr={ir} />
          </section>
        </main>
      </div>

      <Confirmar
        abierto={confirmarReinicio}
        titulo="¿Reiniciar el parqueo?"
        texto="Se borrarán los vehículos registrados, las ocupaciones, las alarmas y la bitácora, y todos los espacios quedarán libres. Las capturas fotográficas se conservan. Esta acción no se puede deshacer."
        accion="Reiniciar parqueo"
        onConfirmar={reiniciar}
        onCancelar={() => setConfirmarReinicio(false)}
      />
    </div>
  );
}

function Cargando({ conectado }) {
  return (
    <div className="cargando" aria-busy="true">
      <div className="cargando-caja">
        <span className="logo logo-lg" aria-hidden="true">P</span>
        <strong>Conectando con el sistema de parqueo…</strong>
        <p>{conectado ? 'Recibiendo el estado inicial.' : 'Esperando al servidor. Se reintentará automáticamente.'}</p>
        <div className="cargando-esqueleto" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => <span key={i} className="skeleton" />)}
        </div>
      </div>
    </div>
  );
}
