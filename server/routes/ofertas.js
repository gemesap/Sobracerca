import { Router } from 'express';
import { query, transaccion } from '../db.js';
import { autenticar } from '../auth.js';
import { ErrorApp, actualizarVencimientos, distanciaMetros, entero, generarCodigo, notificar } from '../util.js';
import { a } from './auth.js';

const r = Router();

// Punto de referencia por defecto: barrio Marruecos (localidad Rafael Uribe Uribe)
const CENTRO = { lat: 4.5585, lng: -74.1195 };

const SQL_OFERTA = `
  SELECT p.id_publicacion, p.descripcion_producto, p.cantidad_publicada, p.cantidad_disponible,
         p.precio_original, p.precio_oferta, p.hora_inicio_recogida, p.hora_fin_recogida, p.estado,
         c.id_comercio, c.razon_social, c.tipo, c.direccion, c.latitud, c.longitud, c.horario,
         (SELECT ROUND(AVG(ca.puntaje)::numeric,1) FROM calificacion ca JOIN reserva r ON r.id_reserva = ca.id_reserva
            JOIN publicacion p2 ON p2.id_publicacion = r.id_publicacion WHERE p2.id_comercio = c.id_comercio) AS calificacion
  FROM publicacion p JOIN comercio c ON c.id_comercio = p.id_comercio`;

// RF05: ofertas vigentes ordenadas por distancia y hora de cierre (consulta pública)
r.get('/ofertas', a(async (req, res) => {
  await actualizarVencimientos();
  const lat = Number.isFinite(entero(req.query.lat)) ? entero(req.query.lat) : CENTRO.lat;
  const lng = Number.isFinite(entero(req.query.lng)) ? entero(req.query.lng) : CENTRO.lng;
  const q = await query(`${SQL_OFERTA}
    WHERE p.estado = 'activa' AND p.cantidad_disponible > 0 AND p.hora_fin_recogida > now() AND c.validado`);
  const ofertas = q.rows
    .map((o) => ({ ...o, distancia_m: distanciaMetros(lat, lng, o.latitud, o.longitud) }))
    .sort((x, y) => x.distancia_m - y.distancia_m || new Date(x.hora_fin_recogida) - new Date(y.hora_fin_recogida));
  res.json(ofertas);
}));

r.get('/ofertas/:id', a(async (req, res) => {
  await actualizarVencimientos();
  const q = await query(`${SQL_OFERTA} WHERE p.id_publicacion = $1`, [req.params.id]);
  if (!q.rowCount) throw new ErrorApp(404, 'La oferta no existe.');
  res.json(q.rows[0]);
}));

// RF06: reservar; el bloqueo FOR UPDATE evita reservar más de lo disponible (RNF06)
r.post('/reservas', autenticar('consumidor'), a(async (req, res) => {
  const idPub = entero(req.body.id_publicacion);
  const cant = entero(req.body.cantidad ?? 1);
  if (!Number.isInteger(idPub)) throw new ErrorApp(400, 'Oferta no válida.');
  if (!Number.isInteger(cant) || cant < 1) throw new ErrorApp(400, 'La cantidad debe ser al menos 1.');
  await actualizarVencimientos();
  const reserva = await transaccion(async (c) => {
    const q = await c.query(
      `SELECT p.*, c.id_usuario AS id_usuario_comercio, c.razon_social
       FROM publicacion p JOIN comercio c ON c.id_comercio = p.id_comercio
       WHERE p.id_publicacion = $1 FOR UPDATE OF p`, [idPub]);
    const p = q.rows[0];
    if (!p) throw new ErrorApp(404, 'La oferta no existe.');
    if (p.estado !== 'activa' || new Date(p.hora_fin_recogida) <= new Date()) throw new ErrorApp(409, 'Esta oferta ya no está disponible.');
    if (cant > p.cantidad_disponible) {
      throw new ErrorApp(409, `Solo quedan ${p.cantidad_disponible} unidad(es) disponibles.`);
    }
    const quedan = p.cantidad_disponible - cant;
    await c.query(`UPDATE publicacion SET cantidad_disponible = $1, estado = $2 WHERE id_publicacion = $3`,
      [quedan, quedan === 0 ? 'agotada' : 'activa', idPub]);
    let ins;
    for (let i = 0; i < 5; i++) {
      try {
        ins = await c.query(
          `INSERT INTO reserva (id_publicacion, id_usuario, cantidad, codigo_recogida) VALUES ($1,$2,$3,$4) RETURNING *`,
          [idPub, req.usuario.id, cant, generarCodigo()]);
        break;
      } catch (e) {
        if (e.code !== '23505' || i === 4) throw e; // código repetido: se intenta con otro
      }
    }
    await notificar(p.id_usuario_comercio, `Nueva reserva: ${cant} × «${p.descripcion_producto}» (código ${ins.rows[0].codigo_recogida}).`, c);
    return { ...ins.rows[0], descripcion_producto: p.descripcion_producto, razon_social: p.razon_social,
      hora_inicio_recogida: p.hora_inicio_recogida, hora_fin_recogida: p.hora_fin_recogida, precio_oferta: p.precio_oferta };
  });
  res.status(201).json(reserva);
}));

