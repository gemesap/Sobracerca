import { Router } from 'express';
import { query } from '../db.js';
import { autenticar } from '../auth.js';
import { ErrorApp, actualizarVencimientos, notificar } from '../util.js';
import { a } from './auth.js';

const r = Router();
r.use(autenticar('admin'));

// RF12: validar comercios
r.get('/comercios', a(async (_req, res) => {
  const q = await query(
    `SELECT c.*, u.nombre, u.correo, u.telefono, u.fecha_registro FROM comercio c
     JOIN usuario u ON u.id_usuario = c.id_usuario ORDER BY c.validado, u.fecha_registro DESC`);
  res.json(q.rows);
}));

r.patch('/comercios/:id/validar', a(async (req, res) => {
  const validado = req.body.validado !== false;
  const q = await query('UPDATE comercio SET validado=$1 WHERE id_comercio=$2 RETURNING *', [validado, req.params.id]);
  if (!q.rowCount) throw new ErrorApp(404, 'Comercio no encontrado.');
  await notificar(q.rows[0].id_usuario, validado
    ? 'Tu comercio fue validado. Ya puedes publicar excedentes.'
    : 'La validación de tu comercio fue retirada. Comunícate con el administrador.');
  res.json(q.rows[0]);
}));

// Indicadores del piloto (Tabla 10 del documento maestro)
r.get('/indicadores', a(async (_req, res) => {
  await actualizarVencimientos();
  const plataforma = (await query(`
    SELECT
      (SELECT COUNT(*) FROM usuario WHERE rol='consumidor')::int AS consumidores,
      (SELECT COUNT(*) FROM comercio)::int AS comercios,
      (SELECT COUNT(*) FROM comercio WHERE validado)::int AS comercios_validados,
      (SELECT COALESCE(SUM(cantidad_publicada),0) FROM publicacion)::int AS unidades_publicadas,
      (SELECT COALESCE(SUM(cantidad),0) FROM reserva WHERE estado IN ('activa','retirada','vencida'))::int AS unidades_reservadas,
      (SELECT COALESCE(SUM(cantidad),0) FROM reserva WHERE estado='retirada')::int AS unidades_retiradas,
      (SELECT COALESCE(SUM(r.cantidad*p.precio_oferta),0) FROM reserva r JOIN publicacion p ON p.id_publicacion=r.id_publicacion WHERE r.estado='retirada')::int AS valor_recuperado,
      (SELECT ROUND(AVG(puntaje)::numeric,2) FROM calificacion) AS calificacion_promedio`)).rows[0];
  const cierres = (await query(`
    SELECT fase, COUNT(*)::int AS dias, SUM(unidades_sobrantes)::int AS sobrantes, SUM(descartadas)::int AS descartadas
    FROM registro_cierre GROUP BY fase`)).rows;
  const fase = (f) => cierres.find((c) => c.fase === f) || { dias: 0, sobrantes: 0, descartadas: 0 };
  const tasa = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
  const lb = fase('linea_base'), pi = fase('piloto');
  res.json({
    ...plataforma,
    tasa_retiro: tasa(plataforma.unidades_retiradas, plataforma.unidades_publicadas),
    linea_base: { ...lb, tasa_descarte: tasa(lb.descartadas, lb.sobrantes) },
    piloto: { ...pi, tasa_descarte: tasa(pi.descartadas, pi.sobrantes) },
  });
}));

export default r;
