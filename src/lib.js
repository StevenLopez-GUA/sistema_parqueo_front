/** Configuración y catálogos compartidos por toda la interfaz. */

export const API = import.meta.env.VITE_API ?? 'http://localhost:8080';
export const WS = API.replace(/^http/, 'ws');

export const ESTADOS = {
  LIBRE:          { etiqueta: 'Libre',             icono: 'check' },
  ASIGNADO:       { etiqueta: 'Asignado',          icono: 'clock' },
  OCUPADO:        { etiqueta: 'Ocupado',           icono: 'car' },
  AUTORIZADO:     { etiqueta: 'Autorizado',        icono: 'shield' },
  ALARMA:         { etiqueta: 'Alarma',            icono: 'alert' },
  FUERA_SERVICIO: { etiqueta: 'Fuera de servicio', icono: 'ban' },
};

export const TIPOS = {
  compacto:  { etiqueta: 'Compacto',  plural: 'Compactos',        icono: 'car' },
  grande:    { etiqueta: 'Grande',    plural: 'Grandes',          icono: 'truck' },
  moto:      { etiqueta: 'Moto',      plural: 'Motos',            icono: 'bike' },
  carga:     { etiqueta: 'Carga',     plural: 'Carga y descarga', icono: 'package' },
  reservado: { etiqueta: 'Privado',   plural: 'Privados',         icono: 'bookmark' },
};

export const MODOS = {
  simulador: 'Simulador',
  serial: 'Arduino · USB',
  http: 'Arduino · WiFi',
};

/** Petición con JSON (POST por defecto). Lanza un Error legible si el servidor responde con error. */
export async function post(ruta, cuerpo, metodo = 'POST') {
  let r;
  try {
    r = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
    });
  } catch {
    throw new Error('No hay conexión con el servidor');
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.error ?? `El servidor respondió ${r.status}`);
  return datos;
}

/** Ejecuta código del lenguaje, igual que la consola. Resume el resultado en un mensaje. */
export async function ejecutar(codigo) {
  try {
    const r = await fetch(`${API}/api/ejecutar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    const res = await r.json();
    const error = res.errores?.[0];
    return error ? { ok: false, mensaje: error.mensaje } : { ok: true, mensaje: res.salidas?.[0]?.mensaje ?? 'Listo' };
  } catch {
    return { ok: false, mensaje: 'No hay conexión con el servidor' };
  }
}
