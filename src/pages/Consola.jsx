import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { EstadoBadge, Tarjeta, useToast } from '../components/ui.jsx';
import { API } from '../lib.js';

const EJEMPLO = `REGISTRAR(compacto,P123ABC);
ASIGNAR(P123ABC);
CONSULTAR();`;

// Solo para colorear: el análisis real lo sigue haciendo el backend.
const COMANDOS = new Set(['REGISTRAR', 'ASIGNAR', 'LLEGADA', 'AUTORIZAR_SALIDA', 'SALIDA', 'APAGAR_ALARMA', 'CONSULTAR']);
const TIPOS_VEHICULO = new Set(['compacto', 'grande', 'moto', 'carga']);
const PLACA = /^[A-Z][0-9]{3}[A-Z]{3}$/;

const REFERENCIA = [
  { firma: 'REGISTRAR(tipo,PLACA);', ej: 'REGISTRAR(compacto,P123ABC);' },
  { firma: 'ASIGNAR(PLACA);', ej: 'ASIGNAR(P123ABC);' },
  { firma: 'LLEGADA(PLACA);', ej: 'LLEGADA(P123ABC);' },
  { firma: 'AUTORIZAR_SALIDA(PLACA);', ej: 'AUTORIZAR_SALIDA(P123ABC);' },
  { firma: 'SALIDA(PLACA);', ej: 'SALIDA(P123ABC);' },
  { firma: 'APAGAR_ALARMA(PLACA);', ej: 'APAGAR_ALARMA(P123ABC);' },
  { firma: 'CONSULTAR();', ej: 'CONSULTAR();' },
];

const CLASE_ERROR = {
  ERROR_LEXICO: 'Léxico',
  ERROR_SINTACTICO: 'Sintáctico',
  ERROR_SEMANTICO: 'Semántico',
  ERROR_HARDWARE: 'Hardware',
};

