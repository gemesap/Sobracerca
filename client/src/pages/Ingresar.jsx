import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';

export default function Ingresar() {
  const { entrar } = useSesion();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ correo: '', password: '' });
  const [error, setError] = useState('');
  const enviar = async (e) => {
    e.preventDefault(); setError('');
    try {
      const s = await api('/auth/login', { metodo: 'POST', datos: f });
      entrar(s);
      nav(loc.state?.volver || (s.usuario.rol === 'comercio' ? '/comercio' : s.usuario.rol === 'admin' ? '/admin' : '/'));
    } catch (err) { setError(err.message); }
  };
  return (
    <form className="formulario" onSubmit={enviar}>
      <h1>Ingresar</h1>
      <label>Correo<input type="email" required value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} /></label>
      <label>Contraseña<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}
      <button>Ingresar</button>
      <p>¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
    </form>
  );
}
