import { useEffect, useState } from 'react';
import { API, WS } from '../lib.js';

/**
 * Estado en vivo del parqueo: una sola conexión WebSocket para toda la app,
 * con respaldo por HTTP en el primer render y reconexión automática.
 */
export function useParkingState() {
  const [datos, setDatos] = useState(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    let vivo = true;
    let socket;
    let reintento;

    fetch(`${API}/api/estado`)
      .then((r) => r.json())
      .then((d) => vivo && setDatos(d))
      .catch(() => {});

    const conectar = () => {
      socket = new WebSocket(WS);
      socket.onopen = () => setConectado(true);
      socket.onmessage = (e) => setDatos(JSON.parse(e.data));
      socket.onclose = () => {
        setConectado(false);
        // Sin esta guarda, el cierre del desmontaje programaría una
        // reconexión huérfana (y en StrictMode, un segundo socket).
        if (vivo) reintento = setTimeout(conectar, 1500);
      };
    };
    conectar();

    return () => {
      vivo = false;
      clearTimeout(reintento);
      socket?.close();
    };
  }, []);

  return { datos, conectado };
}
