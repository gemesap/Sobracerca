import { useEffect, useState } from 'react';
import { api, horaCorta, pesos } from '../api.js';

const ESTADOS = { activa: 'Por recoger', retirada: 'Recogida', cancelada: 'Cancelada', vencida: 'Vencida' };

function Calificar({ reserva, alTerminar }) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const enviar = async () => {
    try { await api('/calificaciones', { metodo: 'POST', datos: { id_reserva: reserva.id_reserva, puntaje, comentario } }); alTerminar(); }
    catch (e) { setError(e.message); }
  };
  return (
    <div className="calificar">
      <div className="estrellas">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= puntaje ? 'on' : ''} onClick={() => setPuntaje(n)}>★</button>)}</div>
      <input placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button disabled={!puntaje} onClick={enviar}>Enviar calificación</button>
    </div>
  );
}

export default function MisReservas() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const cargar = () => api('/reservas').then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);
  const cancelar = async (id) => {
    if (!window.confirm('¿Seguro que quieres cancelar esta reserva?')) return;
    try { await api(`/reservas/${id}/cancelar`, { metodo: 'PATCH' }); cargar(); } catch (e) { setError(e.message); }
  };
  return (
    <section>
      <h1>Mis reservas</h1>
      {error && <p className="error">{error}</p>}
      {lista?.length === 0 && <div className="vacio">Aún no has reservado nada.</div>}
      <ul className="lista">
        {lista?.map((r) => (
          <li key={r.id_reserva} className="tarjeta">
            <div className="fila"><strong>{r.razon_social}</strong><span className={`estado ${r.estado}`}>{ESTADOS[r.estado]}</span></div>
            <p>{r.cantidad} × {r.descripcion_producto} · {pesos(r.precio_oferta * r.cantidad)}</p>
            {r.estado === 'activa' && <>
              <div className="codigo pequeño"><small>Código</small><b>{r.codigo_recogida}</b></div>
              <p className="tenue">Recoger entre {horaCorta(r.hora_inicio_recogida)} y {horaCorta(r.hora_fin_recogida)} · {r.direccion}</p>
              <button className="peligro" onClick={() => cancelar(r.id_reserva)}>Cancelar reserva</button>
            </>}
            {r.estado === 'retirada' && (r.puntaje ? <p>Tu calificación: {'★'.repeat(r.puntaje)}</p> : <Calificar reserva={r} alTerminar={cargar} />)}
          </li>
        ))}
      </ul>
    </section>
  );
}
