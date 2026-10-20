import Icon from '../components/Icon.jsx';
import { EstadoBadge, Tarjeta } from '../components/ui.jsx';

/**
 * Guía de uso para alguien que nunca vio el sistema.
 * Los resultados esperados se verificaron contra el backend con la
 * maqueta de 5 espacios (P1 carga, P2–P3 privados, P4–P5 libres) y con la
 * lógica del firmware final de la maqueta.
 */

/** Pide a la consola del panel que cargue un código (la consola escucha este evento). */
export function cargarEnConsola(codigo) {
  window.dispatchEvent(new CustomEvent('consola:cargar', { detail: codigo }));
}

const SECCIONES = [
  { id: 'g-que-es', titulo: '¿Qué es?' },
  { id: 'g-pantalla', titulo: 'La pantalla' },
  { id: 'g-estados', titulo: 'Estados' },
  { id: 'g-uso', titulo: 'Uso correcto' },
  { id: 'g-camara', titulo: 'Cámara' },
  { id: 'g-maqueta', titulo: 'Maqueta y talanquera' },
  { id: 'g-comandos', titulo: 'Comandos' },
  { id: 'g-casos', titulo: 'Casos de prueba' },
  { id: 'g-problemas', titulo: 'Problemas frecuentes' },
];

const ESPACIOS = [
  ['P1', 'package', 'Carga y descarga', 'Solo vehículos de carga.'],
  ['P2', 'bookmark', 'Privado', 'Solo la placa autorizada (por defecto P555XYZ).'],
  ['P3', 'bookmark', 'Privado', 'Solo la placa autorizada (por defecto P777QQQ).'],
  ['P4', 'car', 'Libre', 'Compactos y motos.'],
  ['P5', 'car', 'Libre', 'Compactos y motos.'],
];

const ESTADOS_GUIA = [
  ['LIBRE', 'Disponible. En los privados, solo para su placa autorizada.'],
  ['ASIGNADO', 'El sistema se lo dio a una placa, pero el vehículo todavía no se estacionó.'],
  ['OCUPADO', 'El vehículo se estacionó y se confirmó la llegada. La seguridad está activa: si se va sin permiso, suena la alarma.'],
  ['AUTORIZADO', 'Tiene permiso para salir. Cuando el vehículo deja el espacio, este se libera solo, sin alarma, y tiene 60 s para llegar a la talanquera.'],
  ['ALARMA', 'Algo pasó sin permiso: un vehículo se fue sin autorización o alguien se estacionó sin estar registrado. Suena la sirena en la computadora.'],
  ['FUERA_SERVICIO', 'Espacio deshabilitado. No se usa.'],
];

const USO = [
  {
    titulo: 'Verifica la conexión',
    texto:
      'Arriba a la derecha debe decir “En línea” en verde. Con la maqueta real, además debe decir “Maqueta en línea”; si dice “Sin señal de la maqueta”, el Arduino no está mandando datos (ver Problemas frecuentes).',
  },
  {
    titulo: 'Registra la entrada con la cámara',
    texto:
      'En el Panel de control enciende la cámara y muestra la placa. La foto se toma sola, la placa se lee sola y se abre “Registrar entrada”: elige el tipo de vehículo y el espacio (el recomendado ya viene marcado) y confirma. El espacio se pone amarillo y la talanquera se abre cuando el vehículo llega a ella.',
    codigo: 'REGISTRAR(compacto,P123ABC);\nASIGNAR(P123ABC);',
    alternativa: 'Sin cámara, con la consola:',
  },
  {
    titulo: 'El vehículo se estaciona: confirma la llegada',
    texto:
      'Cuando el sensor del espacio lo detecta (con la maqueta lo detecta solo; en el simulador presiona “Meter”), confirma la llegada: con una foto (la acción sugerida es “Llegada”) o haciendo clic en el espacio y presionando “Confirmar llegada”. El espacio se pone rojo y se activa la seguridad.',
    codigo: 'LLEGADA(P123ABC);',
    alternativa: 'Con la consola:',
  },
  {
    titulo: 'Autoriza la salida',
    texto:
      'Antes de que el vehículo se mueva: con una foto (acción “Salida”) o con “Autorizar salida” en el detalle del espacio. El espacio se pone azul.',
    codigo: 'AUTORIZAR_SALIDA(P123ABC);',
    alternativa: 'Con la consola:',
  },
  {
    titulo: 'El vehículo sale',
    texto:
      'Al dejar el espacio, este vuelve a verde solo, sin comandos ni alarma. El vehículo tiene 60 s para llegar a la talanquera, que se abre al detectarlo.',
  },
  {
    titulo: 'Si suena una alarma',
    texto:
      'Aparece una franja roja arriba con el espacio y la placa, y suena la sirena (el botón de la campana la silencia). Revisa qué pasó, haz clic en el espacio y presiona “Apagar alarma”.',
    codigo: 'APAGAR_ALARMA(P123ABC);',
    alternativa: 'Con la consola:',
  },
];

