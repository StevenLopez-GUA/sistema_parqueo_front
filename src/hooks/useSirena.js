import { useEffect, useState } from 'react';

/**
 * Alarma sonora en la computadora: dos tonos cada 1.2 s mientras `activa`.
 * Se genera con Web Audio, sin archivos de sonido.
 *
 * Los navegadores no dejan reproducir audio hasta que el usuario toca la
 * página; el contexto se habilita con el primer clic o tecla. Mientras
 * tanto `bloqueada` es true, para poder avisarlo en pantalla.
 */
let contexto = null;

function obtenerContexto() {
  if (!contexto) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    contexto = new AC();
  }
  return contexto;
}

const habilitar = () => obtenerContexto()?.resume();
window.addEventListener('pointerdown', habilitar);
window.addEventListener('keydown', habilitar);

function pitido(c, frecuencia, inicio, duracion) {
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = 'square';
  osc.frequency.value = frecuencia;
  vol.gain.setValueAtTime(0.0001, inicio);
  vol.gain.exponentialRampToValueAtTime(0.08, inicio + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  osc.connect(vol).connect(c.destination);
  osc.start(inicio);
  osc.stop(inicio + duracion + 0.02);
}

export function useSirena(activa) {
  const [bloqueada, setBloqueada] = useState(false);

  useEffect(() => {
    if (!activa) {
      setBloqueada(false);
      return;
    }
    const sonar = () => {
      const c = obtenerContexto();
      if (!c || c.state !== 'running') {
        setBloqueada(true);
        return;
      }
      setBloqueada(false);
      const t = c.currentTime;
      pitido(c, 880, t, 0.18);
      pitido(c, 660, t + 0.25, 0.18);
    };
    sonar();
    const id = setInterval(sonar, 1200);
    return () => clearInterval(id);
  }, [activa]);

  return { bloqueada };
}
