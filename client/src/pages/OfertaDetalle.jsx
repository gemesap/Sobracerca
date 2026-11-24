import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, horaCorta, pesos, TIPOS } from '../api.js';
import { useSesion } from '../sesion.jsx';
import Mapa from '../Mapa.jsx';

export default function OfertaDetalle() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [o, setO] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [reserva, setReserva] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { api(`/ofertas/${id}`).then(setO).catch((e) => setError(e.message)); }, [id]);

  const reservar = async () => {
    if (!usuario) return nav('/ingresar', { state: { volver: `/oferta/${id}` } });
    setEnviando(true); setError('');
    try { setReserva(await api('/reservas', { metodo: 'POST', datos: { id_publicacion: Number(id), cantidad: Number(cantidad) } })); }
    catch (e) { setError(e.message); }
    finally { setEnviando(false); }
  };

  if (reserva) {
    return (
      <section className="centrado">
        <h1 className="exito">¡Reserva confirmada!</h1>
        <p>{reserva.razon_social} · {reserva.cantidad} × {reserva.descripcion_producto}</p>
        <div className="codigo"><small>Código de recogida</small><b>{reserva.codigo_recogida}</b></div>
        <p>Recoger entre {horaCorta(reserva.hora_inicio_recogida)} y {horaCorta(reserva.hora_fin_recogida)}</p>
        <p>Total a pagar en el local: <b>{pesos(reserva.precio_oferta * reserva.cantidad)}</b></p>
        <a className="boton" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.latitud},${o.longitud}`}>Cómo llegar</a>
        <Link to="/mis-reservas" className="enlace">Ver mis reservas</Link>
      </section>
    );
  }
  if (!o) return <p className={error ? 'error' : 'tenue'}>{error || 'Cargando…'}</p>;

  const disponible = o.estado === 'activa' && o.cantidad_disponible > 0 && new Date(o.hora_fin_recogida) > new Date();
  const compartir = `https://wa.me/?text=${encodeURIComponent(`Mira esta oferta en SobraCerca: ${o.descripcion_producto} en ${o.razon_social} a ${pesos(o.precio_oferta)} ${window.location.href}`)}`;

  return (
    <section>
      <Link to="/" className="enlace">← Volver</Link>
      <h1>{o.descripcion_producto}</h1>
      <p><strong>{o.razon_social}</strong> <span className="etiqueta">{TIPOS[o.tipo] || o.tipo}</span>{o.calificacion && <span> ★ {o.calificacion}</span>}</p>
      <p className="tenue">{o.direccion}</p>
      <div className="precio grande"><s>{pesos(o.precio_original)}</s> <b>{pesos(o.precio_oferta)}</b></div>
      <p>Recoger entre <b>{horaCorta(o.hora_inicio_recogida)}</b> y <b>{horaCorta(o.hora_fin_recogida)}</b> · pago en el local</p>
      <Mapa puntos={[{ lat: o.latitud, lng: o.longitud }]} centro={[o.latitud, o.longitud]} alto={170} zoom={16} />
      {disponible ? (
        <div className="tarjeta">
          <label>Cantidad (quedan {o.cantidad_disponible})
            <input type="number" min="1" max={o.cantidad_disponible} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button onClick={reservar} disabled={enviando}>{enviando ? 'Reservando…' : usuario ? 'Reservar' : 'Ingresa para reservar'}</button>
        </div>
      ) : <div className="vacio">Esta oferta ya no está disponible.</div>}
      <a className="enlace" href={compartir} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
    </section>
  );
}
