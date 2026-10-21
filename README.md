# Sistema Inteligente de Parqueo — Frontend

Proyecto Integrador — Universidad Mariano Gálvez de Guatemala
Ingeniería en Sistemas, Sexto Semestre, Sección A

Interfaz web del parqueo de 5 espacios (1 de carga, 2 privados y 2 libres). Muestra el
estado de la maqueta en tiempo real, lee placas con la cámara y permite operar el
parqueo sin escribir comandos.

Hecho con React 18 y Vite 5.

## Requisitos

- Node.js 20 o superior.
- El **backend** del proyecto corriendo en `http://localhost:8080`. Sin él la interfaz
  abre, pero muestra "Sin conexión".

## Instalación

```bash
npm install
npm run dev          # abre http://localhost:5173
```

Para generar la versión de producción:

```bash
npm run build        # deja los archivos en dist/
npm run preview
```

### Backend en otra dirección

Si el backend no está en `localhost:8080`, crea un archivo `.env` junto a este README:

```ini
VITE_API=http://192.168.1.50:8080
```

Reinicia `npm run dev` después de cambiarlo.

## Secciones

| Sección | Para qué sirve |
| --- | --- |
| **Dashboard** | Resumen: espacios libres, ocupados y en alarma, ocupación por categoría y estado del sistema. |
| **Panel de control** | Mapa de los 5 espacios, detalle del espacio seleccionado, cámara con lectura de placas y consola desplegable. |
| **Historial de capturas** | Fotos tomadas por la cámara con la placa leída. |
| **Actividad y eventos** | Historial de entradas, salidas y alarmas. |
| **Guía de uso** | Instrucciones paso a paso y casos de prueba (CP-01 a CP-15). |

## Cómo se usa

1. **Entrada:** la cámara lee la placa sola y toma la foto. Al registrar la entrada
   se elige el espacio; si el parqueo está lleno, suena la alarma.
2. **Llegada:** el sensor detecta el vehículo; desde el detalle del espacio se
   confirma la llegada.
3. **Salida:** se autoriza la salida desde el detalle. El vehículo tiene 60 s para
   pasar la talanquera, y el espacio se libera solo cuando el sensor deja de detectarlo.
4. **Alarmas:** un vehículo que entra o sale sin autorización activa la alarma. Se
   apaga con el botón **Apagar alarma** en el detalle del espacio, incluso si el
   vehículo no está registrado.

Los espacios privados solo aceptan la placa autorizada, que se cambia desde el
detalle del espacio.

La consola sigue disponible para casos manuales (por ejemplo `LLEGADA(P123ABC);`).

## Estructura

```
src/
├── App.jsx            navegación entre secciones
├── lib.js             dirección del backend, catálogos y peticiones
├── hooks/             estado en tiempo real (WebSocket) y sirena
├── components/        mapa, diálogos, línea de tiempo, piezas de la interfaz
├── pages/             Dashboard, Panel, Actividad, Consola, Guía…
├── Camara.jsx         cámara y lectura automática de placas
├── ocrPlaca.js        procesamiento de imagen y OCR (Tesseract.js)
├── Capturas.jsx       historial de fotos
└── estilos.css
```

## Problemas comunes

- **"Sin conexión":** el backend no está corriendo o `VITE_API` apunta a otra dirección.
- **"Sin señal de la maqueta":** el Arduino no está enviando datos al backend; revisa
  que esté en la misma red y con la IP correcta.
- **No aparece un botón nuevo después de actualizar:** recarga con Ctrl + F5.
- **La cámara no abre:** el navegador solo la permite en `localhost` o con HTTPS.
