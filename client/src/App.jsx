import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useSesion } from './sesion.jsx';
import { api } from './api.js';
import Ofertas from './pages/Ofertas.jsx';
import OfertaDetalle from './pages/OfertaDetalle.jsx';
import Ingresar from './pages/Ingresar.jsx';
import Registro from './pages/Registro.jsx';
import MisReservas from './pages/MisReservas.jsx';
import PanelComercio from './pages/PanelComercio.jsx';
import PerfilComercio from './pages/PerfilComercio.jsx';
import Cierres from './pages/Cierres.jsx';
import Admin from './pages/Admin.jsx';
import Privacidad from './pages/Privacidad.jsx';

function Campana() {
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState(false);
  const cargar = () => api('/notificaciones').then(setLista).catch(() => {});
  useEffect(() => { cargar(); const t = setInterval(cargar, 30000); return () => clearInterval(t); }, []);
  const nuevas = lista.filter((n) => !n.leida).length;
  const abrir = async () => {
    setAbierta(!abierta);
    if (!abierta && nuevas) { await api('/notificaciones/leer', { metodo: 'PATCH' }).catch(() => {}); cargar(); }
  };
  return (
    <div className="campana">
      <button className="icono" onClick={abrir} aria-label="Notificaciones">🔔{nuevas > 0 && <span className="globo">{nuevas}</span>}</button>
      {abierta && (
        <div className="panel-notif">
          {lista.length === 0 && <p className="tenue">No tienes notificaciones.</p>}
          {lista.map((n) => <p key={n.id_notificacion} className={n.leida ? '' : 'nueva'}>{n.mensaje}</p>)}
        </div>
      )}
    </div>
  );
}

function Protegida({ rol, children }) {
  const { usuario } = useSesion();
  if (!usuario) return <Navigate to="/ingresar" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { usuario, salir } = useSesion();
  const nav = useNavigate();
  const inicio = usuario?.rol === 'comercio' ? '/comercio' : usuario?.rol === 'admin' ? '/admin' : '/';
  return (
    <div className="app">
      <header className="barra">
        <Link to={inicio} className="marca">SobraCerca</Link>
        <div className="acciones">
          {usuario && <Campana />}
          {usuario
            ? <button className="enlace-claro" onClick={() => { salir(); nav('/'); }}>Salir</button>
            : <Link className="enlace-claro" to="/ingresar">Ingresar</Link>}
        </div>
      </header>

      {usuario && (
        <nav className="pestanas">
          {usuario.rol === 'consumidor' && <><NavLink to="/" end>Ofertas</NavLink><NavLink to="/mis-reservas">Mis reservas</NavLink></>}
          {usuario.rol === 'comercio' && <><NavLink to="/comercio" end>Mi panel</NavLink><NavLink to="/comercio/cierres">Cierre del día</NavLink><NavLink to="/comercio/perfil">Perfil</NavLink></>}
          {usuario.rol === 'admin' && <NavLink to="/admin">Administración</NavLink>}
        </nav>
      )}

      <main className="contenido">
        <Routes>
          <Route path="/" element={usuario?.rol === 'comercio' ? <Navigate to="/comercio" /> : usuario?.rol === 'admin' ? <Navigate to="/admin" /> : <Ofertas />} />
          <Route path="/oferta/:id" element={<OfertaDetalle />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/mis-reservas" element={<Protegida rol="consumidor"><MisReservas /></Protegida>} />
          <Route path="/comercio" element={<Protegida rol="comercio"><PanelComercio /></Protegida>} />
          <Route path="/comercio/perfil" element={<Protegida rol="comercio"><PerfilComercio /></Protegida>} />
          <Route path="/comercio/cierres" element={<Protegida rol="comercio"><Cierres /></Protegida>} />
          <Route path="/admin" element={<Protegida rol="admin"><Admin /></Protegida>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <footer className="pie">Prototipo académico · Proyecto de grado UNAD · <Link to="/privacidad">Política de datos</Link></footer>
    </div>
  );
}
