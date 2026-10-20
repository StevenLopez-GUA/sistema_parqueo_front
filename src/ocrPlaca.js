/**
 * Lectura de placas escritas sobre un papel blanco.
 *
 * Tesseract solo lee bien texto oscuro sobre fondo blanco, recortado y sin
 * nada alrededor. La foto de la maqueta trae fondo oscuro, la base del
 * carrito y el clip, así que antes de leer:
 *   1. se busca el papel (la mancha clara más grande) y se recorta,
 *   2. se separa la tinta del papel y se deja en blanco y negro,
 *   3. se lee con Tesseract configurado para una sola línea,
 *   4. se corrigen confusiones típicas usando el formato P123ABC.
 */

const PLACA = /^[A-Z][0-9]{3}[A-Z]{3}$/;
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Confusiones típicas, según lo que debería ir en cada posición.
const A_NUMERO = { O: '0', D: '0', Q: '0', U: '0', I: '1', L: '1', J: '1', T: '7', Z: '2', S: '5', G: '6', B: '8', A: '4', Y: '4' };
const A_LETRA = { 0: 'O', 1: 'I', 2: 'Z', 4: 'A', 5: 'S', 6: 'G', 7: 'T', 8: 'B' };

/** Umbral de Otsu sobre un histograma de 256 niveles. */
function otsu(hist, total) {
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, pesoB = 0, mejor = 0, umbral = 127;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += t * hist[t];
    const mB = sumaB / pesoB;
    const mF = (suma - sumaB) / pesoF;
    const varianza = pesoB * pesoF * (mB - mF) ** 2;
    if (varianza > mejor) { mejor = varianza; umbral = t; }
  }
  return umbral;
}

/**
 * Deja solo las manchas con forma de carácter: borra las que tocan el
 * borde (sombras, el clip), las muy bajas y anchas (líneas) y el ruido.
 */
function limpiarManchas(tinta, W, H) {
  const etiqueta = new Int32Array(W * H);
  const cola = new Int32Array(W * H);
  const manchas = [];
  let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!tinta[s] || etiqueta[s]) continue;
    id++;
    let ini = 0, fin = 0;
    cola[fin++] = s;
    etiqueta[s] = id;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (ini < fin) {
      const p = cola[ini++];
      const x = p % W, y = (p - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      // Vecindad de 8: los trazos a mano se tocan en diagonal.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (tinta[q] && !etiqueta[q]) { etiqueta[q] = id; cola[fin++] = q; }
        }
      }
    }
    manchas[id] = { area: fin, x0, x1, y0, y1, alto: y1 - y0 + 1, ancho: x1 - x0 + 1 };
  }

  // Altura de referencia: la de las manchas grandes (los caracteres).
  const altos = manchas.filter(Boolean).filter((m) => m.area > W * H * 0.002).map((m) => m.alto).sort((a, b) => a - b);
  const altoRef = altos.length ? altos[Math.floor(altos.length / 2)] : H * 0.5;

  const borrar = new Uint8Array(id + 1);
  manchas.forEach((m, k) => {
    if (!m) return;
    const tocaBorde = m.y0 === 0 || m.y1 === H - 1 || m.x0 === 0 || m.x1 === W - 1;
    const bajita = m.alto < altoRef * 0.45;
    const linea = m.ancho > m.alto * 4;
    const ruido = m.area < altoRef * 2;
    if ((tocaBorde && (bajita || linea)) || bajita || linea || ruido) borrar[k] = 1;
  });
  for (let i = 0; i < W * H; i++) if (tinta[i] && borrar[etiqueta[i]]) tinta[i] = 0;
  return manchas.filter((m, k) => m && !borrar[k]);
}

const mediana = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

/**
 * Convierte las manchas en 7 cajas, una por carácter, de izquierda a
 * derecha. Une partes del mismo carácter y divide los que se tocan
 * (a mano es común que el 5 y el 6 queden pegados).
 */
