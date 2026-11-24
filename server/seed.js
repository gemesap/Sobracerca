// Datos de DEMOSTRACIÓN para probar el prototipo (comercios ficticios).
// Uso: npm run seed   (requiere DATABASE_URL)
import bcrypt from 'bcryptjs';
import { migrar, pool, query } from './db.js';

await migrar();
const hash = await bcrypt.hash('demo123', 10);

async function usuario(nombre, correo, rol, telefono) {
  const q = await query(
    `INSERT INTO usuario (nombre, correo, telefono, password_hash, rol, acepta_tratamiento_datos)
     VALUES ($1,$2,$3,$4,$5,TRUE) ON CONFLICT (correo) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id_usuario`,
    [nombre, correo, telefono, hash, rol]);
  return q.rows[0].id_usuario;
}

const comercios = [
  { nombre: 'Panadería La Espiga (demo)', correo: 'espiga@demo.co', tipo: 'panaderia', dir: 'Calle 49 Sur # 5-20', lat: 4.5592, lng: -74.1188,
    pubs: [['Bolsa de pan del día (6 unidades)', 5, 6000, 3000], ['Roscones de arequipe x2', 4, 5000, 2500]] },
  { nombre: 'Frutería El Paisa (demo)', correo: 'paisa@demo.co', tipo: 'fruteria', dir: 'Carrera 5M # 48T-10 Sur', lat: 4.5571, lng: -74.1210,
    pubs: [['Combo de banano y mango maduro (1 kg)', 6, 5000, 2500]] },
  { nombre: 'Cafetería Doña Rosa (demo)', correo: 'rosa@demo.co', tipo: 'cafeteria', dir: 'Calle 48 Sur # 6-15', lat: 4.5603, lng: -74.1169,
    pubs: [['Almuerzo casero del día', 3, 12000, 6000]] },
];

const ahora = Date.now();
for (const c of comercios) {
  const idU = await usuario(c.nombre, c.correo, 'comercio', '3000000000');
  const q = await query(
    `INSERT INTO comercio (id_usuario, razon_social, tipo, direccion, latitud, longitud, horario, validado)
     VALUES ($1,$2,$3,$4,$5,$6,'6:00 a. m. – 9:00 p. m.',TRUE)
     ON CONFLICT (id_usuario) DO UPDATE SET validado=TRUE RETURNING id_comercio`,
    [idU, c.nombre, c.tipo, c.dir, c.lat, c.lng]);
  for (const [desc, cant, po, pf] of c.pubs) {
    await query(
      `INSERT INTO publicacion (id_comercio, descripcion_producto, cantidad_publicada, cantidad_disponible, precio_original, precio_oferta,
         hora_inicio_recogida, hora_fin_recogida) VALUES ($1,$2,$3,$3,$4,$5,$6,$7)`,
      [q.rows[0].id_comercio, desc, cant, po, pf, new Date(ahora), new Date(ahora + 3 * 3600e3)]);
  }
}
await usuario('Vecino de prueba (demo)', 'vecino@demo.co', 'consumidor', '3010000000');
console.log('Datos de demostración cargados. Contraseña de todas las cuentas demo: demo123');
await pool.end();
