import Camara from '../Camara.jsx';
import Consola from './Consola.jsx';
import { DetalleEspacio, MapaParqueo } from './Mapa.jsx';

/**
 * Panel de control: arriba el mapa con el detalle del espacio, en el medio
 * la cámara a lo ancho (desde ahí se lleva el proceso de cada vehículo) y
 * abajo la consola, plegada, para los casos manuales.
 */
export default function Panel({ datos, activo, onSeleccionar, onMover, onCapturaGuardada }) {
  return (
    <div className="panel-control">
      <div className="panel-mapa">
        <MapaParqueo datos={datos} onSeleccionar={onSeleccionar} onMover={onMover} />
      </div>
      <div className="panel-detalle">
        <DetalleEspacio datos={datos} onSeleccionar={onSeleccionar} onMover={onMover} />
      </div>
      <div className="panel-camara">
        <Camara
          activa={activo}
          onCapturaGuardada={onCapturaGuardada}
          espacios={datos.espacios}
          reservas={datos.reservas ?? []}
        />
      </div>
      <div className="panel-consola">
        <Consola />
      </div>
    </div>
  );
}