function segmentar(manchas) {
  const unidas = [];
  for (const m of [...manchas].sort((a, b) => a.x0 - b.x0)) {
    const u = unidas[unidas.length - 1];
    const solape = u ? Math.min(u.x1, m.x1) - Math.max(u.x0, m.x0) : -1;
    if (u && solape > 0.5 * Math.min(u.ancho, m.ancho)) {
      u.x0 = Math.min(u.x0, m.x0); u.x1 = Math.max(u.x1, m.x1);
      u.y0 = Math.min(u.y0, m.y0); u.y1 = Math.max(u.y1, m.y1);
      u.ancho = u.x1 - u.x0 + 1; u.alto = u.y1 - u.y0 + 1;
    } else {
      unidas.push({ ...m });
    }
  }

  if (!unidas.length || unidas.length > 7) return unidas;

  // Ancho típico de un carácter: la tinta total repartida en 7.
  // Cada mancha se divide en tantas partes como caracteres le quepan,
  // ajustando para que en total sean exactamente 7.
  const w = unidas.reduce((t, u) => t + u.ancho, 0) / 7;
  const partes = unidas.map((u) => Math.max(1, Math.round(u.ancho / w)));
  const total = () => partes.reduce((a, b) => a + b, 0);
  while (total() < 7) {
    let k = 0;
    partes.forEach((n, i) => { if (unidas[i].ancho / n > unidas[k].ancho / partes[k]) k = i; });
    partes[k]++;
  }
  while (total() > 7) {
    let k = -1;
    partes.forEach((n, i) => { if (n > 1 && (k < 0 || unidas[i].ancho / n < unidas[k].ancho / partes[k])) k = i; });
    partes[k]--;
  }

  return unidas.flatMap((u, i) => {
    const paso = u.ancho / partes[i];
    return Array.from({ length: partes[i] }, (_, j) => {
      const x0 = Math.round(u.x0 + j * paso);
      const x1 = Math.round(u.x0 + (j + 1) * paso) - 1;
      return { ...u, x0, x1, ancho: x1 - x0 + 1 };
    });
  });
}