const COMANDOS = [
  ['REGISTRAR(tipo,PLACA);', 'Da de alta un vehículo. Tipos: compacto, grande, moto o carga.', 'La placa no puede estar ya dentro del parqueo.'],
  ['ASIGNAR(PLACA);', 'Elige automáticamente el mejor espacio libre para ese vehículo y da permiso de entrada en la talanquera.', 'La placa debe estar registrada y tiene que haber un espacio compatible libre.'],
  ['LLEGADA(PLACA);', 'Confirma que el vehículo se estacionó. Activa la seguridad.', 'El sensor del espacio debe estar detectando el vehículo.'],
  ['AUTORIZAR_SALIDA(PLACA);', 'Da permiso para salir. Al dejar el vehículo el espacio, este se libera solo; tiene 60 s para llegar a la talanquera.', 'El vehículo debe haber llegado (estado Ocupado).'],
  ['SALIDA(PLACA);', 'Respaldo manual para liberar un espacio. En el flujo normal no hace falta.', 'La salida debe estar autorizada y el sensor ya no debe detectar el vehículo.'],
  ['APAGAR_ALARMA(PLACA);', 'Apaga la alarma de esa placa. Si el vehículo se fue, el espacio queda libre; si volvió, sigue ocupado.', 'Debe existir una alarma activa asociada a esa placa.'],
  ['CONSULTAR();', 'Muestra una tabla con el estado de todos los espacios.', 'Siempre funciona.'],
];

/*
 * En simulador, “Meter” y “Sacar” ponen y quitan el vehículo del sensor.
 * Con la maqueta real, hacerlo con el carrito.
 */
