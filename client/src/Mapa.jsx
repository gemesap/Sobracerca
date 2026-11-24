import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { CENTRO } from './api.js';

function Clic({ alClic }) {
  useMapEvents({ click: (e) => alClic && alClic(e.latlng) });
  return null;
}

// Mapa con OpenStreetMap; puntos verdes = comercios, azul = usuario
export default function Mapa({ puntos = [], centro, yo, alClic, alto = 220, zoom = 15 }) {
  return (
    <MapContainer center={centro || CENTRO} zoom={zoom} style={{ height: alto }} className="mapa" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clic alClic={alClic} />
      {yo && <CircleMarker center={yo} radius={7} pathOptions={{ color: '#1d4ed8', fillOpacity: 0.9 }} />}
      {puntos.map((p, i) => (
        <CircleMarker key={i} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: '#2f6f4f', fillColor: '#3f9b6b', fillOpacity: 0.9 }}>
          {p.texto && <Popup>{p.texto}</Popup>}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
