import { useEffect, useState } from 'react';
import { api } from '../api.js';

const hoy = () => new Date().toLocaleDateString('en-CA');

// Registro diario de excedentes (Anexo D): permite comparar la línea base con el piloto
export default function Cierres() {
  const vacio = { fecha: hoy(), fase: 'piloto', unidades_sobrantes: '', vendidas_fuera_app: 0, regaladas: 0, descartadas: 0 };
  const [f, setF] = useState(vacio);
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState(null);
  const cargar = () => api('/comercio/cierres').then(setLista).catch(() => {});
  useEffect(() => { cargar(); }, []);
  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async (e) => {
    e.preventDefault();
    try { await api('/comercio/cierres', { metodo: 'POST', datos: f }); setMsg({ ok: 'Registro guardado.' }); setF(vacio); cargar(); }
    catch (err) { setMsg({ error: err.message }); }
  };
  return (
    <section>
      <form className="tarjeta formulario" onSubmit={guardar}>
        <h1>Cierre del día</h1>
        <p className="tenue">Al cerrar, anota cuántas unidades te sobraron y qué hiciste con ellas. Esto sirve para medir si SobraCerca ayuda a botar menos comida.</p>
        <div className="dos">
          <label>Fecha<input type="date" required value={f.fecha} onChange={c('fecha')} /></label>
          <label>Etapa<select value={f.fase} onChange={c('fase')}><option value="linea_base">Antes de usar la app</option><option value="piloto">Usando la app</option></select></label>
        </div>
        <label>Unidades que sobraron al cierre<input type="number" min="0" required value={f.unidades_sobrantes} onChange={c('unidades_sobrantes')} /></label>
        <div className="dos">
          <label>Vendidas con descuento fuera de la app<input type="number" min="0" value={f.vendidas_fuera_app} onChange={c('vendidas_fuera_app')} /></label>
          <label>Regaladas<input type="number" min="0" value={f.regaladas} onChange={c('regaladas')} /></label>
        </div>
        <label>Botadas (descartadas)<input type="number" min="0" value={f.descartadas} onChange={c('descartadas')} /></label>
        {msg?.ok && <p className="exito">{msg.ok}</p>}
        {msg?.error && <p className="error">{msg.error}</p>}
        <button>Guardar cierre</button>
      </form>
      <h2>Registros</h2>
      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Etapa</th><th>Sobró</th><th>Botado</th></tr></thead>
        <tbody>{lista.map((r) => (
          <tr key={r.id_registro}><td>{String(r.fecha).slice(0, 10)}</td><td>{r.fase === 'piloto' ? 'Con app' : 'Antes'}</td><td>{r.unidades_sobrantes}</td><td>{r.descartadas}</td></tr>
        ))}</tbody>
      </table>
    </section>
  );
}
