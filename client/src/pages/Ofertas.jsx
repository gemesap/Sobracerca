import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, distancia, horaCorta, pesos, TIPOS } from '../api.js';
import Mapa from '../Mapa.jsx';

export default function Ofertas() {
  const [ofertas, setOfertas] = useState(null);
  const [yo, setYo] = useState(null);
  const [error, setError] = useState('');

  const cargar = (pos) => {
    const q = pos ? `?lat=${pos[0]}&lng=${pos[1]}` : '';
    api(`/ofertas${q}`).then(setOfertas).catch((e) => setError(e.message));
  };
  useEffect(() => { cargar(); }, []);

  const ubicarme = () => {
    if (!navigator.geolocation) return setError('Tu navegador no permite obtener la ubicación.');
    navigator.geolocation.getCurrentPosition(
      (p) => { const pos = [p.coords.latitude, p.coords.longitude]; setYo(pos); cargar(pos); },
      () => setError('No pudimos obtener tu ubicación; mostramos las ofertas desde el barrio Marruecos.'));
  };

  return (
    <section>
      <h1>Ofertas cerca de ti</h1>
      <p className="tenue">Comida en buen estado que los negocios del barrio no alcanzaron a vender hoy, a mejor precio.</p>
      <Mapa yo={yo} centro={yo} puntos={(ofertas || []).map((o) => ({ lat: o.latitud, lng: o.longitud, texto: `${o.razon_social}: ${o.descripcion_producto}` }))} />
      <button className="secundario" onClick={ubicarme}>📍 Usar mi ubicación</button>
      {error && <p className="error">{error}</p>}
      {ofertas === null && <p className="tenue">Cargando ofertas…</p>}
      {ofertas?.length === 0 && <div className="vacio">Por ahora no hay ofertas disponibles. Vuelve más tarde, normalmente aparecen al final del día.</div>}
      <ul className="lista">
        {ofertas?.map((o) => (
          <li key={o.id_publicacion}>
            <Link to={`/oferta/${o.id_publicacion}`} className="tarjeta oferta">
              <div>
                <strong>{o.razon_social}</strong>
                <span className="etiqueta">{TIPOS[o.tipo] || o.tipo}</span>
                <p>{o.descripcion_producto}</p>
                <small className="tenue">{distancia(o.distancia_m)} · recoger hasta {horaCorta(o.hora_fin_recogida)} · quedan {o.cantidad_disponible}</small>
              </div>
              <div className="precio">
                <s>{pesos(o.precio_original)}</s>
                <b>{pesos(o.precio_oferta)}</b>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
