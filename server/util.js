import crypto from 'node:crypto';
import { query } from './db.js';

export class ErrorApp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

// Distancia en metros entre dos puntos (fórmula de Haversine)
export function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Código de recogida corto y fácil de dictar, p. ej. SC-4827
export function generarCodigo() {
  return 'SC-' + crypto.randomInt(1000, 10000);
}

// RF04: desactiva publicaciones vencidas y marca como vencidas las reservas no recogidas
export async function actualizarVencimientos() {
  await query(`UPDATE reserva r SET estado = 'vencida'
               FROM publicacion p
               WHERE r.id_publicacion = p.id_publicacion
                 AND r.estado = 'activa' AND p.hora_fin_recogida < now()`);
  await query(`UPDATE publicacion SET estado = 'vencida'
               WHERE estado IN ('activa','agotada') AND hora_fin_recogida < now()`);
}

export async function notificar(idUsuario, mensaje, cliente) {
  const q = cliente ? cliente.query.bind(cliente) : query;
  await q('INSERT INTO notificacion (id_usuario, mensaje) VALUES ($1, $2)', [idUsuario, mensaje]);
}

export const entero = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

export function requerido(obj, campos) {
  for (const c of campos) {
    if (obj[c] === undefined || obj[c] === null || String(obj[c]).trim() === '') {
      throw new ErrorApp(400, `El campo «${c}» es obligatorio.`);
    }
  }
}