/** Lienzo de un solo carácter, centrado, con borde blanco. */
function lienzoCaracter(tinta, W, caja, adelgazar = 0, alto = 64) {
  const escala = alto / caja.alto;
  const ancho = Math.max(1, Math.round(caja.ancho * escala));
  const pequeño = document.createElement('canvas');
  pequeño.width = caja.ancho;
  pequeño.height = caja.alto;
  const pctx = pequeño.getContext('2d');
  const img = pctx.createImageData(caja.ancho, caja.alto);
  // Adelgazar = erosionar el trazo: el marcador grueso rellena los huecos
  // (la panza de la P, el ojo del 6) y Tesseract deja de reconocerlos.
  const negro = (x, y) => {
    for (let dy = -adelgazar; dy <= adelgazar; dy++) {
      for (let dx = -adelgazar; dx <= adelgazar; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= caja.ancho || yy >= caja.alto) return false;
        if (!tinta[(yy + caja.y0) * W + (xx + caja.x0)]) return false;
      }
    }
    return true;
  };
  for (let y = 0; y < caja.alto; y++) {
    for (let x = 0; x < caja.ancho; x++) {
      const c = negro(x, y) ? 0 : 255;
      const i = (y * caja.ancho + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  pctx.putImageData(img, 0, 0);
  const borde = 20;
  const c = document.createElement('canvas');
  c.width = ancho + borde * 2;
  c.height = alto + borde * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pequeño, borde, borde, ancho, alto);
  return c;
}

/**
 * Plan B cuando el papel no se distingue del fondo (papel blanco sobre
 * una superficie clara): busca directamente una fila de caracteres.
 * Tinta = píxeles más oscuros que su entorno; caracteres = manchas de
 * tinta con tamaño de letra; fila = manchas de altura parecida, una al
 * lado de la otra (tolera la placa inclinada). Devuelve la caja de la
 * fila más larga, con margen, o null.
 */
function buscarTexto(px, W, H) {
  // Media local con imagen integral: tolera sombras y luz despareja.
  const gris = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) gris[i] = px[i * 4] * 0.7 + px[i * 4 + 1] * 0.3;
  const integral = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let fila = 0;
    for (let x = 0; x < W; x++) {
      fila += gris[y * W + x];
      integral[(y + 1) * (W + 1) + x + 1] = integral[y * (W + 1) + x + 1] + fila;
    }
  }
  const r = Math.max(12, Math.round(Math.min(W, H) / 16));
  const tinta = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(W, x + r + 1);
      const suma = integral[yb * (W + 1) + xb] - integral[ya * (W + 1) + xb] - integral[yb * (W + 1) + xa] + integral[ya * (W + 1) + xa];
      const media = suma / ((yb - ya) * (xb - xa));
      tinta[y * W + x] = gris[y * W + x] < media * 0.78 ? 1 : 0;
    }
  }

  // Manchas de tinta con forma de carácter.
  const etiqueta = new Int32Array(W * H);
  const cola = new Int32Array(W * H);
  const letras = [];
  let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!tinta[s] || etiqueta[s]) continue;
    id++;
    let ini = 0, fin = 0;
    cola[fin++] = s;
    etiqueta[s] = id;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (ini < fin) {
      const p = cola[ini++];
      const x = p % W, y = (p - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (tinta[q] && !etiqueta[q]) { etiqueta[q] = id; cola[fin++] = q; }
        }
      }
    }
    const alto = y1 - y0 + 1, ancho = x1 - x0 + 1;
    const tocaBorde = x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1;
    if (!tocaBorde && alto >= H * 0.04 && alto <= H * 0.5 && ancho <= alto * 1.6 && fin >= ancho * alto * 0.12) {
      letras.push({ x0, x1, y0, y1, alto, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }

  // Cadenas de izquierda a derecha: vecinas cercanas, en la misma línea y
  // de altura parecida a la típica de la cadena (no a la de la última
  // mancha: una letra partida en pedazos no debe cortar la fila).
  letras.sort((a, b) => a.x0 - b.x0);
  let mejor = [];
  for (let i = 0; i < letras.length; i++) {
    const cadena = [letras[i]];
    for (let j = i + 1; j < letras.length; j++) {
      const u = cadena[cadena.length - 1], l = letras[j];
      const ref = mediana(cadena.map((c) => c.alto));
      const hueco = l.x0 - u.x1;
      if (hueco > ref * 1.2) break;
      if (hueco >= -ref * 0.3 && Math.abs(l.alto - ref) <= ref * 0.35 && Math.abs(l.cy - u.cy) <= ref * 0.5) {
        cadena.push(l);
      }
    }
    if (cadena.length > mejor.length) mejor = cadena;
  }
  if (mejor.length < 4) return null;

  const alto = mediana(mejor.map((l) => l.alto));
  return {
    x0: Math.max(0, Math.min(...mejor.map((l) => l.x0)) - Math.round(alto * 0.4)),
    x1: Math.min(W - 1, Math.max(...mejor.map((l) => l.x1)) + Math.round(alto * 0.4)),
    y0: Math.max(0, Math.min(...mejor.map((l) => l.y0)) - Math.round(alto * 0.3)),
    y1: Math.min(H - 1, Math.max(...mejor.map((l) => l.y1)) + Math.round(alto * 0.3)),
  };
}

function cargarImagen(src) {
  return new Promise((ok, falla) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falla(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

/**
 * Devuelve la placa en blanco y negro (lienzo), la tinta binaria y las
 * cajas de cada carácter.
 * Si no hay ningún papel con forma de placa, `hayPapel` es false.
 */
export async function prepararImagen(src) {
  // Acepta una foto (data URL) o directamente un canvas con un cuadro del video.
  const img = typeof src === 'string' ? await cargarImagen(src) : src;
  const W = img.naturalWidth ?? img.width;
  const H = img.naturalHeight ?? img.height;
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const ctx = base.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, W, H).data;

  // --- 1. Papel: píxeles claros en los tres canales (el blanco) ---
  const hist = new Array(256).fill(0);
  const claridad = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    claridad[i] = v;
    hist[v]++;
  }
  const umbralPapel = otsu(hist, W * H);
  const papel = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) papel[i] = claridad[i] > umbralPapel ? 1 : 0;

  // Manchas claras (BFS iterativo), con su área y su caja.
  const etiqueta = new Int32Array(W * H);
  const cola = new Int32Array(W * H);
  const claras = [];
  let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!papel[s] || etiqueta[s]) continue;
    id++;
    let ini = 0, fin = 0;
    cola[fin++] = s;
    etiqueta[s] = id;
    let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
    while (ini < fin) {
      const p = cola[ini++];
      const x = p % W, y = (p - x) / W;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      if (x > 0 && papel[p - 1] && !etiqueta[p - 1]) { etiqueta[p - 1] = id; cola[fin++] = p - 1; }
      if (x < W - 1 && papel[p + 1] && !etiqueta[p + 1]) { etiqueta[p + 1] = id; cola[fin++] = p + 1; }
      if (y > 0 && papel[p - W] && !etiqueta[p - W]) { etiqueta[p - W] = id; cola[fin++] = p - W; }
      if (y < H - 1 && papel[p + W] && !etiqueta[p + W]) { etiqueta[p + W] = id; cola[fin++] = p + W; }
    }
    if (fin > W * H * 0.002) claras.push({ id, area: fin, x0: bx0, x1: bx1, y0: by0, y1: by1 });
  }

  // El papel no es la mancha clara más grande: una lámpara o una pared
  // pueden serlo. Se elige la que parece una placa: alargada y con tinta
  // adentro (huecos oscuros dentro de su silueta).
  const pareceUnaPlaca = (c) => {
    const ancho = c.x1 - c.x0 + 1;
    const alto = c.y1 - c.y0 + 1;
    let silueta = 0;
    for (let y = c.y0; y <= c.y1; y++) {
      let a = -1, b = -1;
      for (let x = c.x0; x <= c.x1; x++) {
        if (etiqueta[y * W + x] === c.id) { if (a < 0) a = x; b = x; }
      }
      if (a >= 0) silueta += b - a + 1;
    }
    const tinta = (silueta - c.area) / silueta;
    return ancho / alto >= 1.3 && ancho / alto <= 8 && tinta >= 0.03 && tinta <= 0.6;
  };
  const candidatas = claras.sort((a, b) => b.area - a.area).slice(0, 8);
  const mejor = candidatas.find(pareceUnaPlaca) ?? null;
  const region = mejor ? null : buscarTexto(px, W, H);
  const hayPapel = !!mejor || !!region;

  // Por cada fila, el tramo entre el primer y el último píxel de papel.
  // La tinta queda adentro de ese tramo; el fondo de las esquinas, afuera.
  const izq = new Int32Array(H).fill(-1);
  const der = new Int32Array(H).fill(-1);
  let y0 = H, y1 = -1, x0 = W, x1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mejor && etiqueta[y * W + x] !== mejor.id) continue;
      if (region && (x < region.x0 || x > region.x1 || y < region.y0 || y > region.y1)) continue;
      if (izq[y] < 0) izq[y] = x;
      der[y] = x;
    }
    if (izq[y] >= 0) {
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      x0 = Math.min(x0, izq[y]); x1 = Math.max(x1, der[y]);
    }
  }

  // Margen hacia adentro para no leer los bordes del papel.
  const mx = Math.round((x1 - x0) * 0.025);
  const my = Math.round((y1 - y0) * 0.06);
  x0 += mx; x1 -= mx; y0 += my; y1 -= my;
  const cw = Math.max(1, x1 - x0 + 1);
  const chh = Math.max(1, y1 - y0 + 1);

  // --- 2. Tinta: el canal rojo separa bien el marcador azul (o negro) del papel ---
  const tono = new Uint8Array(cw * chh);
  const dentro = new Uint8Array(cw * chh);
  const histT = new Array(256).fill(0);
  let nDentro = 0;
  for (let y = 0; y < chh; y++) {
    const yy = y + y0;
    for (let x = 0; x < cw; x++) {
      const xx = x + x0;
      const i = yy * W + xx;
      const r = px[i * 4], g = px[i * 4 + 1];
      const v = Math.round(r * 0.7 + g * 0.3);
      tono[y * cw + x] = v;
      if (xx >= izq[yy] + mx && xx <= der[yy] - mx) {
        dentro[y * cw + x] = 1;
        histT[v]++;
        nDentro++;
      }
    }
  }
  const umbralTinta = otsu(histT, nDentro || 1);

  // Tinta binaria: 1 = negro.
  const tinta = new Uint8Array(cw * chh);
  for (let i = 0; i < cw * chh; i++) tinta[i] = dentro[i] && tono[i] <= umbralTinta ? 1 : 0;
  const manchas = limpiarManchas(tinta, cw, chh);
  const cajas = segmentar(manchas);

  // --- 3. Lienzo final: escalado y con borde blanco ---
  const escala = Math.min(4, Math.max(1, 180 / chh));
  const bin = document.createElement('canvas');
  bin.width = cw;
  bin.height = chh;
  const bctx = bin.getContext('2d');
  const out = bctx.createImageData(cw, chh);
  for (let i = 0; i < cw * chh; i++) {
    const c = tinta[i] ? 0 : 255;
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = c;
    out.data[i * 4 + 3] = 255;
  }
  bctx.putImageData(out, 0, 0);

  const borde = 24;
  const final = document.createElement('canvas');
  final.width = Math.round(cw * escala) + borde * 2;
  final.height = Math.round(chh * escala) + borde * 2;
  const fctx = final.getContext('2d');
  fctx.fillStyle = '#fff';
  fctx.fillRect(0, 0, final.width, final.height);
  fctx.imageSmoothingEnabled = false;
  fctx.drawImage(bin, borde, borde, cw * escala, chh * escala);
  return { lienzo: final, tinta, ancho: cw, cajas, hayPapel, manchas: manchas.length };
}

