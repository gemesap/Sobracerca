import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, horaCorta, pesos } from '../api.js';

const aHora = (d) => d.toTimeString().slice(0, 5);
const hoyCon = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };

function FormularioPublicar({ alPublicar }) {
  const ahora = new Date();
  const vacio = { descripcion_producto: '', cantidad: '', precio_original: '', precio_oferta: '', desde: aHora(ahora), hasta: aHora(new Date(ahora.getTime() + 2 * 3600e3)) };
  const [f, setF] = useState(vacio);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const enviar = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      await api('/comercio/publicaciones', { metodo: 'POST', datos: {
        descripcion_producto: f.descripcion_producto, cantidad: Number(f.cantidad), precio_original: Number(f.precio_original),
        precio_oferta: Number(f.precio_oferta), hora_inicio_recogida: hoyCon(f.desde), hora_fin_recogida: hoyCon(f.hasta) } });
      setOk('¡Publicado! Los vecinos ya pueden verlo.'); setF(vacio); alPublicar();
    } catch (err) { setError(err.message); }
  };
  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h2>Publicar excedente</h2>
      <label>¿Qué te sobró?<input required placeholder="Ej.: bolsa de pan del día x6" value={f.descripcion_producto} onChange={c('descripcion_producto')} /></label>
      <label>Cantidad disponible<input required type="number" min="1" inputMode="numeric" value={f.cantidad} onChange={c('cantidad')} /></label>
      <div className="dos">
        <label>Precio normal<input required type="number" min="1" inputMode="numeric" value={f.precio_original} onChange={c('precio_original')} /></label>
        <label>Precio oferta<input required type="number" min="1" inputMode="numeric" value={f.precio_oferta} onChange={c('precio_oferta')} /></label>
      </div>
      <div className="dos">
        <label>Recoger desde<input required type="time" value={f.desde} onChange={c('desde')} /></label>
        <label>Hasta<input required type="time" value={f.hasta} onChange={c('hasta')} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      {ok && <p className="exito">{ok}</p>}
      <button>Publicar excedente</button>
    </form>
  );
}

function ConfirmarEntrega({ alConfirmar }) {
  const [codigo, setCodigo] = useState('SC-');
  const [msg, setMsg] = useState(null);
  const enviar = async (e) => {
    e.preventDefault();
    try { const r = await api('/comercio/entregas', { metodo: 'POST', datos: { codigo } }); setMsg({ ok: `Entrega confirmada (${r.codigo_recogida}).` }); setCodigo('SC-'); alConfirmar(); }
    catch (err) { setMsg({ error: err.message }); }
  };
  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>Confirmar entrega</h2>
      <p className="tenue">Pide al cliente su código de recogida.</p>
      <div className="fila"><input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} aria-label="Código" /><button>Confirmar</button></div>
      {msg?.ok && <p className="exito">{msg.ok}</p>}
      {msg?.error && <p className="error">{msg.error}</p>}
    </form>
  );
}

const ESTADO_PUB = { activa: 'Activa', agotada: 'Agotada', vencida: 'Vencida', cerrada: 'Cerrada' };

export default function PanelComercio() {
  const [resumen, setResumen] = useState(null);
  const [pubs, setPubs] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [error, setError] = useState('');
  const cargar = () => {
    api('/comercio/resumen').then(setResumen).catch((e) => setError(e.message));
    api('/comercio/publicaciones').then(setPubs).catch(() => {});
    api('/comercio/reservas').then(setReservas).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);
  const cerrar = async (id) => { await api(`/comercio/publicaciones/${id}/cerrar`, { metodo: 'PATCH' }).catch((e) => setError(e.message)); cargar(); };
  const pendientes = reservas.filter((r) => r.estado === 'activa');

  return (
    <section>
      <h1>{resumen?.razon_social || 'Mi negocio'}</h1>
      {error && <p className="error">{error}</p>}
      {resumen && !resumen.validado && (
        <div className="aviso">Tu comercio está en revisión. Mientras tanto, completa tu <Link to="/comercio/perfil">perfil y ubicación</Link>. Cuando el administrador lo valide podrás publicar.</div>
      )}
      {resumen && (
        <div className="indicadores">
          <div><b>{resumen.publicadas}</b><small>publicadas</small></div>
          <div><b>{resumen.retiradas}</b><small>recogidas</small></div>
          <div><b>{pesos(resumen.valor_recuperado)}</b><small>recuperado</small></div>
          <div><b>{resumen.calificacion_promedio ? `★ ${resumen.calificacion_promedio}` : '—'}</b><small>calificación</small></div>
        </div>
      )}
      {resumen?.validado && <FormularioPublicar alPublicar={cargar} />}
      {resumen?.validado && <ConfirmarEntrega alConfirmar={cargar} />}

      <h2>Reservas por entregar ({pendientes.length})</h2>
      {pendientes.length === 0 && <p className="tenue">No hay reservas pendientes.</p>}
      <ul className="lista">
        {pendientes.map((r) => (
          <li key={r.id_reserva} className="tarjeta fila">
            <div><strong>{r.codigo_recogida}</strong> · {r.cliente}<br /><small>{r.cantidad} × {r.descripcion_producto}</small></div>
            <small className="tenue">hasta {horaCorta(r.hora_fin_recogida)}</small>
          </li>
        ))}
      </ul>

      <h2>Mis publicaciones</h2>
      <ul className="lista">
        {pubs.map((p) => (
          <li key={p.id_publicacion} className="tarjeta">
            <div className="fila"><strong>{p.descripcion_producto}</strong><span className={`estado ${p.estado}`}>{ESTADO_PUB[p.estado]}</span></div>
            <small className="tenue">{pesos(p.precio_oferta)} · quedan {p.cantidad_disponible} de {p.cantidad_publicada} · recogidas {p.retiradas} · hasta {horaCorta(p.hora_fin_recogida)}</small>
            {['activa', 'agotada'].includes(p.estado) && <button className="secundario" onClick={() => cerrar(p.id_publicacion)}>Cerrar publicación</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