const CASOS = [
  {
    id: 'CP-01',
    titulo: 'Comprobar que todo está conectado',
    objetivo: 'Saber que la pantalla, el servidor y (si la hay) la maqueta están funcionando.',
    pasos: [
      { texto: 'Mira la barra superior.', esperado: '“En línea” en verde y el modo: “Simulador” o “Arduino · WiFi”. Con la maqueta, también “Maqueta en línea”.' },
      { texto: 'Abre el Panel de control.', esperado: 'El mapa muestra P1 a P5. P2 y P3 indican su placa autorizada (por defecto “Solo P555XYZ” y “Solo P777QQQ”).' },
      { texto: 'Abre la consola (botón “Mostrar”, al final del panel) y ejecuta la consulta.', codigo: 'CONSULTAR();', esperado: 'Mensaje “5 de 5 espacios libres” y una tabla con los 5 espacios.' },
    ],
  },
  {
    id: 'CP-02',
    titulo: 'Recorrido completo con la cámara',
    objetivo: 'Llevar un vehículo de la entrada a la salida sin escribir comandos.',
    previo: 'Reinicia el parqueo. Ten un papel blanco con la placa P456HJX impresa en letra negrita.',
    pasos: [
      { texto: 'En el Panel de control presiona “Encender cámara” (con “Automático” encendido) y muestra el papel, quieto y con buena luz.', esperado: 'La foto se toma sola, la placa se lee sola y se abre “Registrar entrada”: P4 Recomendado, P5 Disponible, y P1, P2 y P3 deshabilitados con el motivo.' },
      { texto: 'Elige P5 y presiona “Registrar entrada en P5”.', esperado: '“Espacio P5 asignado a P456HJX”. P5 se pone amarillo y la captura queda en el Historial con el espacio P5.' },
      { texto: 'Presiona “Meter” en P5 y luego “Tomar foto” (la misma placa no se dispara sola de nuevo hasta salir de cuadro).', esperado: 'La acción sugerida es “Llegada” y se procesa sola: “Llegada confirmada en P5”. P5 se pone rojo.' },
      { texto: 'Presiona “Tomar foto” otra vez.', esperado: 'Acción “Salida”: “Salida autorizada para P456HJX”. P5 se pone azul.' },
      { texto: 'Presiona “Sacar” en P5.', esperado: 'P5 vuelve a verde solo, sin foto ni comandos, y no suena ninguna alarma.' },
      { texto: 'Abre “Actividad y eventos”.', esperado: 'Aparecen las capturas (“Captura #N: P456HJX (entrada / llegada / salida)”) junto con la asignación, la llegada, la autorización y “P456HJX salio. P5 disponible”.' },
    ],
  },
  {
    id: 'CP-03',
    titulo: 'Recorrido completo desde el mapa',
    objetivo: 'Usar los botones del detalle del espacio en lugar de la cámara.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Registra y asigna un compacto con la consola.', codigo: 'REGISTRAR(compacto,P222BBB);\nASIGNAR(P222BBB);', esperado: '“Espacio P4 asignado a P222BBB”. P4 se pone amarillo.' },
      { texto: 'Haz clic en P4: el detalle muestra “Confirmar llegada”. Presiónalo antes de meter el vehículo.', esperado: 'Error: “El sensor del espacio P4 no detecta ningun vehiculo…”. Es correcto: el vehículo todavía no está.' },
      { texto: 'Presiona “Meter” en P4 y luego “Confirmar llegada”.', esperado: '“Llegada confirmada en P4. Sistema de seguridad activado”. P4 se pone rojo.' },
      { texto: 'Presiona “Autorizar salida” en el detalle.', esperado: 'P4 se pone azul y el detalle indica que se liberará solo cuando el vehículo salga y que tiene 60 s para llegar a la talanquera.' },
      { texto: 'Presiona “Sacar” en P4.', esperado: 'P4 vuelve a Libre solo, sin alarma.' },
    ],
  },
  {
    id: 'CP-04',
    titulo: 'Alarma: el vehículo sale sin permiso',
    objetivo: 'Verificar la detección de movimiento no autorizado y cómo se apaga.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Registra y asigna un compacto, presiona “Meter” en P4 y confirma la llegada (desde el detalle o con la consola).', codigo: 'REGISTRAR(compacto,P456DEF);\nASIGNAR(P456DEF);', esperado: 'P4 en Ocupado tras confirmar la llegada.' },
      { texto: 'Sin autorizar, presiona “Sacar” en P4.', esperado: 'P4 pasa a Alarma: parpadea en rojo, aparece la franja “Movimiento no autorizado — P4 — P456DEF”, la campana muestra 1, llega una notificación y suena la sirena (si no se escucha, haz clic en la página).' },
      { texto: 'Presiona el botón de la campana en la franja roja.', esperado: 'La sirena se silencia; la franja y la alarma siguen.' },
      { texto: 'Haz clic en P4 y presiona “Apagar alarma”.', esperado: '“Alarma apagada. P4 quedo libre (salida sin autorizacion registrada)”. Desaparece la franja y P4 vuelve a Libre.' },
    ],
  },
  {
    id: 'CP-05',
    titulo: 'Falsa alarma: el vehículo vuelve a su lugar',
    objetivo: 'Comprobar que, si el vehículo regresa, al apagar la alarma sigue estacionado.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Registra y asigna un compacto, presiona “Meter” en P4 y confirma la llegada.', codigo: 'REGISTRAR(compacto,P777AAA);\nASIGNAR(P777AAA);', esperado: 'P4 en Ocupado.' },
      { texto: 'Presiona “Sacar” y luego “Meter” otra vez en P4.', esperado: 'P4 queda en Alarma aunque el vehículo volvió.' },
      { texto: 'Apaga la alarma (detalle de P4 o consola).', codigo: 'APAGAR_ALARMA(P777AAA);', esperado: '“Alarma apagada. P777AAA sigue en P4”. P4 vuelve a Ocupado.' },
    ],
  },
  {
    id: 'CP-06',
    titulo: 'Alarma: alguien se estaciona sin registrarse',
    objetivo: 'Detectar un vehículo desconocido en un espacio libre.',
    pasos: [
      { texto: 'Presiona “Meter” en un espacio Libre que nadie tenga asignado (por ejemplo P5).', esperado: 'P5 pasa a Alarma. La franja dice “P5 — vehículo no registrado”.' },
      { texto: 'Presiona “Sacar” en P5.', esperado: 'La alarma sigue activa hasta que el operador la apague. El detalle indica que es un vehículo no registrado.' },
      { texto: 'Haz clic en P5 y presiona “Apagar alarma”.', esperado: '“Alarma apagada. P5 quedo libre”. Desaparece la franja y P5 vuelve a Libre. En Actividad aparece “Alarma de P5 (vehiculo no registrado) desactivada por el operador”.' },
    ],
  },
  {
    id: 'CP-07',
    titulo: 'Parqueo lleno al registrar una entrada',
    objetivo: 'Comprobar la alarma cuando no hay lugar.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Ocupa los dos espacios libres.', codigo: 'REGISTRAR(compacto,P101AAA);\nASIGNAR(P101AAA);\nREGISTRAR(compacto,P102AAA);\nASIGNAR(P102AAA);', esperado: 'P4 y P5 quedan Asignados.' },
      { texto: 'Muestra a la cámara la placa P456HJX (o toma la foto).', esperado: 'Se abre “Registrar entrada” con todos los espacios deshabilitados y el aviso rojo “Parqueo lleno”.' },
      { texto: 'Presiona “Registrar parqueo lleno”.', esperado: 'Notificación de alarma “Parqueo lleno”. En Actividad aparece en rojo “PARQUEO LLENO: no hay espacio libre para P456HJX (compacto)” y la foto queda guardada como evidencia.' },
    ],
  },
  {
    id: 'CP-08',
    titulo: 'Espacio privado para una placa',
    objetivo: 'Autorizar una placa en un privado y que entre ahí.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Haz clic en P3. En el detalle, en “Placa autorizada”, escribe P321XYZ y presiona “Cambiar”.', esperado: 'Notificación “P3 reservado para P321XYZ”. En el mapa P3 muestra “Solo P321XYZ”.' },
      { texto: 'Registra y asigna esa placa como vehículo grande (no cabe en los libres, solo en su privado).', codigo: 'REGISTRAR(grande,P321XYZ);\nASIGNAR(P321XYZ);', esperado: '“Espacio P3 asignado a P321XYZ”. Con la cámara, P3 aparecería como Recomendado.' },
      { texto: 'Prueba un vehículo grande sin reserva.', codigo: 'REGISTRAR(grande,G333CCC);\nASIGNAR(G333CCC);', esperado: 'ASIGNAR da error: “No hay espacios libres compatibles con un vehiculo tipo \'grande\'”.' },
      { texto: 'En el detalle de P3 presiona “Quitar autorización”.', esperado: 'P3 queda “Sin reserva”. Los cambios aparecen en Actividad. Las reservas se conservan aunque reinicies el parqueo.' },
    ],
  },
  {
    id: 'CP-09',
    titulo: 'Cada tipo de vehículo va a su espacio',
    objetivo: 'Probar la asignación automática por tipo.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Un vehículo de carga.', codigo: 'REGISTRAR(carga,C111AAA);\nASIGNAR(C111AAA);', esperado: '“Espacio P1 asignado a C111AAA” (P1 es el de carga).' },
      { texto: 'Una moto.', codigo: 'REGISTRAR(moto,M100AAA);\nASIGNAR(M100AAA);', esperado: 'Se asigna a un espacio libre (P4 o P5).' },
      { texto: 'Un vehículo grande con reserva (P555XYZ tiene reservado P2).', codigo: 'REGISTRAR(grande,P555XYZ);\nASIGNAR(P555XYZ);', esperado: '“Espacio P2 asignado a P555XYZ”.' },
      { texto: 'Dos compactos más.', codigo: 'REGISTRAR(compacto,P101AAA);\nASIGNAR(P101AAA);\nREGISTRAR(compacto,P102AAA);\nASIGNAR(P102AAA);', esperado: 'El primero ocupa el libre que quedaba; el segundo da “No hay espacios libres compatibles…”: los privados solo se usan con reserva.' },
    ],
  },
  {
    id: 'CP-10',
    titulo: 'Lectura dudosa y captura manual',
    objetivo: 'Ver que una lectura insegura no se procesa sola y que siempre se puede decidir a mano.',
    pasos: [
      { texto: 'Muestra a la cámara una placa escrita a mano.', esperado: 'La foto se toma sola, pero la placa puede quedar parcial (por ejemplo ?45?HJX) y no se procesa: espera al operador.' },
      { texto: 'Escribe ABC123 en Placa.', esperado: 'El campo se pone rojo, dice que el formato debe ser P123ABC y el botón queda deshabilitado.' },
      { texto: 'Corrige a P456HJX.', esperado: 'Debajo de “Acción al guardar” se explica qué va a pasar y el botón cambia según la acción sugerida (por ejemplo “Registrar entrada…”).' },
      { texto: 'Cambia la acción a “Solo guardar la foto” y presiona “Guardar foto”.', esperado: 'Notificación “Captura guardada”. En el Historial aparece con lo que leyó la máquina y lo que corregiste.' },
      { texto: 'Apaga “Automático” y usa “Tomar foto”.', esperado: 'Ya no dispara sola; la lectura sigue corriendo después de cada foto.' },
    ],
  },
  {
    id: 'CP-11',
    titulo: 'Recorrido completo solo con comandos',
    objetivo: 'Mostrar el lenguaje formal del proyecto controlando todo el ciclo.',
    previo: 'Reinicia el parqueo y abre la consola.',
    pasos: [
      { texto: 'Registra y asigna.', codigo: 'REGISTRAR(compacto,P123ABC);\nASIGNAR(P123ABC);', esperado: '“Espacio P4 asignado a P123ABC”.' },
      { texto: 'Confirma la llegada antes de que el vehículo esté.', codigo: 'LLEGADA(P123ABC);', esperado: 'Error semántico: “El sensor del espacio P4 no detecta ningun vehiculo…”.' },
      { texto: 'Presiona “Meter” en P4 y vuelve a confirmar.', codigo: 'LLEGADA(P123ABC);', esperado: '“Llegada confirmada en P4. Sistema de seguridad activado”.' },
      { texto: 'Autoriza la salida.', codigo: 'AUTORIZAR_SALIDA(P123ABC);', esperado: '“Salida autorizada para P123ABC. Ya puede retirar el vehiculo de P4”.' },
      { texto: 'Presiona “Sacar” en P4 y consulta.', codigo: 'CONSULTAR();', esperado: '“5 de 5 espacios libres”: el espacio se liberó solo al salir.' },
    ],
  },
  {
    id: 'CP-12',
    titulo: 'Errores léxicos (palabras que el lenguaje no conoce)',
    objetivo: 'Ver que el sistema rechaza símbolos inválidos y no ejecuta nada del bloque.',
    pasos: [
      { texto: 'Placa con formato incorrecto (le falta un número).', codigo: 'REGISTRAR(compacto,P12ABC);\nCONSULTAR();', esperado: 'Error léxico en la línea 1, columna 20: “\'P12ABC\' no es un simbolo valido…”. La línea queda marcada y CONSULTAR tampoco se ejecuta (0 ejecutadas).' },
      { texto: 'Tipo de vehículo que no existe.', codigo: 'REGISTRAR(camion,P321CBA);', esperado: 'Error léxico: “\'camion\' no es un simbolo valido del lenguaje…”.' },
    ],
  },
  {
    id: 'CP-13',
    titulo: 'Errores sintácticos (orden de los símbolos)',
    objetivo: 'Ver que el sistema detecta instrucciones mal armadas.',
    pasos: [
      { texto: 'Falta el punto y coma.', codigo: 'CONSULTAR()\nCONSULTAR();', esperado: 'Error sintáctico en la línea 2: “Falta \';\' al final de la instruccion…”.' },
      { texto: 'Falta la coma entre el tipo y la placa.', codigo: 'REGISTRAR(compacto P321CBA);', esperado: 'Error sintáctico: “Se esperaba \',\' entre el tipo y la placa…”.' },
      { texto: 'Haz clic en una fila de la tabla de errores.', esperado: 'El cursor salta a la línea y columna exactas del error en el editor.' },
    ],
  },
  {
    id: 'CP-14',
    titulo: 'Errores semánticos (instrucciones fuera de orden)',
    objetivo: 'Ver que el sistema impide acciones que no tienen sentido.',
    previo: 'Reinicia el parqueo.',
    pasos: [
      { texto: 'Asignar una placa que nunca se registró.', codigo: 'ASIGNAR(Z999ZZZ);', esperado: '“La placa Z999ZZZ no esta registrada. Ejecute REGISTRAR(tipo,Z999ZZZ) primero.”' },
      { texto: 'Registrar dos veces una placa que ya está adentro.', codigo: 'REGISTRAR(carga,C111AAA);\nASIGNAR(C111AAA);\nREGISTRAR(carga,C111AAA);', esperado: 'Las dos primeras funcionan; la tercera da “La placa C111AAA ya esta activa en el parqueo (espacio P1)…”.' },
      { texto: 'Liberar sin autorizar.', codigo: 'SALIDA(C111AAA);', esperado: '“No se puede liberar el espacio de C111AAA: la salida no ha sido autorizada…”.' },
      { texto: 'Apagar una alarma que no existe.', codigo: 'APAGAR_ALARMA(C111AAA);', esperado: '“No hay ninguna alarma activa asociada a la placa C111AAA.”' },
      { texto: 'Detalles del lenguaje: minúsculas y comentarios.', codigo: '# Esto es un comentario y se ignora\nconsultar();', esperado: 'Se ejecuta sin errores y muestra la tabla.' },
    ],
  },
  {
    id: 'CP-15',
    titulo: 'Talanquera con la maqueta real',
    objetivo: 'Comprobar que la barrera obedece al sistema.',
    previo: 'Solo con la maqueta conectada (“Arduino · WiFi” y “Maqueta en línea”).',
    pasos: [
      { texto: 'Pon un carrito frente a la talanquera sin haberlo registrado.', esperado: 'La barrera no se abre: no hay permiso.' },
      { texto: 'Registra su entrada (cámara o consola) con el carrito frente a la barrera.', esperado: 'La barrera se abre: semáforo verde, flecha en la matriz LED y dos pitidos. A los 2.5 s el semáforo pasa a amarillo.' },
      { texto: 'Pasa el carrito.', esperado: 'Unos 5 s después de abrir, con la barrera libre, se cierra: semáforo rojo y X en la matriz.' },
      { texto: 'Estaciónalo, confirma la llegada y autoriza la salida. Retira el carrito del espacio y llévalo a la barrera antes de 60 s.', esperado: 'El espacio se libera solo al retirarlo y la barrera se abre al llegar el carrito.' },
    ],
  },
];