/**
 * Busca una placa válida en el texto leído. Prueba cada tramo de 7
 * caracteres corrigiendo según la posición y se queda con el que menos
 * cambios necesitó.
 */
export function corregirPlaca(texto) {
  const limpio = (texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let mejor = null;
  for (let i = 0; i + 7 <= limpio.length; i++) {
    const tramo = limpio.slice(i, i + 7);
    let cambios = 0;
    const corregido = [...tramo].map((c, pos) => {
      const quiereNumero = pos >= 1 && pos <= 3;
      const esNumero = c >= '0' && c <= '9';
      if (quiereNumero && !esNumero && A_NUMERO[c]) { cambios++; return A_NUMERO[c]; }
      if (!quiereNumero && esNumero && A_LETRA[c]) { cambios++; return A_LETRA[c]; }
      return c;
    }).join('');
    if (PLACA.test(corregido) && (!mejor || cambios < mejor.cambios)) mejor = { placa: corregido, cambios };
  }
  return { limpio, placa: mejor?.placa ?? null, cambios: mejor?.cambios ?? 0 };
}

// Un solo worker para toda la sesión: crearlo cuesta varios segundos.
let workerPromesa = null;

async function obtenerWorker() {
  if (!workerPromesa) {
    workerPromesa = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: ALFABETO });
      return worker;
    })().catch((e) => {
      workerPromesa = null;
      throw e;
    });
  }
  return workerPromesa;
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMEROS = '0123456789';

