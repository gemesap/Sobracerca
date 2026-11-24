import { Router } from 'express';
import { query, transaccion } from '../db.js';
import { autenticar } from '../auth.js';
import { ErrorApp, actualizarVencimientos, entero, notificar, requerido } from '../util.js';
import { a } from './auth.js';

const r = Router();
r.use(autenticar('comercio'));

async function miComercio(idUsuario) {
  const q = await query('SELECT * FROM comercio WHERE id_usuario = $1', [idUsuario]);
  if (!q.rowCount) throw new ErrorApp(404, 'No se encontró el perfil del comercio.');
  return q.rows[0];
}

// RF02: perfil del comercio
r.get('/perfil', a(async (req, res) => res.json(await miComercio(req.usuario.id))));

r.put('/perfil', a(async (req, res) => {
  const c = await miComercio(req.usuario.id);
  const { razon_social, tipo, direccion, latitud, longitud, horario } = req.body;
  requerido(req.body, ['razon_social', 'tipo', 'direccion']);
  const lat = entero(latitud), lng = entero(longitud);
  if (Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ErrorApp(400, 'Marque la ubicación del comercio en el mapa.');
  }
  const q = await query(
    `UPDATE comercio SET razon_social=$1, tipo=$2, direccion=$3, latitud=$4, longitud=$5, horario=$6
     WHERE id_comercio=$7 RETURNING *`, [razon_social, tipo, direccion, lat, lng, horario || null, c.id_comercio]);
  res.json(q.rows[0]);
}));

// RF03: publicar excedente
r.post('/publicaciones', a(async (req, res) => {
  const c = await miComercio(req.usuario.id);
  if (!c.validado) throw new ErrorApp(403, 'Su comercio aún no ha sido validado por el administrador.');
  if (c.latitud === null) throw new ErrorApp(400, 'Complete la ubicación del comercio antes de publicar.');
  const { descripcion_producto, cantidad, precio_original, precio_oferta, hora_inicio_recogida, hora_fin_recogida } = req.body;
  requerido(req.body, ['descripcion_producto', 'cantidad', 'precio_original', 'precio_oferta', 'hora_inicio_recogida', 'hora_fin_recogida']);
  const cant = entero(cantidad), po = entero(precio_original), pf = entero(precio_oferta);
  if (!Number.isInteger(cant) || cant < 1 || cant > 500) throw new ErrorApp(400, 'La cantidad debe ser un número entero entre 1 y 500.');
  if (!(po > 0) || !(pf > 0)) throw new ErrorApp(400, 'Los precios deben ser mayores que cero.');
  if (pf >= po) throw new ErrorApp(400, 'El precio de oferta debe ser menor que el precio normal.');
  const ini = new Date(hora_inicio_recogida), fin = new Date(hora_fin_recogida);
  if (isNaN(ini) || isNaN(fin)) throw new ErrorApp(400, 'Las horas de recogida no son válidas.');
  if (fin <= ini) throw new ErrorApp(400, 'La hora final de recogida debe ser posterior a la inicial.');
  if (fin <= new Date()) throw new ErrorApp(400, 'La hora final de recogida ya pasó.');
  const q = await query(
    `INSERT INTO publicacion (id_comercio, descripcion_producto, cantidad_publicada, cantidad_disponible,
       precio_original, precio_oferta, hora_inicio_recogida, hora_fin_recogida)
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7) RETURNING *`,
    [c.id_comercio, String(descripcion_producto).trim(), cant, po, pf, ini, fin]);
  res.status(201).json(q.rows[0]);
}));

r.get('/publicaciones', a(async (req, res) => {
  await actualizarVencimientos();
  const c = await miComercio(req.usuario.id);
  const q = await query(
    `SELECT p.*, COALESCE(SUM(r.cantidad) FILTER (WHERE r.estado='retirada'),0)::int AS retiradas
     FROM publicacion p LEFT JOIN reserva r ON r.id_publicacion = p.id_publicacion
     WHERE p.id_comercio = $1 GROUP BY p.id_publicacion ORDER BY p.fecha_creacion DESC LIMIT 50`, [c.id_comercio]);
  res.json(q.rows);
}));

r.patch('/publicaciones/:id/cerrar', a(async (req, res) => {
  const c = await miComercio(req.usuario.id);
  const q = await query(`UPDATE publicacion SET estado='cerrada'
     WHERE id_publicacion=$1 AND id_comercio=$2 AND estado IN ('activa','agotada') RETURNING *`, [req.params.id, c.id_comercio]);
  if (!q.rowCount) throw new ErrorApp(404, 'Publicación no encontrada o ya cerrada.');
  res.json(q.rows[0]);
}));

