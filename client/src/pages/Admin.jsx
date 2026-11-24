import { useEffect, useState } from 'react';
import { api, pesos, TIPOS } from '../api.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${v} %`);

export default function Admin() {
  const [comercios, setComercios] = useState([]);
  const [ind, setInd] = useState(null);
  const [error, setError] = useState('');
  const cargar = () => {
    api('/admin/comercios').then(setComercios).catch((e) => setError(e.message));
    api('/admin/indicadores').then(setInd).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);
  const validar = async (id, validado) => { await api(`/admin/comercios/${id}/validar`, { metodo: 'PATCH', datos: { validado } }); cargar(); };
  return (
    <section>
      <h1>Administración</h1>
      {error && <p className="error">{error}</p>}
      {ind && (
        <>
          <h2>Indicadores del piloto</h2>
          <div className="indicadores">
            <div><b>{ind.comercios_validados}/{ind.comercios}</b><small>comercios validados</small></div>
            <div><b>{ind.consumidores}</b><small>consumidores</small></div>
            <div><b>{ind.unidades_publicadas}</b><small>unidades publicadas</small></div>
            <div><b>{ind.unidades_reservadas}</b><small>reservadas</small></div>
            <div><b>{ind.unidades_retiradas}</b><small>retiradas</small></div>
            <div><b>{pct(ind.tasa_retiro)}</b><small>tasa de retiro</small></div>
            <div><b>{pesos(ind.valor_recuperado)}</b><small>valor recuperado</small></div>
            <div><b>{ind.calificacion_promedio ? `★ ${ind.calificacion_promedio}` : '—'}</b><small>calificación</small></div>
          </div>
          <table className="tabla">
            <thead><tr><th>Etapa</th><th>Días</th><th>Sobrantes</th><th>Descartadas</th><th>Tasa de descarte</th></tr></thead>
            <tbody>
              <tr><td>Línea base</td><td>{ind.linea_base.dias}</td><td>{ind.linea_base.sobrantes ?? 0}</td><td>{ind.linea_base.descartadas ?? 0}</td><td>{pct(ind.linea_base.tasa_descarte)}</td></tr>
              <tr><td>Piloto</td><td>{ind.piloto.dias}</td><td>{ind.piloto.sobrantes ?? 0}</td><td>{ind.piloto.descartadas ?? 0}</td><td>{pct(ind.piloto.tasa_descarte)}</td></tr>
            </tbody>
          </table>
        </>
      )}
      <h2>Comercios</h2>
      <ul className="lista">
        {comercios.map((c) => (
          <li key={c.id_comercio} className="tarjeta">
            <div className="fila"><strong>{c.razon_social}</strong><span className={`estado ${c.validado ? 'activa' : 'vencida'}`}>{c.validado ? 'Validado' : 'Pendiente'}</span></div>
            <small className="tenue">{TIPOS[c.tipo] || c.tipo} · {c.direccion || 'sin dirección'} · {c.nombre} · {c.telefono || c.correo}</small>
            {c.validado
              ? <button className="secundario" onClick={() => validar(c.id_comercio, false)}>Quitar validación</button>
              : <button onClick={() => validar(c.id_comercio, true)} disabled={c.latitud === null}>{c.latitud === null ? 'Falta ubicación' : 'Validar comercio'}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
