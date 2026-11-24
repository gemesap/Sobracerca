import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, TIPOS } from '../api.js';
import { useSesion } from '../sesion.jsx';
import Mapa from '../Mapa.jsx';

export default function PerfilComercio() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const { salir } = useSesion();
  const nav = useNavigate();
  useEffect(() => { api('/comercio/perfil').then(setF).catch((e) => setMsg({ error: e.message })); }, []);
  if (!f) return <p className="tenue">{msg?.error || 'Cargando…'}</p>;
  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async (e) => {
    e.preventDefault();
    try { setF(await api('/comercio/perfil', { metodo: 'PUT', datos: f })); setMsg({ ok: 'Perfil guardado.' }); }
    catch (err) { setMsg({ error: err.message }); }
  };
  const eliminar = async () => {
    if (!window.confirm('Se borrarán tu cuenta, tu comercio y sus publicaciones. ¿Continuar?')) return;
    await api('/auth/cuenta', { metodo: 'DELETE' }); salir(); nav('/');
  };
  const punto = f.latitud !== null && f.latitud !== undefined ? [Number(f.latitud), Number(f.longitud)] : null;
  return (
    <form className="formulario" onSubmit={guardar}>
      <h1>Perfil del negocio</h1>
      <label>Nombre del negocio<input required value={f.razon_social || ''} onChange={c('razon_social')} /></label>
      <label>Tipo<select value={f.tipo} onChange={c('tipo')}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Dirección<input required value={f.direccion || ''} onChange={c('direccion')} /></label>
      <label>Horario<input placeholder="Ej.: 6:00 a. m. – 9:00 p. m." value={f.horario || ''} onChange={c('horario')} /></label>
      <p className="tenue">Toca el mapa para marcar dónde queda tu negocio.</p>
      <Mapa centro={punto} puntos={punto ? [{ lat: punto[0], lng: punto[1] }] : []} alClic={(ll) => setF({ ...f, latitud: ll.lat, longitud: ll.lng })} alto={240} zoom={16} />
      {msg?.ok && <p className="exito">{msg.ok}</p>}
      {msg?.error && <p className="error">{msg.error}</p>}
      <button>Guardar</button>
      <button type="button" className="peligro" onClick={eliminar}>Eliminar mi cuenta</button>
    </form>
  );
}