// Reservas recibidas por el comercio
r.get('/reservas', a(async (req, res) => {
  await actualizarVencimientos();
  const c = await miComercio(req.usuario.id);
  const q = await query(
    `SELECT r.id_reserva, r.cantidad, r.codigo_recogida, r.estado, r.fecha_hora, r.fecha_entrega,
            p.descripcion_producto, p.hora_fin_recogida, u.nombre AS cliente
     FROM reserva r JOIN publicacion p ON p.id_publicacion = r.id_publicacion
     JOIN usuario u ON u.id_usuario = r.id_usuario
     WHERE p.id_comercio = $1 ORDER BY r.fecha_hora DESC LIMIT 100`, [c.id_comercio]);
  res.json(q.rows);
}));

// RF07: confirmar entrega con el código de recogida
r.post('/entregas', a(async (req, res) => {
  const c = await miComercio(req.usuario.id);
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  if (!codigo) throw new ErrorApp(400, 'Ingrese el código de recogida.');
  await actualizarVencimientos();
  const out = await transaccion(async (cl) => {
    const q = await cl.query(
      `SELECT r.*, p.descripcion_producto FROM reserva r JOIN publicacion p ON p.id_publicacion = r.id_publicacion
       WHERE r.codigo_recogida = $1 AND p.id_comercio = $2 FOR UPDATE OF r`, [codigo, c.id_comercio]);
    const rsv = q.rows[0];
    if (!rsv) throw new ErrorApp(404, 'No hay una reserva con ese código en su comercio.');
    if (rsv.estado !== 'activa') throw new ErrorApp(409, `La reserva está ${rsv.estado}; no se puede entregar.`);
    const u = await cl.query(`UPDATE reserva SET estado='retirada', fecha_entrega=now() WHERE id_reserva=$1 RETURNING *`, [rsv.id_reserva]);
    await notificar(rsv.id_usuario, `Recogiste «${rsv.descripcion_producto}» en ${c.razon_social}. ¡Gracias! Puedes calificar tu experiencia.`, cl);
    return u.rows[0];
  });
  res.json(out);
}));

// RF11: resumen de aprovechamiento del comercio
r.get('/resumen', a(async (req, res) => {
  await actualizarVencimientos();
  const c = await miComercio(req.usuario.id);
  const q = await query(
    `SELECT
       COALESCE((SELECT SUM(cantidad_publicada) FROM publicacion WHERE id_comercio=$1),0)::int AS publicadas,
       COALESCE(SUM(r.cantidad) FILTER (WHERE r.estado IN ('activa','retirada','vencida')),0)::int AS reservadas,
       COALESCE(SUM(r.cantidad) FILTER (WHERE r.estado='retirada'),0)::int AS retiradas,
       COALESCE(SUM(r.cantidad * p.precio_oferta) FILTER (WHERE r.estado='retirada'),0)::int AS valor_recuperado,
       (SELECT ROUND(AVG(ca.puntaje)::numeric,1) FROM calificacion ca JOIN reserva r2 ON r2.id_reserva=ca.id_reserva
          JOIN publicacion p2 ON p2.id_publicacion=r2.id_publicacion WHERE p2.id_comercio=$1) AS calificacion_promedio
     FROM publicacion p LEFT JOIN reserva r ON r.id_publicacion = p.id_publicacion
     WHERE p.id_comercio = $1`, [c.id_comercio]);
  res.json({ ...q.rows[0], validado: c.validado, razon_social: c.razon_social });
}));

// Registro diario de excedentes (línea base y piloto)
r.post('/cierres', a(async (req, res) => {
  const c = await miComercio(req.usuario.id);
  const { fecha, fase } = req.body;
  requerido(req.body, ['fecha', 'fase', 'unidades_sobrantes']);
  if (!['linea_base', 'piloto'].includes(fase)) throw new ErrorApp(400, 'Fase no válida.');
  const [s, v, g, d] = ['unidades_sobrantes', 'vendidas_fuera_app', 'regaladas', 'descartadas'].map((k) => entero(req.body[k] ?? 0));
  if ([s, v, g, d].some((n) => !Number.isInteger(n) || n < 0)) throw new ErrorApp(400, 'Las cantidades deben ser números enteros iguales o mayores que cero.');
  if (v + g + d > s) throw new ErrorApp(400, 'Lo vendido, regalado y descartado no puede superar las unidades sobrantes.');
  const q = await query(
    `INSERT INTO registro_cierre (id_comercio, fecha, fase, unidades_sobrantes, vendidas_fuera_app, regaladas, descartadas)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id_comercio, fecha) DO UPDATE SET fase=EXCLUDED.fase, unidades_sobrantes=EXCLUDED.unidades_sobrantes,
       vendidas_fuera_app=EXCLUDED.vendidas_fuera_app, regaladas=EXCLUDED.regaladas, descartadas=EXCLUDED.descartadas
     RETURNING *`, [c.id_comercio, fecha, fase, s, v, g, d]);
  res.status(201).json(q.rows[0]);
}));

r.get('/cierres', a(async (req, res) => {
  const c = await miComercio(req.usuario.id);
  const q = await query('SELECT * FROM registro_cierre WHERE id_comercio=$1 ORDER BY fecha DESC LIMIT 60', [c.id_comercio]);
  res.json(q.rows);
}));

export default r;