/** Lee la placa de una foto (data URL). */
/**
 * Lee la placa de una foto o de un cuadro de video.
 *
 * Si no hay un papel con forma de placa se responde enseguida, sin OCR.
 * Con `rapido` (la detección automática en vivo) además se exige que haya
 * trazos que parezcan caracteres, y se usan menos variantes por carácter.
 *
 * Las lecturas se encolan: el motor es uno solo y sus parámetros cambian
 * entre pasos, así que dos lecturas a la vez se pisarían.
 */
let cola = Promise.resolve();
export function leerPlaca(src, { rapido = false } = {}) {
  const tarea = cola.then(() => leer(src, rapido));
  cola = tarea.catch(() => {});
  return tarea;
}

async function leer(src, rapido) {
  const { lienzo, tinta, ancho, cajas, hayPapel, manchas } = await prepararImagen(src);
  // Sin un papel con forma de placa no hay nada que leer.
  if (!hayPapel || (rapido && (manchas < 3 || manchas > 10))) {
    return { placa: null, parcial: null, texto: '', confianza: 0, recorte: null };
  }
  const worker = await obtenerWorker();
  const candidatos = [];

  // A) Carácter por carácter, sabiendo qué va en cada posición.
  if (cajas.length === 7) {
    let texto = '';
    let confianzas = 0;
    // Cada carácter se lee en varios tamaños y grosores de trazo, y se vota.
    // Sin al menos 2 lecturas que coincidan queda '?': mejor que el
    // operador complete un hueco que confíe en una letra adivinada.
    const variantes = rapido
      ? [[64, 0], [40, 1], [24, 2]]
      : [[64, 0], [64, 1], [40, 0], [40, 1], [24, 2], [24, 3]];
    await worker.setParameters({ tessedit_pageseg_mode: '10' }); // un solo carácter
    for (let i = 0; i < 7; i++) {
      await worker.setParameters({ tessedit_char_whitelist: i >= 1 && i <= 3 ? NUMEROS : LETRAS });
      const votos = {};
      for (const [alto, adelgazar] of variantes) {
        const { data } = await worker.recognize(lienzoCaracter(tinta, ancho, cajas[i], adelgazar, alto));
        const leido = (data.text ?? '').replace(/[^A-Z0-9]/g, '')[0];
        if (!leido) continue;
        votos[leido] ??= { n: 0, conf: 0 };
        votos[leido].n++;
        votos[leido].conf += data.confidence ?? 0;
      }
      const [ganador, v] = Object.entries(votos).sort((a, b) => b[1].n - a[1].n)[0] ?? [];
      if (ganador && v.n >= 2) {
        texto += ganador;
        confianzas += v.conf / v.n;
      } else {
        texto += '?';
      }
    }
    const r = corregirPlaca(texto);
    candidatos.push({ ...r, parcial: texto, confianza: Math.round((confianzas / 7) * 10) / 10 });
  }

  // B) La línea completa, como respaldo.
  await worker.setParameters({ tessedit_char_whitelist: ALFABETO });
  for (const modo of rapido ? ['7'] : ['7', '8']) {
    await worker.setParameters({ tessedit_pageseg_mode: modo });
    const { data } = await worker.recognize(lienzo);
    candidatos.push({ ...corregirPlaca(data.text), confianza: Math.round((data.confidence ?? 0) * 10) / 10 });
  }

  // Gana una placa válida, con menos correcciones y más confianza.
  const puntaje = (r) => (r.placa ? 1000 : 0) - r.cambios * 50 + r.confianza;
  const mejor = candidatos.reduce((a, b) => (puntaje(b) > puntaje(a) ? b : a));

  // Sin placa completa: lectura parcial por carácter (con '?'), si la hay.
  const parcial = !mejor.placa ? candidatos[0]?.parcial ?? null : null;

  return {
    placa: mejor.placa,
    parcial: parcial && /[A-Z0-9]/.test(parcial) ? parcial : null,
    texto: mejor.limpio,
    confianza: mejor.confianza,
    recorte: lienzo.toDataURL('image/png'),
  };
}
