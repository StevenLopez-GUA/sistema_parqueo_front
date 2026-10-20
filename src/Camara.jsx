import { useEffect, useRef, useState, useCallback } from 'react';
import Icon from './components/Icon.jsx';
import { Tarjeta, useToast } from './components/ui.jsx';
import { API, ejecutar } from './lib.js';
import { leerPlaca } from './ocrPlaca.js';
import EntradaDialogo from './components/EntradaDialogo.jsx';

/** Formato de placa de Guatemala. Debe coincidir con el lexer del intérprete. */
const PATRON_PLACA = /^[A-Z][0-9]{3}[A-Z]{3}$/;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const conocidos = (p) => [...p].filter((c) => c !== '?').length;

/** Dos lecturas son de la misma placa si coinciden en al menos 4 posiciones leídas. */
function parecidas(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let iguales = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== '?' && a[i] === b[i]) iguales++;
  return iguales >= 4;
}

/** Lectura segura: se procesa sola, sin pedir confirmación. */
const CONFIANZA_AUTOMATICA = 70;

const MOTIVOS = [
  { valor: 'REGISTRO', texto: 'Entrada: registrar y asignar espacio' },
  { valor: 'LLEGADA', texto: 'Llegada: confirmar que se estacionó' },
  { valor: 'SALIDA', texto: 'Salida: autorizar el movimiento' },
  { valor: 'ALARMA', texto: 'Evidencia de alarma (solo foto)' },
  { valor: 'MANUAL', texto: 'Solo guardar la foto' },
];

/** El siguiente paso del vehículo según dónde está ahora. */
function sugerirMotivo(placa, espacios) {
  const e = espacios.find((x) => x.placa === placa);
  if (!e) return 'REGISTRO';
  if (e.estado === 'ASIGNADO') return 'LLEGADA';
  if (e.estado === 'ALARMA') return 'ALARMA';
  return 'SALIDA';
}

/**
 * Qué hace cada acción con esa placa. Llegada y salida usan los mismos
 * comandos de la consola, así las validaciones son idénticas.
 */
function planear(motivo, placa, espacios) {
  const e = espacios.find((x) => x.placa === placa);
  switch (motivo) {
    case 'REGISTRO':
      return e
        ? { texto: `${placa} ya está en el parqueo (${e.espacio}): solo se guardará la foto.`, boton: 'Guardar foto' }
        : { dialogo: true, texto: 'Se preguntará el tipo de vehículo y el espacio.', boton: 'Registrar entrada…' };
    case 'LLEGADA':
      return e
        ? { codigo: `LLEGADA(${placa});`, texto: `Se confirmará la llegada a ${e.espacio}.`, boton: 'Confirmar llegada' }
        : { texto: 'Esta placa no tiene espacio asignado: solo se guardará la foto.', boton: 'Guardar foto' };
    case 'SALIDA':
      if (!e) return { texto: 'Esta placa no está en el parqueo: solo se guardará la foto.', boton: 'Guardar foto' };
      // Ya autorizada: el espacio se libera solo cuando el vehículo sale.
      return e.estado === 'AUTORIZADO'
        ? { texto: `La salida ya está autorizada: ${e.espacio} se libera solo cuando el vehículo sale. Solo se guardará la foto.`, boton: 'Guardar foto' }
        : { codigo: `AUTORIZAR_SALIDA(${placa});`, texto: `Se autorizará la salida de ${e.espacio} y se abrirá la talanquera.`, boton: 'Autorizar salida' };
    default:
      return { texto: 'Solo se guarda la foto.', boton: 'Guardar foto' };
  }
}

/**
 * Captura de vehículos.
 *
 * Con la detección automática encendida, la cámara busca una placa en cada
 * cuadro, toma la foto sola al encontrarla y la lee con OCR. Los botones
 * quedan para casos especiales.
 *
 * El reconocimiento nunca bloquea: rellena el campo, pero el operador
 * siempre puede escribir o corregir la placa. Si el OCR falla, la captura
 * se guarda igual y el flujo continúa.
 *
 * `activa` es false cuando el operador está en otra sección: la cámara se
 * apaga para no dejar el dispositivo abierto, pero la foto y el formulario
 * se conservan.
 */