function resaltar(codigo, desconocida = 'tk-err') {
  const partes = [];
  const re = /(#[^\n]*)|([A-Za-z0-9_]+)|([();,])|(\s+)|([^\sA-Za-z0-9_();,#]+)/g;
  let m;
  let i = 0;
  while ((m = re.exec(codigo))) {
    const [t, comentario, palabra, simbolo, , otro] = m;
    let clase = null;
    if (comentario) clase = 'tk-com';
    else if (palabra) {
      const mayus = palabra.toUpperCase();
      clase = COMANDOS.has(mayus)
        ? 'tk-cmd'
        : TIPOS_VEHICULO.has(palabra.toLowerCase())
          ? 'tk-tipo'
          : PLACA.test(mayus)
            ? 'tk-placa'
            : desconocida;
    } else if (simbolo) clase = 'tk-sim';
    else if (otro) clase = 'tk-err';
    partes.push(clase ? <span key={i++} className={clase}>{t}</span> : t);
  }
  return partes;
}

const leerAbierta = () => {
  try {
    return localStorage.getItem('consola-abierta') === '1';
  } catch {
    return false;
  }
};

export default function Consola() {
  const toast = useToast();
  // Plegada por defecto: en el día a día se trabaja con la cámara y el mapa.
  const [abierta, setAbierta] = useState(leerAbierta);
  const [codigo, setCodigo] = useState(EJEMPLO);
  const [resultado, setResultado] = useState(null);
  const [ejecutando, setEjecutando] = useState(false);
  const areaRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);

  async function ejecutar() {
    setEjecutando(true);
    try {
      const r = await fetch(`${API}/api/ejecutar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      const res = await r.json();
      setResultado(res);
      const nErr = res.errores?.length ?? 0;
      const nOk = res.salidas?.length ?? 0;
      toast(
        nErr
          ? { tipo: 'error', titulo: `${nErr} ${nErr === 1 ? 'error' : 'errores'} en el código`, texto: nOk ? `${nOk} instrucciones sí se ejecutaron.` : undefined }
          : { tipo: 'ok', titulo: 'Comandos ejecutados', texto: `${nOk} ${nOk === 1 ? 'instrucción' : 'instrucciones'} sin errores.` }
      );
    } catch {
      setResultado({ errores: [{ clase: 'ERROR_HARDWARE', mensaje: 'No hay conexion con el servidor', linea: 0, columna: 0 }], salidas: [] });
      toast({ tipo: 'error', titulo: 'Sin conexión', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setEjecutando(false);
    }
  }

  // La Guía de uso carga ejemplos aquí sin ejecutarlos.
  useEffect(() => {
    const cargar = (e) => {
      setAbierta(true);
      setCodigo(e.detail);
      setResultado(null);
      // Espera a que el panel sea visible antes de enfocar.
      setTimeout(() => {
        areaRef.current?.focus({ preventScroll: true });
        areaRef.current?.closest('.tarjeta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    };
    window.addEventListener('consola:cargar', cargar);
    return () => window.removeEventListener('consola:cargar', cargar);
  }, []);

  function alTeclear(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); ejecutar(); }
  }

  function sincronizarScroll(e) {
    const { scrollTop, scrollLeft } = e.target;
    preRef.current.scrollTop = scrollTop;
    preRef.current.scrollLeft = scrollLeft;
    gutterRef.current.scrollTop = scrollTop;
  }

  /** Lleva el cursor a la línea y columna de un error. */
  function irA(linea, columna) {
    const ta = areaRef.current;
    if (!ta || !linea) return;
    const lineas = codigo.split('\n');
    let pos = 0;
    for (let i = 0; i < linea - 1 && i < lineas.length; i++) pos += lineas[i].length + 1;
    pos = Math.min(pos + Math.max((columna || 1) - 1, 0), codigo.length);
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }

  function insertar(texto) {
    setCodigo((c) => (c.trim() ? `${c.replace(/\s+$/, '')}\n${texto}` : texto));
    areaRef.current?.focus();
  }

  const errores = resultado?.errores ?? [];
  const salidas = resultado?.salidas ?? [];
  const lineasConError = new Set(errores.map((e) => e.linea));
  const nLineas = codigo.split('\n').length;

  function alternar() {
    setAbierta((a) => {
      try {
        localStorage.setItem('consola-abierta', a ? '0' : '1');
      } catch {}
      return !a;
    });
  }

  return (
    <Tarjeta
      titulo="Consola de comandos"
      icono="terminal"
      className={`consola ${abierta ? '' : 'plegada'}`}
      extra={
        <div className="consola-extra">
          {abierta && <kbd className="atajo">Ctrl / ⌘ + Enter</kbd>}
          <button className="btn btn-ghost btn-sm" onClick={alternar} aria-expanded={abierta} aria-controls="consola-cuerpo">
            <Icon name="chevron" size={15} className={abierta ? 'girar-arriba' : 'girar-abajo'} />
            {abierta ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      }
    >
      {!abierta && (
        <p className="nota consola-resumen">
          Lenguaje formal del proyecto (REGISTRAR, ASIGNAR, LLEGADA, AUTORIZAR_SALIDA, SALIDA, APAGAR_ALARMA, CONSULTAR)
          para casos manuales.
        </p>
      )}
      <div id="consola-cuerpo" hidden={!abierta}>
      <div className="editor">
        <div className="editor-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: nLineas }, (_, i) => (
            <span key={i} className={lineasConError.has(i + 1) ? 'err' : ''}>{i + 1}</span>
          ))}
        </div>
        <div className="editor-area">
          <pre className="editor-resaltado" ref={preRef} aria-hidden="true">
            {resaltar(codigo)}
            {'\n'}
          </pre>
          <textarea
            ref={areaRef}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={alTeclear}
            onScroll={sincronizarScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            aria-label="Código del lenguaje de parqueo"
          />
        </div>
      </div>

      <div className="editor-pie">
        <button className="btn btn-primario" onClick={ejecutar} disabled={ejecutando}>
          <Icon name={ejecutando ? 'loader' : 'play'} size={16} className={ejecutando ? 'girando' : ''} />
          {ejecutando ? 'Ejecutando…' : 'Ejecutar'}
        </button>
        <button className="btn btn-ghost" onClick={() => setCodigo('')} disabled={!codigo}>
          <Icon name="trash" size={16} />
          Limpiar
        </button>
      </div>

      <details className="plegable">
        <summary>
          <Icon name="keyboard" size={15} />
          Referencia del lenguaje
          <span className="nota-inline">clic para insertar</span>
        </summary>
        <ul className="referencia">
          {REFERENCIA.map((r) => (
            <li key={r.firma}>
              <button onClick={() => insertar(r.ej)} title={`Insertar ${r.ej}`}>
                <code>{resaltar(r.firma, 'tk-param')}</code>
              </button>
            </li>
          ))}
        </ul>
        <p className="nota">
          Tipos: <code>compacto · grande · moto · carga</code> · Placa: <code>P123ABC</code> · Comentario: <code># texto</code>
        </p>
      </details>

      <div className="consola-resultado">
        <h3><Icon name="list" size={15} /> Resultado</h3>
        {!resultado ? (
          <p className="nota">Aún no se ha ejecutado nada. Escribe instrucciones y presiona Ejecutar.</p>
        ) : (
          <Salida resultado={resultado} errores={errores} salidas={salidas} onIrA={irA} />
        )}
      </div>
      </div>
    </Tarjeta>
  );
}

function Salida({ resultado, errores, salidas, onIrA }) {
  return (
    <div className="salida">
      <div className="salida-resumen">
        <span className={`chip ${errores.length ? 'chip-err' : 'chip-ok'}`}>
          <Icon name={errores.length ? 'alertCircle' : 'checkCircle'} size={14} />
          {errores.length ? `${errores.length} ${errores.length === 1 ? 'error' : 'errores'}` : 'Sin errores'}
        </span>
        <span className="chip">
          <Icon name="play" size={12} />
          {resultado.ejecutadas ?? salidas.length} ejecutadas
        </span>
      </div>

      {errores.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Tipo</th><th>Ln</th><th>Col</th><th>Descripción</th></tr>
            </thead>
            <tbody>
              {errores.map((e, i) => (
                <tr key={i} className="fila-clic" onClick={() => onIrA(e.linea, e.columna)} title="Ir a la línea">
                  <td><span className={`etq ${e.clase}`}>{CLASE_ERROR[e.clase] ?? e.clase.replace('ERROR_', '').toLowerCase()}</span></td>
                  <td className="mono">{e.linea}</td>
                  <td className="mono">{e.columna}</td>
                  <td>{e.mensaje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {salidas.length > 0 && (
        <ul className="salidas">
          {salidas.map((s, i) => (
            <li key={i}>
              <Icon name="checkCircle" size={15} />
              <div>
                <code>{s.comando}</code>
                <p>{s.mensaje}</p>
                {s.tabla && <TablaConsulta filas={s.tabla} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {errores.length === 0 && salidas.length === 0 && (
        <p className="nota">No hay instrucciones que ejecutar.</p>
      )}
    </div>
  );
}

/** Resultado de CONSULTAR(): la vista v_estado_parqueo que devuelve el backend. */
function TablaConsulta({ filas }) {
  return (
    <div className="tabla-scroll">
      <table className="tabla tabla-compacta">
        <thead>
          <tr><th>Espacio</th><th>Tipo</th><th>Estado</th><th>Placa</th><th>Sensor</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.espacio_id}>
              <td className="mono">{f.espacio}</td>
              <td>{f.tipo_espacio}</td>
              <td><EstadoBadge estado={f.estado} /></td>
              <td className="mono">{f.placa ?? '—'}</td>
              <td>{f.sensor_ocupado ? 'Detecta' : 'Libre'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