const PROBLEMAS = [
  ['Arriba dice “Reconectando…”', 'El servidor (backend) no está corriendo o se cayó. Ábrelo con “npm run dev” en la carpeta backend. La pantalla se reconecta sola en cuanto vuelve.'],
  ['Dice “Sin señal de la maqueta”', 'El backend no recibe datos del Arduino. Revisa: laptop y Arduino en la misma red WiFi (un hotspot del celular funciona; la red de la universidad suele bloquearlo), en el firmware hostAPI con la IP de la laptop (no localhost) y puertoAPI = 8080, y que el firewall permita a Node.js. En el Monitor Serial del Arduino, “servidor inalcanzable” indica alguno de estos problemas.'],
  ['Dice “Simulador” aunque conecté la maqueta', 'El backend arrancó en modo simulador. En backend/.env pon MODO_HARDWARE=http y reinícialo: en la terminal debe decir “modo hardware: http”.'],
  ['La talanquera no se abre', 'Se abre solo si hay permiso (una entrada registrada o una salida autorizada, válido 60 s) y el carrito está a menos de 11 cm del sensor ultrasónico. Si pasaron los 60 s, vuelve a autorizar.'],
  ['“Confirmar llegada” dice que el sensor no detecta ningún vehículo', 'El vehículo todavía no está en el espacio. En el simulador presiona “Meter”; con la maqueta, coloca el carrito sobre su sensor.'],
  ['No encuentro cómo autorizar la salida', 'Haz clic en el espacio en el mapa: si el vehículo está estacionado (Ocupado), el detalle muestra “Autorizar salida”. También con una foto (acción “Salida”) o con AUTORIZAR_SALIDA en la consola. La maqueta no tiene botón físico.'],
  ['Un carro se estacionó y se fue, pero la alarma quedó activa', 'Se estacionó en un espacio libre sin estar registrado (o en otro espacio que no era el suyo): es la alarma de “vehículo no registrado”, y sigue activa aunque el carro se vaya, para que el operador se entere. Haz clic en el espacio y presiona “Apagar alarma”: queda libre. Para evitarla, registra la entrada antes y estaciona el carro en el espacio asignado.'],
  ['Suena una alarma en la computadora', 'Es la alarma sonora: suena mientras haya un movimiento no autorizado. El botón de la campana en la franja roja la silencia; una alarma nueva la vuelve a activar. Si no se escucha, haz clic en cualquier parte de la página (el navegador no deja sonar audio antes).'],
  ['No hay espacios compatibles al registrar una entrada', 'No queda un espacio libre para ese tipo. Los privados (P2 y P3) solo admiten su placa autorizada, y los vehículos grandes no caben en los espacios libres. Si no hay lugar, la entrada registra la alarma de parqueo lleno.'],
  ['¿Cómo meto un carro en un espacio privado?', 'Haz clic en el privado (P2 o P3) y, en “Placa autorizada”, escribe la placa y presiona “Autorizar” o “Cambiar”. Desde ese momento solo esa placa puede entrar ahí, y al registrar su entrada con la cámara ese espacio aparece como recomendado. Cada privado admite una placa y cada placa un solo privado.'],
  ['La cámara no lee la placa', 'El recuadro es solo una guía: el OCR busca la placa en toda la imagen, incluso si el papel es blanco sobre un fondo claro o está inclinado. Ayuda que la placa esté impresa en letra negrita, con buena luz, sin reflejos y quieta. Si no dispara sola, usa “Tomar foto”.'],
  ['El OCR no lee la placa completa', 'Con placas escritas a mano suele reconocer solo algunos caracteres y marca los demás con “?” para que los completes. Una lectura dudosa nunca se procesa sola. Para lecturas completas, imprime la placa en letra negrita.'],
  ['La cámara no enciende', 'El navegador bloqueó el permiso: haz clic en el candado junto a la dirección y permite la cámara. Si hay varias cámaras, elige la de la maqueta en el selector.'],
  ['No encuentro la consola de comandos', 'Está al final del Panel de control, plegada. Presiona “Mostrar”. Los botones “Cargar en la consola” de esta guía la abren solos.'],
  ['No aparecen los botones “Meter” y “Sacar”', 'Solo existen en modo simulador. Con la maqueta real, los sensores son físicos.'],
  ['¿Qué borra “Reiniciar”?', 'Los vehículos, las ocupaciones, las alarmas y la bitácora: todos los espacios quedan libres. Conserva las capturas (fotos) y las placas autorizadas de los privados.'],
];