export default function Camara({ onCapturaGuardada, activa = true, espacios = [], reservas = [] }) {
  const toast = useToast();
  // El ciclo de detección y la lectura corren fuera del render: leen el
  // parqueo actual desde aquí.
  const espaciosRef = useRef(espacios);
  espaciosRef.current = espacios;
  // Si el operador eligió la acción a mano, no se la cambia la sugerencia.
  const motivoTocadoRef = useRef(false);
  const videoRef = useRef(null);
  const lienzoRef = useRef(null);
  const flujoRef = useRef(null);
  // Cada lectura lleva un número: si la foto se descarta mientras se lee,
  // el resultado viejo se ignora.
  const lecturaRef = useRef(0);
  // Última placa capturada sola: no vuelve a disparar hasta que salga de cuadro.
  const bloqueadaRef = useRef(null);

  const [encendida, setEncendida] = useState(false);
  const [error, setError] = useState(null);
  const [foto, setFoto] = useState(null);

  // Con la cámara de la maqueta conectada hay más de una cámara en la
  // laptop, así que el operador tiene que poder elegir cuál usar.
  const [dispositivos, setDispositivos] = useState([]);
  const [dispositivoId, setDispositivoId] = useState('');

  const [motivo, setMotivo] = useState('REGISTRO');
  const [placa, setPlaca] = useState('');
  const [detectada, setDetectada] = useState(null);
  const [metodo, setMetodo] = useState('NINGUNO');
  const [confianza, setConfianza] = useState(null);

  const [leyendoOcr, setLeyendoOcr] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [recorte, setRecorte] = useState(null);

  const [auto, setAuto] = useState(true);
  const [entrada, setEntrada] = useState(null); // datos de la captura mientras se elige el espacio
  const [estadoAuto, setEstadoAuto] = useState(null); // { texto, viendo }

  // ------------------------------------------------------------------
  // Encender y apagar la cámara
  // ------------------------------------------------------------------

  /**
   * Lista las cámaras conectadas.
   * El navegador solo revela sus nombres después de que el usuario
   * concedió permiso una vez, así que esto se llama tras encender.
   */
  const listarCamaras = useCallback(async () => {
    try {
      const todos = await navigator.mediaDevices.enumerateDevices();
      const camaras = todos.filter((d) => d.kind === 'videoinput');
      setDispositivos(camaras);
      return camaras;
    } catch {
      return [];
    }
  }, []);

  async function encender(idForzado) {
    setError(null);
    const id = idForzado ?? dispositivoId;

    try {
      // Si ya había una cámara abierta, se cierra antes de abrir la otra:
      // dos flujos simultáneos sobre el mismo dispositivo fallan.
      flujoRef.current?.getTracks().forEach((t) => t.stop());

      const flujo = await navigator.mediaDevices.getUserMedia({
        video: id
          ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      flujoRef.current = flujo;
      if (videoRef.current) {
        videoRef.current.srcObject = flujo;
        await videoRef.current.play();
      }
      setEncendida(true);

      // Con el permiso ya concedido, ahora sí se ven los nombres.
      const camaras = await listarCamaras();
      if (!id && camaras.length) {
        const activo = flujo.getVideoTracks()[0]?.getSettings()?.deviceId;
        setDispositivoId(activo ?? camaras[0].deviceId);
      }
    } catch (e) {
      setError(
        e.name === 'NotAllowedError'
          ? 'El navegador bloqueó el acceso a la cámara. Permitilo en el candado de la barra de direcciones.'
          : e.name === 'NotFoundError'
            ? 'No se encontró ninguna cámara conectada.'
            : `No se pudo abrir la cámara: ${e.message}`
      );
    }
  }

  const apagar = useCallback(() => {
    flujoRef.current?.getTracks().forEach((t) => t.stop());
    flujoRef.current = null;
    setEncendida(false);
  }, []);

  useEffect(() => apagar, [apagar]);

  // Al salir de la sección se libera la cámara.
  useEffect(() => {
    if (!activa) apagar();
  }, [activa, apagar]);

  // ------------------------------------------------------------------
  // Detección automática
  //
  // Mientras la cámara está en vivo se analiza un cuadro tras otro (cada
  // análisis descarta rápido los cuadros sin un papel con caracteres). La
  // foto se toma sola cuando la misma placa aparece en dos cuadros
  // seguidos, para no disparar con la imagen movida.
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!encendida || foto || !auto) {
      setEstadoAuto(null);
      return;
    }
    let vivo = true;
    let anterior = null;

    (async () => {
      setEstadoAuto({ texto: 'Buscando placa…', viendo: false });
      while (vivo) {
        const video = videoRef.current;
        if (video?.readyState === 4) {
          const cuadro = document.createElement('canvas');
          cuadro.width = video.videoWidth;
          cuadro.height = video.videoHeight;
          cuadro.getContext('2d').drawImage(video, 0, 0);
          try {
            const r = await leerPlaca(cuadro, { rapido: true });
            if (!vivo) return;
            const candidato = r.placa ?? (r.parcial && conocidos(r.parcial) >= 4 ? r.parcial : null);

            if (!candidato) {
              bloqueadaRef.current = null; // la placa anterior ya salió de cuadro
              anterior = null;
              setEstadoAuto({ texto: 'Buscando placa…', viendo: false });
            } else if (parecidas(candidato, bloqueadaRef.current)) {
              setEstadoAuto({ texto: 'Esa placa ya se capturó. Retírala para detectar otra.', viendo: false });
            } else if (parecidas(candidato, anterior)) {
              bloqueadaRef.current = candidato;
              capturar(cuadro, true);
              return;
            } else {
              anterior = candidato;
              setEstadoAuto({ texto: `Placa a la vista: ${candidato}. Confirmando…`, viendo: true });
            }
          } catch (e) {
            if (!vivo) return;
            setEstadoAuto({ texto: `Detección no disponible: ${e.message}`, viendo: false });
            await esperar(3000);
          }
        }
        await esperar(300);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [encendida, foto, auto]);

  // ------------------------------------------------------------------
  // Tomar la foto (sola o con el botón) y leerla
  // ------------------------------------------------------------------

  function capturar(lienzo, automatica) {
    const nueva = { imagen: lienzo.toDataURL('image/jpeg', 0.85), ancho: lienzo.width, alto: lienzo.height };
    setFoto(nueva);
    motivoTocadoRef.current = false;
    if (automatica) toast({ tipo: 'info', titulo: 'Placa detectada', texto: 'Foto tomada automáticamente.' });
    leerConOcr(nueva);
  }

  function tomarFoto() {
    const video = videoRef.current;
    const lienzo = lienzoRef.current;
    if (!video || !lienzo) return;

    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext('2d').drawImage(video, 0, 0);
    capturar(lienzo, false);
  }

  function descartar() {
    lecturaRef.current++;
    setLeyendoOcr(false);
    setFoto(null);
    setDetectada(null);
    setMetodo('NINGUNO');
    setConfianza(null);
    setAviso(null);
    setRecorte(null);
  }

  // ------------------------------------------------------------------
  // OCR
  //
  // Corre solo después de cada foto; el botón queda para reintentar.
  // Tesseract (varios MB de WebAssembly) se carga recién la primera vez.
  // El recorte del papel y la limpieza de la imagen están en ocrPlaca.js.
  // ------------------------------------------------------------------

  async function leerConOcr(f = foto) {
    if (!f) return;
    const id = ++lecturaRef.current;
    setLeyendoOcr(true);
    setAviso('Leyendo la placa…');

    try {
      const r = await leerPlaca(f.imagen);
      if (id !== lecturaRef.current) return; // la foto se descartó mientras se leía
      setRecorte(r.recorte);

      if (r.placa) {
        setDetectada(r.placa);
        setPlaca(r.placa);
        setMetodo('OCR');
        setConfianza(r.confianza);
        const sugerido = motivoTocadoRef.current ? motivo : sugerirMotivo(r.placa, espaciosRef.current);
        setMotivo(sugerido);
        if (r.confianza >= CONFIANZA_AUTOMATICA) {
          // Lectura segura: se guarda y se procesa sin preguntar.
          setAviso(`OCR leyó ${r.placa} con ${Math.round(r.confianza)}% de confianza. Procesando…`);
          procesar({ foto: f, placa: r.placa, detectada: r.placa, metodo: 'OCR', confianza: r.confianza, motivo: sugerido });
        } else {
          setAviso(`OCR leyó ${r.placa} con ${Math.round(r.confianza)}% de confianza. Verificá y confirmá.`);
        }
      } else if (r.parcial) {
        // Lectura incompleta: se deja en el campo para completar solo los '?'.
        const faltan = [...r.parcial].filter((c) => c === '?').length;
        setDetectada(r.parcial);
        setPlaca(r.parcial);
        setMetodo('OCR');
        setConfianza(r.confianza);
        setAviso(`OCR leyó ${r.parcial}: no reconoció ${faltan} ${faltan === 1 ? 'carácter' : 'caracteres'} (marcados con ?). Completalos a mano.`);
      } else {
        setAviso(
          r.texto
            ? `El OCR leyó "${r.texto.slice(0, 20)}", que no tiene formato de placa. Escribila a mano.`
            : 'El OCR no encontró texto legible. Escribí la placa a mano.'
        );
      }
    } catch (e) {
      if (id === lecturaRef.current) setAviso(`El OCR no está disponible: ${e.message}. Escribí la placa a mano.`);
    } finally {
      if (id === lecturaRef.current) setLeyendoOcr(false);
    }
  }

  // ------------------------------------------------------------------
  // Guardar
  // ------------------------------------------------------------------

  /** Guarda la foto con los mismos datos de siempre en /api/captura. */
  async function guardarCaptura(v) {
    const r = await fetch(`${API}/api/captura`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagen: v.foto.imagen,
        motivo: v.motivo,
        ancho: v.foto.ancho,
        alto: v.foto.alto,
        placaDetectada: v.detectada,
        placaConfirmada: v.placa.toUpperCase() || null,
        metodoLectura: v.placa && !v.detectada ? 'MANUAL' : v.metodo,
        confianza: v.confianza,
      }),
    });
    if (!r.ok) throw new Error((await r.json()).error ?? 'Error del servidor');
    const captura = await r.json();
    onCapturaGuardada?.(captura);
    return captura;
  }

  function terminar(texto) {
    descartar();
    setPlaca('');
    setAviso(texto);
  }

  /**
   * Guarda la captura y hace la acción que corresponde. La entrada primero
   * pregunta el espacio. La foto se guarda aunque la acción falle: es la
   * evidencia de lo que pasó.
   */
  async function procesar(v) {
    const plan = planear(v.motivo, v.placa, espaciosRef.current);
    if (plan.dialogo) {
      setEntrada(v);
      return;
    }
    setGuardando(true);
    try {
      // Antes de una SALIDA se guarda la foto: después ya no hay ocupación a la que asociarla.
      const captura = await guardarCaptura(v);
      if (!plan.codigo) {
        toast({ tipo: 'ok', titulo: 'Captura guardada', texto: `#${captura.id} · ${captura.placa_confirmada ?? 'sin placa'}` });
        terminar(`Captura guardada (#${captura.id}).`);
        return;
      }
      const res = await ejecutar(plan.codigo);
      if (res.ok) {
        toast({ tipo: 'ok', titulo: res.mensaje, texto: `Captura #${captura.id} guardada.` });
        terminar(res.mensaje);
      } else {
        toast({ tipo: 'error', titulo: 'La foto se guardó, pero la acción no se pudo hacer', texto: res.mensaje, duracion: 8000 });
        terminar(`Foto guardada (#${captura.id}). ${res.mensaje}`);
      }
    } catch (e) {
      setAviso(`No se pudo guardar: ${e.message}`);
      toast({ tipo: 'error', titulo: 'No se pudo guardar la captura', texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  /** Respuesta del diálogo de entrada. */
  async function alTerminarEntrada(res) {
    const v = entrada;
    setEntrada(null);
    setGuardando(true);
    try {
      // Después de asignar: así la captura queda asociada al espacio.
      const captura = await guardarCaptura(v);
      if (res.lleno) {
        toast({ tipo: 'alarma', titulo: 'Parqueo lleno', texto: res.mensaje, duracion: 10000 });
        terminar(`${res.mensaje}. Foto guardada (#${captura.id}).`);
      } else {
        toast({ tipo: 'ok', titulo: res.mensaje, texto: `Entrada registrada · captura #${captura.id}` });
        terminar(res.mensaje);
      }
    } catch (e) {
      toast({ tipo: 'error', titulo: 'La entrada se registró, pero la foto no se guardó', texto: e.message });
      terminar(res.mensaje);
    } finally {
      setGuardando(false);
    }
  }

  function guardar() {
    procesar({ foto, placa, detectada, metodo, confianza, motivo });
  }

  // Al completar o corregir la placa a mano, se vuelve a sugerir la acción.
  useEffect(() => {
    if (foto && PATRON_PLACA.test(placa) && !motivoTocadoRef.current) {
      setMotivo(sugerirMotivo(placa, espacios));
    }
  }, [placa, espacios, foto]);

  const placaValida = placa === '' || PATRON_PLACA.test(placa.toUpperCase());
  const placaCompleta = placa !== '' && placaValida;
  const lecturaManual = placa !== '' && !detectada;
  const plan = placaCompleta ? planear(motivo, placa, espacios) : null;

  // ------------------------------------------------------------------

  return (
    <Tarjeta
      titulo="Cámara y reconocimiento"
      icono="camera"
      className="camara"
      extra={
        <span className={`pill ${encendida ? 'pill-ok' : ''}`}>
          <span className="punto" />
          {foto ? 'Foto capturada' : encendida ? 'En vivo' : 'Apagada'}
        </span>
      }
    >
      {/* En columnas anchas la vista y el formulario van lado a lado. */}
      <div className="camara-cuerpo">
        <div className="camara-vista">
          {error && (
            <div className="aviso aviso-error" role="alert">
              <Icon name="alertCircle" size={16} />
              {error}
            </div>
          )}

          <div className={`visor ${encendida && !foto ? 'en-vivo' : ''} ${estadoAuto?.viendo ? 'viendo' : ''}`}>
            {!encendida && !foto && (
              <div className="visor-apagado">
                <span className="visor-icono"><Icon name="camera" size={28} /></span>
                <p>La cámara está apagada.</p>
                <button className="btn btn-primario" onClick={() => encender()}>
                  <Icon name="power" size={16} />
                  Encender cámara
                </button>
              </div>
            )}

            <video
              ref={videoRef}
              playsInline
              muted
              style={{ display: encendida && !foto ? 'block' : 'none' }}
            />

            {foto && <img src={foto.imagen} alt="Captura del vehículo" />}
            <canvas ref={lienzoRef} style={{ display: 'none' }} />

            {encendida && !foto && (
              <>
                <span className="visor-marco" aria-hidden="true"><i /><i /><i /><i /></span>
                <span className="visor-etq" role="status">
                  <span className="rec" />
                  {auto ? estadoAuto?.texto ?? 'Buscando placa…' : 'Detección automática apagada'}
                </span>
              </>
            )}
          </div>

          <div className="visor-controles">
            {encendida && !foto && (
              <button className={`btn ${auto ? 'btn-ghost' : 'btn-primario'}`} onClick={tomarFoto}>
                <Icon name="camera" size={16} />
                Tomar foto
              </button>
            )}
            <label className="interruptor" title="Toma la foto sola al detectar una placa">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <span className="interruptor-pista" aria-hidden="true" />
              Automático
            </label>
            {foto && (
              <button className="btn btn-ghost" onClick={descartar}>
                <Icon name="reset" size={16} />
                {encendida ? 'Descartar y volver al vivo' : 'Descartar foto'}
              </button>
            )}
            {encendida && dispositivos.length > 1 && (
              <select
                className="campo campo-sm"
                value={dispositivoId}
                onChange={(e) => {
                  setDispositivoId(e.target.value);
                  encender(e.target.value);
                }}
                aria-label="Elegir cámara"
              >
                {dispositivos.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            <span className="espaciador" />
            {encendida ? (
              <button className="btn btn-ghost" onClick={apagar}>
                <Icon name="power" size={16} />
                Apagar
              </button>
            ) : (
              foto && (
                <button className="btn btn-ghost" onClick={() => encender()}>
                  <Icon name="power" size={16} />
                  Encender
                </button>
              )
            )}
          </div>

        </div>

        <div className="camara-reconocimiento">
          <h3><Icon name="scan" size={15} /> Reconocimiento de placa</h3>
          <div className="reconocimiento">
            <span className={`chip ${auto ? 'chip-info' : ''}`}>
              <Icon name="radio" size={14} /> {auto ? 'Detección automática' : 'Detección manual'}
            </span>
            <span className={`chip ${metodo === 'OCR' ? 'chip-ok' : ''}`}>
              <Icon name="scan" size={14} /> {metodo === 'OCR' ? 'OCR completado' : 'OCR'}
            </span>
            <span className={`chip ${lecturaManual ? 'chip-info' : ''}`}>
              <Icon name="keyboard" size={14} /> Manual
            </span>
          </div>

          <div className="confianza">
            <div className="medidor-txt">
              <span>Confianza de la lectura</span>
              <strong>{confianza !== null ? `${confianza}%` : '—'}</strong>
            </div>
            <div className={`barra ${confianza !== null && confianza < 60 ? 'barra-warn' : ''}`}>
              <span style={{ width: `${confianza ?? 0}%` }} />
            </div>
          </div>

          {recorte && (
            <figure className="ocr-recorte">
              <img src={recorte} alt="Placa recortada y en blanco y negro, tal como la leyó el OCR" />
              <figcaption>Lo que analizó el OCR</figcaption>
            </figure>
          )}

          <div className="formulario">
            <label className="campo-grupo">
              <span>Placa</span>
              <div className="placa-campo">
                <input
                  className={`campo campo-placa ${placaValida ? '' : 'invalido'}`}
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  placeholder="P123ABC"
                  maxLength={7}
                  aria-invalid={!placaValida}
                  aria-describedby="placa-ayuda"
                />
                {placa && (
                  <span className={`placa-estado ${placaValida ? 'ok' : 'err'}`} aria-hidden="true">
                    <Icon name={placaValida ? 'checkCircle' : 'alertCircle'} size={18} />
                  </span>
                )}
              </div>
              <small id="placa-ayuda" className={placaValida ? '' : 'txt-err'}>
                {!placaValida
                  ? placa.includes('?')
                    ? 'Reemplazá cada ? por el carácter que falta.'
                    : 'La placa debe tener el formato P123ABC.'
                  : placaCompleta
                    ? 'Formato de placa válido.'
                    : 'Se llena sola al detectar la placa, o escríbela a mano.'}
              </small>
            </label>

            {detectada && detectada !== placa && (
              <div className="aviso aviso-info">
                <Icon name="info" size={16} />
                <span>
                  La máquina leyó <strong>{detectada}</strong> y vos lo corregiste a <strong>{placa}</strong>. Se van a
                  guardar ambos.
                </span>
              </div>
            )}

            <label className="campo-grupo">
              <span>Acción al guardar</span>
              <select
                className="campo"
                value={motivo}
                onChange={(e) => {
                  motivoTocadoRef.current = true;
                  setMotivo(e.target.value);
                }}
              >
                {MOTIVOS.map((m) => (
                  <option key={m.valor} value={m.valor}>{m.texto}</option>
                ))}
              </select>
              <small className="accion-plan">
                <Icon name="info" size={13} />
                {plan ? plan.texto : 'Se sugiere sola según dónde está el vehículo.'}
              </small>
            </label>

            <div className="formulario-acciones">
              <button className="btn btn-primario" onClick={guardar} disabled={!foto || guardando || !placaValida || !!entrada}>
                <Icon name={guardando ? 'loader' : 'save'} size={16} className={guardando ? 'girando' : ''} />
                {guardando ? 'Guardando…' : plan?.boton ?? 'Guardar foto'}
              </button>
              <button className="btn btn-ghost" onClick={() => leerConOcr()} disabled={!foto || leyendoOcr}>
                <Icon name={leyendoOcr ? 'loader' : 'reset'} size={16} className={leyendoOcr ? 'girando' : ''} />
                {leyendoOcr ? 'Leyendo…' : 'Volver a leer'}
              </button>
            </div>
            {!foto && (
              <p className="nota">
                {auto
                  ? 'Muestra la placa a la cámara: la foto se toma y se lee sola.'
                  : 'Toma una foto: la placa se lee sola.'}
              </p>
            )}
          </div>

          {aviso && (
            <div className="aviso aviso-neutro" role="status">
              <Icon name="info" size={16} />
              {aviso}
            </div>
          )}
        </div>
      </div>

      <EntradaDialogo
        placa={entrada?.placa ?? null}
        espacios={espacios}
        reservas={reservas}
        onTerminado={alTerminarEntrada}
        onCancelar={() => {
          setEntrada(null);
          setAviso('Entrada cancelada. La foto sigue disponible: puedes cambiar la acción o reintentar.');
        }}
      />
    </Tarjeta>
  );
}
