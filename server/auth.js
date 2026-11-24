import jwt from 'jsonwebtoken';
import { ErrorApp } from './util.js';

const SECRETO = process.env.JWT_SECRET || 'cambiar-este-secreto-en-produccion';

export function firmarToken(usuario) {
  return jwt.sign({ id: usuario.id_usuario, rol: usuario.rol, nombre: usuario.nombre }, SECRETO, { expiresIn: '7d' });
}

// Verifica el token y, si se indican roles, que el usuario tenga uno de ellos
export function autenticar(...roles) {
  return (req, _res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return next(new ErrorApp(401, 'Debe iniciar sesión.'));
    try {
      req.usuario = jwt.verify(token, SECRETO);
    } catch {
      return next(new ErrorApp(401, 'La sesión expiró. Ingrese de nuevo.'));
    }
    if (roles.length && !roles.includes(req.usuario.rol)) {
      return next(new ErrorApp(403, 'No tiene permiso para esta acción.'));
    }
    next();
  };
}