export default function Guia({ onIr }) {
  const irA = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const cargar = (codigo) => {
    onIr('panel');
    cargarEnConsola(codigo);
  };

  return (
    <div className="guia">
      <Tarjeta className="guia-hero">
        <span className="guia-hero-icono"><Icon name="book" size={24} /></span>
        <div>
          <h2>Guía de uso</h2>
          <p>
            Todo lo necesario para operar y probar el sistema sin conocimientos previos. El trabajo diario se hace con la
            <strong> cámara</strong> y el <strong>mapa</strong>; los botones <strong>“Cargar en la consola”</strong> llevan
            los ejemplos de comandos al Panel de control: solo tienes que presionar <strong>Ejecutar</strong>.
          </p>
        </div>
      </Tarjeta>

      <nav className="guia-indice" aria-label="Índice de la guía">
        {SECCIONES.map((s, i) => (
          <button key={s.id} className="chip-filtro" onClick={() => irA(s.id)}>
            <span>{i + 1}</span>
            {s.titulo}
          </button>
        ))}
      </nav>

      <Tarjeta titulo="1. ¿Qué es este sistema?" icono="info" className="guia-seccion" id="g-que-es">
        <p className="guia-texto">
          Controla un parqueo de <strong>5 espacios</strong>, cada uno con un <strong>sensor</strong> que detecta si hay un
          vehículo, y una <strong>talanquera</strong> (barrera) en la entrada que solo se abre con permiso del sistema.
        </p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Espacio</th><th>Tipo</th><th>Quién puede usarlo</th></tr></thead>
            <tbody>
              {ESPACIOS.map(([cod, icono, tipo, quien]) => (
                <tr key={cod}>
                  <td className="mono">{cod}</td>
                  <td><Icon name={icono} size={14} /> {tipo}</td>
                  <td>{quien}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="guia-texto" style={{ marginTop: 14 }}>
          Cada vehículo pasa por cuatro pasos: <strong>entrada</strong> (se registra su placa y se le asigna un espacio),
          <strong> llegada</strong> (se estaciona y se activa la seguridad), <strong>autorización</strong> (el operador le da
          permiso para salir) y <strong>salida</strong> (deja el espacio, que se libera solo). Si un vehículo se mueve sin
          permiso, <strong>suena una alarma</strong>. Todo se ve en pantalla en tiempo real.
        </p>
        <div className="guia-grid3">
          <div className="guia-mini"><Icon name="camera" /><strong>Cámara</strong><span>Lee la placa y lleva el proceso de cada vehículo.</span></div>
          <div className="guia-mini"><Icon name="radio" /><strong>Sensores</strong><span>Detectan cada vehículo y la llegada a la talanquera.</span></div>
          <div className="guia-mini"><Icon name="alert" /><strong>Alarmas</strong><span>Visual y sonora cuando algo ocurre sin autorización.</span></div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="2. Recorrido por la pantalla" icono="dashboard" className="guia-seccion" id="g-pantalla">
        <dl className="guia-defs">
          <div><dt><Icon name="dashboard" size={16} /> Dashboard</dt><dd>Resumen: espacios libres, ocupados, asignados y en alarma, ocupación, estado del sistema y la actividad reciente.</dd></div>
          <div><dt><Icon name="map" size={16} /> Panel de control</dt><dd>Donde se trabaja. Arriba el <strong>mapa</strong> y el <strong>detalle del espacio</strong> (haz clic en un espacio: muestra su estado y las acciones “Confirmar llegada”, “Autorizar salida”, “Apagar alarma” y, en los privados, la placa autorizada). En el medio la <strong>cámara</strong>. Al final la <strong>consola de comandos</strong>, plegada (se abre con “Mostrar”).</dd></div>
          <div><dt><Icon name="images" size={16} /> Historial de capturas</dt><dd>Las fotos guardadas, con buscador por placa, filtros y la precisión de la lectura automática.</dd></div>
          <div><dt><Icon name="activity" size={16} /> Actividad y eventos</dt><dd>Todo lo que pasó, en orden, con filtros por tipo: entradas, llegadas, salidas, capturas, alarmas y cambios de reservas.</dd></div>
          <div><dt><Icon name="bell" size={16} /> Barra superior</dt><dd>Conexión con el servidor (“En línea”), modo (“Simulador” o “Arduino · WiFi”), señal de la maqueta (“Maqueta en línea”), hora, campana de alarmas, tema claro u oscuro y “Reiniciar”.</dd></div>
          <div><dt><Icon name="alert" size={16} /> Franja roja</dt><dd>Aparece arriba mientras haya una alarma: indica el espacio y la placa. El botón de la campana silencia la sirena.</dd></div>
        </dl>
        <div className="aviso aviso-info">
          <Icon name="cpu" size={16} />
          <span>
            En <strong>modo simulador</strong> no hace falta la maqueta: cada espacio tiene los botones <strong>Meter</strong> y
            <strong> Sacar</strong>, que simulan poner o quitar un vehículo de su sensor. Con la maqueta real esos botones
            desaparecen y se usa el carrito.
          </span>
        </div>
      </Tarjeta>

      <Tarjeta titulo="3. Estados de un espacio" icono="list" className="guia-seccion" id="g-estados">
        <ul className="guia-estados">
          {ESTADOS_GUIA.map(([estado, texto]) => (
            <li key={estado}>
              <EstadoBadge estado={estado} />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
        <div className="guia-ciclo" aria-label="Ciclo normal de un espacio">
          <EstadoBadge estado="LIBRE" /><span>entrada →</span>
          <EstadoBadge estado="ASIGNADO" /><span>llegada →</span>
          <EstadoBadge estado="OCUPADO" /><span>autorizar salida →</span>
          <EstadoBadge estado="AUTORIZADO" /><span>el vehículo sale →</span>
          <EstadoBadge estado="LIBRE" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="4. Uso correcto, paso a paso" icono="checkCircle" className="guia-seccion" id="g-uso">
        <ol className="guia-pasos">
          {USO.map((p) => (
            <li key={p.titulo}>
              <div>
                <strong>{p.titulo}</strong>
                <p>{p.texto}</p>
                {p.codigo && (
                  <>
                    <p className="guia-alternativa">{p.alternativa}</p>
                    <Codigo codigo={p.codigo} onCargar={cargar} />
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="aviso aviso-neutro">
          <Icon name="alert" size={16} />
          <span>
            <strong>Reiniciar</strong> borra vehículos, ocupaciones, alarmas y la bitácora (conserva las fotos y las placas
            autorizadas). Úsalo solo para pruebas, nunca durante la operación real.
          </span>
        </div>
      </Tarjeta>

      <Tarjeta titulo="5. Cámara y reconocimiento de placas" icono="camera" className="guia-seccion" id="g-camara">
        <ol className="guia-pasos">
          <li><div><strong>Enciende la cámara</strong><p>En el Panel de control presiona “Encender cámara” y acepta el permiso del navegador. Si hay varias cámaras, elige la de la maqueta en el selector. La vista muestra el cuadro completo que se analiza.</p></div></li>
          <li><div><strong>Muestra la placa</strong><p>Con “Automático” encendido, pon el papel con la placa frente a la cámara, quieto. Cuando la lee igual en dos cuadros seguidos, toma la foto sola y la lee (la primera vez tarda unos segundos más porque carga el lector). Debajo verás el recorte que analizó. Una placa ya capturada no vuelve a dispararse hasta que sale de cuadro.</p></div></li>
          <li><div><strong>La acción se sugiere sola</strong><p>Según dónde está el vehículo: <strong>Entrada</strong> si no está en el parqueo (pregunta tipo y espacio; si no hay lugar, registra la alarma de parqueo lleno), <strong>Llegada</strong> si tiene espacio asignado, <strong>Salida</strong> si está estacionado (autoriza el movimiento) y <strong>Evidencia de alarma</strong> si su espacio está en alarma. Debajo de “Acción al guardar” se explica qué va a pasar; puedes cambiarla.</p></div></li>
          <li><div><strong>Lectura segura = sin preguntas</strong><p>Si la placa salió completa y con confianza de 70% o más, se guarda y se procesa sola (la entrada igual pregunta el espacio). Si no, la placa queda en el campo para que la revises: los caracteres que no pudo leer aparecen como “?”. Si la corriges, se guarda lo que leyó la máquina y lo que escribiste, para medir la precisión.</p></div></li>
          <li><div><strong>Casos especiales</strong><p>“Tomar foto” toma la foto a mano (la lectura corre sola igual), “Volver a leer” repite el OCR y el interruptor “Automático” apaga la detección automática.</p></div></li>
        </ol>
        <p className="nota"><Icon name="info" size={14} /> Funciona mejor con la placa impresa en letra negrita sobre papel blanco. Cada foto queda en el Historial y en Actividad. La cámara se apaga sola al salir del Panel de control; la foto sin guardar se conserva.</p>
      </Tarjeta>

      <Tarjeta titulo="6. La maqueta y la talanquera" icono="radio" className="guia-seccion" id="g-maqueta">
        <ul className="guia-lista">
          <li>El Arduino manda el estado de los 5 sensores y del sensor de la talanquera cada 2 segundos. La barra superior muestra <strong>“Maqueta en línea”</strong> mientras llegan datos.</li>
          <li>La talanquera se abre solo si hay <strong>permiso</strong> (una entrada registrada o una salida autorizada) y hay un vehículo a menos de 11 cm del sensor ultrasónico. El permiso dura <strong>60 segundos</strong>.</li>
          <li>Al abrir: semáforo verde, flecha en la matriz LED y dos pitidos; a los 2.5 s pasa a amarillo; a los 5 s se cierra si ya no hay un vehículo debajo (semáforo rojo y X). Al cruzar, el permiso se consume.</li>
          <li>La maqueta no tiene botones: la llegada, la autorización de salida y apagar la alarma se hacen desde la aplicación.</li>
          <li>La alarma sonora suena en la computadora (el buzzer de la maqueta solo da los pitidos de la talanquera).</li>
        </ul>
        <p className="nota"><Icon name="info" size={14} /> La puesta en marcha con la maqueta (red, IP, puerto 8080 y modo http) está paso a paso en CONTRATO_ARDUINO.md.</p>
      </Tarjeta>

      <Tarjeta titulo="7. Los comandos (consola)" icono="terminal" className="guia-seccion" id="g-comandos">
        <p className="guia-texto">
          La consola es el <strong>lenguaje formal</strong> del proyecto: permite hacer todo a mano. Está al final del Panel de
          control, plegada. Cada instrucción termina en <code>;</code> y va en su propia línea. Las placas siempre tienen el
          formato <code>P123ABC</code>: una letra, tres números y tres letras. Puedes escribir en mayúsculas o minúsculas, y las
          líneas que empiezan con <code>#</code> son comentarios. Para ejecutar, presiona <strong>Ejecutar</strong> o
          <kbd className="atajo">Ctrl / ⌘ + Enter</kbd>.
        </p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Comando</th><th>Qué hace</th><th>Requisito</th></tr></thead>
            <tbody>
              {COMANDOS.map(([cmd, que, req]) => (
                <tr key={cmd}>
                  <td><code className="guia-cmd">{cmd}</code></td>
                  <td>{que}</td>
                  <td className="txt-tenue">{req}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota">
          <Icon name="info" size={14} />
          Si hay un error léxico (una palabra que el lenguaje no conoce), no se ejecuta nada del bloque. Si una instrucción
          tiene un error de orden (semántico), solo esa se salta y las demás sí se ejecutan. ASIGNAR elige el espacio solo;
          para elegirlo tú, registra la entrada con la cámara.
        </p>
      </Tarjeta>

      <Tarjeta titulo="8. Casos de prueba" icono="play" className="guia-seccion" id="g-casos">
        <p className="guia-texto">
          Antes de cada caso conviene presionar <strong>Reiniciar</strong> (arriba a la derecha) para empezar con todo libre.
          Los pasos usan el simulador: con la maqueta real, donde dice “Meter” o “Sacar”, pon o quita el carrito de su sensor.
          Los resultados esperados son los mensajes reales del sistema.
        </p>
        <div className="casos">
          {CASOS.map((c) => (
            <details key={c.id} className="caso">
              <summary>
                <span className="caso-id">{c.id}</span>
                <span className="caso-titulo">{c.titulo}</span>
                <span className="caso-n">{c.pasos.length} {c.pasos.length === 1 ? 'paso' : 'pasos'}</span>
              </summary>
              <div className="caso-cuerpo">
                <p className="caso-objetivo"><strong>Objetivo:</strong> {c.objetivo}</p>
                {c.previo && <p className="caso-objetivo"><strong>Antes:</strong> {c.previo}</p>}
                <ol className="caso-pasos">
                  {c.pasos.map((p, i) => (
                    <li key={i}>
                      <p>{p.texto}</p>
                      {p.codigo && <Codigo codigo={p.codigo} onCargar={cargar} />}
                      <p className="caso-esperado"><Icon name="checkCircle" size={14} /> <span><strong>Resultado esperado:</strong> {p.esperado}</span></p>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="9. Problemas frecuentes" icono="alertCircle" className="guia-seccion" id="g-problemas">
        <div className="casos">
          {PROBLEMAS.map(([p, r]) => (
            <details key={p} className="caso">
              <summary><span className="caso-titulo">{p}</span></summary>
              <div className="caso-cuerpo"><p className="guia-texto">{r}</p></div>
            </details>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

function Codigo({ codigo, onCargar }) {
  return (
    <div className="guia-codigo">
      <pre><code>{codigo}</code></pre>
      <button className="btn btn-ghost btn-sm" onClick={() => onCargar(codigo)}>
        <Icon name="terminal" size={15} />
        Cargar en la consola
      </button>
    </div>
  );
}