r.get('/reservas', autenticar('consumidor'), a(async (req, res) => {
  await actualizarVencimientos();
  const q = await query(
    `SELECT r.*, p.descripcion_producto, p.precio_oferta, p.hora_inicio_recogida, p.hora_fin_recogida,
            c.razon_social, c.direccion, c.latitud, c.longitud, ca.puntaje
     FROM reserva r JOIN publicacion p ON p.id_publicacion = r.id_publicacion
     JOIN comercio c ON c.id_comercio = p.id_comercio
     LEFT JOIN calificacion ca ON ca.id_reserva = r.id_reserva
     WHERE r.id_usuario = $1 ORDER BY r.fecha_hora DESC`, [req.usuario.id]);
  res.json(q.rows);
}));

// RF08: cancelar y liberar unidades
r.patch('/reservas/:id/cancelar', autenticar('consumidor'), a(async (req, res) => {
  await actualizarVencimientos();
  const out = await transaccion(async (c) => {
    const q = await c.query(
      `SELECT r.*, p.cantidad_disponible, p.hora_fin_recogida, p.estado AS estado_pub, p.descripcion_producto, co.id_usuario AS id_usuario_comercio
       FROM reserva r JOIN publicacion p ON p.id_publicacion = r.id_publicacion
       JOIN comercio co ON co.id_comercio = p.id_comercio
       WHERE r.id_reserva = $1 AND r.id_usuario = $2 FOR UPDATE OF r, p`, [req.params.id, req.usuario.id]);
    const rsv = q.rows[0];
    if (!rsv) throw new ErrorApp(404, 'Reserva no encontrada.');
    if (rsv.estado !== 'activa') throw new ErrorApp(409, 'Solo se pueden cancelar reservas activas.');
    await c.query(`UPDATE reserva SET estado='cancelada' WHERE id_reserva=$1`, [rsv.id_reserva]);
    const reactivar = rsv.estado_pub === 'agotada' && new Date(rsv.hora_fin_recogida) > new Date();
    await c.query(`UPDATE publicacion SET cantidad_disponible = cantidad_disponible + $1,
                   estado = CASE WHEN $2 THEN 'activa' ELSE estado END WHERE id_publicacion = $3`,
      [rsv.cantidad, reactivar, rsv.id_publicacion]);
    await notificar(rsv.id_usuario_comercio, `Se canceló la reserva ${rsv.codigo_recogida} de «${rsv.descripcion_producto}».`, c);
    return { ok: true };
  });
  res.json(out);
}));

// RF10: calificar al comercio después de recoger
r.post('/calificaciones', autenticar('consumidor'), a(async (req, res) => {
  const idRes = entero(req.body.id_reserva);
  const puntaje = entero(req.body.puntaje);
  if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) throw new ErrorApp(400, 'El puntaje debe estar entre 1 y 5.');
  const q = await query('SELECT * FROM reserva WHERE id_reserva=$1 AND id_usuario=$2', [idRes, req.usuario.id]);
  const rsv = q.rows[0];
  if (!rsv) throw new ErrorApp(404, 'Reserva no encontrada.');
  if (rsv.estado !== 'retirada') throw new ErrorApp(409, 'Solo puede calificar después de recoger el producto.');
  const ya = await query('SELECT 1 FROM calificacion WHERE id_reserva=$1', [idRes]);
  if (ya.rowCount) throw new ErrorApp(409, 'Esta reserva ya fue calificada.');
  const ins = await query('INSERT INTO calificacion (id_reserva, puntaje, comentario) VALUES ($1,$2,$3) RETURNING *',
    [idRes, puntaje, (req.body.comentario || '').slice(0, 300) || null]);
  res.status(201).json(ins.rows[0]);
}));

// RF09: notificaciones dentro de la aplicación
r.get('/notificaciones', autenticar(), a(async (req, res) => {
  const q = await query('SELECT * FROM notificacion WHERE id_usuario=$1 ORDER BY fecha DESC LIMIT 30', [req.usuario.id]);
  res.json(q.rows);
}));

r.patch('/notificaciones/leer', autenticar(), a(async (req, res) => {
  await query('UPDATE notificacion SET leida=TRUE WHERE id_usuario=$1', [req.usuario.id]);
  res.json({ ok: true });
}));

export default r;
