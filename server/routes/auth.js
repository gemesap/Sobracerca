import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaccion } from '../db.js';
import { autenticar, firmarToken } from '../auth.js';
import { ErrorApp, requerido } from '../util.js';

export const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const r = Router();

// RF01: registro con aceptación obligatoria de la política de datos (Ley 1581 de 2012)
r.post('/registro', a(async (req, res) => {
  const { nombre, correo, telefono, password, rol, acepta_datos, razon_social, tipo } = req.body;
  requerido(req.body, ['nombre', 'correo', 'password', 'rol']);
  if (!['comercio', 'consumidor'].includes(rol)) throw new ErrorApp(400, 'Rol no válido.');
  if (acepta_datos !== true) throw new ErrorApp(400, 'Debe aceptar la política de tratamiento de datos para crear la cuenta.');
  if (String(password).length < 6) throw new ErrorApp(400, 'La contraseña debe tener al menos 6 caracteres.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new ErrorApp(400, 'El correo no es válido.');

  const existe = await query('SELECT 1 FROM usuario WHERE correo = $1', [correo.toLowerCase()]);
  if (existe.rowCount) throw new ErrorApp(409, 'Ya existe una cuenta con ese correo.');

  const hash = await bcrypt.hash(password, 10);
  const usuario = await transaccion(async (c) => {
    const u = await c.query(
      `INSERT INTO usuario (nombre, correo, telefono, password_hash, rol, acepta_tratamiento_datos)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id_usuario, nombre, correo, rol`,
      [nombre.trim(), correo.toLowerCase().trim(), telefono || null, hash, rol]);
    if (rol === 'comercio') {
      await c.query('INSERT INTO comercio (id_usuario, razon_social, tipo) VALUES ($1, $2, $3)',
        [u.rows[0].id_usuario, (razon_social || nombre).trim(), tipo || 'panaderia']);
    }
    return u.rows[0];
  });
  res.status(201).json({ token: firmarToken(usuario), usuario });
}));

r.post('/login', a(async (req, res) => {
  const { correo, password } = req.body;
  requerido(req.body, ['correo', 'password']);
  const q = await query('SELECT * FROM usuario WHERE correo = $1', [String(correo).toLowerCase().trim()]);
  const u = q.rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) throw new ErrorApp(401, 'Correo o contraseña incorrectos.');
  res.json({ token: firmarToken(u), usuario: { id_usuario: u.id_usuario, nombre: u.nombre, correo: u.correo, rol: u.rol } });
}));

r.get('/yo', autenticar(), a(async (req, res) => {
  const q = await query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.telefono, u.rol, c.id_comercio, c.validado
     FROM usuario u LEFT JOIN comercio c ON c.id_usuario = u.id_usuario WHERE u.id_usuario = $1`, [req.usuario.id]);
  if (!q.rowCount) throw new ErrorApp(404, 'Usuario no encontrado.');
  res.json(q.rows[0]);
}));

// RNF05: el titular puede eliminar su cuenta y sus datos
r.delete('/cuenta', autenticar('comercio', 'consumidor'), a(async (req, res) => {
  await query('DELETE FROM usuario WHERE id_usuario = $1', [req.usuario.id]);
  res.json({ ok: true });
}));

export default r;
