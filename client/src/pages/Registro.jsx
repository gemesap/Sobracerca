import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, TIPOS } from '../api.js';
import { useSesion } from '../sesion.jsx';

export default function Registro() {
  const { entrar } = useSesion();
  const nav = useNavigate();
  const [f, setF] = useState({ rol: 'consumidor', nombre: '', correo: '', telefono: '', password: '', razon_social: '', tipo: 'panaderia', acepta_datos: false });
  const [error, setError] = useState('');
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const enviar = async (e) => {
    e.preventDefault(); setError('');
    try {
      const s = await api('/auth/registro', { metodo: 'POST', datos: f });
      entrar(s);
      nav(s.usuario.rol === 'comercio' ? '/comercio/perfil' : '/');
    } catch (err) { setError(err.message); }
  };
  return (
    <form className="formulario" onSubmit={enviar}>
      <h1>Crear cuenta</h1>
      <div className="selector">
        <button type="button" className={f.rol === 'consumidor' ? 'activo' : ''} onClick={() => setF({ ...f, rol: 'consumidor' })}>Quiero comprar</button>
        <button type="button" className={f.rol === 'comercio' ? 'activo' : ''} onClick={() => setF({ ...f, rol: 'comercio' })}>Tengo un negocio</button>
      </div>
      <label>{f.rol === 'comercio' ? 'Nombre del encargado' : 'Nombre'}<input required value={f.nombre} onChange={cambiar('nombre')} /></label>
      {f.rol === 'comercio' && <>
        <label>Nombre del negocio<input required value={f.razon_social} onChange={cambiar('razon_social')} /></label>
        <label>Tipo de negocio<select value={f.tipo} onChange={cambiar('tipo')}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </>}
      <label>Correo<input type="email" required value={f.correo} onChange={cambiar('correo')} /></label>
      <label>Celular<input type="tel" value={f.telefono} onChange={cambiar('telefono')} /></label>
      <label>Contraseña (mínimo 6 caracteres)<input type="password" required minLength={6} value={f.password} onChange={cambiar('password')} /></label>
      <label className="check"><input type="checkbox" checked={f.acepta_datos} onChange={cambiar('acepta_datos')} />
        <span>Autorizo el tratamiento de mis datos según la <Link to="/privacidad" target="_blank">política de datos</Link> (Ley 1581 de 2012).</span></label>
      {error && <p className="error">{error}</p>}
      <button>Crear cuenta</button>
      <p>¿Ya tienes cuenta? <Link to="/ingresar">Ingresa</Link></p>
    </form>
  );
}
