import bcrypt from 'bcryptjs';
import { crearApp } from './app.js';
import { migrar, query } from './db.js';

if (!process.env.DATABASE_URL) {
  console.error('Falta la variable DATABASE_URL. Revise el archivo README.md.');
  process.exit(1);
}

await migrar();

// Crea la cuenta de administrador la primera vez
const adminCorreo = (process.env.ADMIN_EMAIL || 'admin@sobracerca.co').toLowerCase();
const existe = await query('SELECT 1 FROM usuario WHERE correo=$1', [adminCorreo]);
if (!existe.rowCount) {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  await query(`INSERT INTO usuario (nombre, correo, password_hash, rol, acepta_tratamiento_datos)
               VALUES ('Administrador', $1, $2, 'admin', TRUE)`, [adminCorreo, hash]);
  console.log(`Cuenta de administrador creada: ${adminCorreo}`);
}

const PORT = process.env.PORT || 3000;
crearApp().listen(PORT, () => console.log(`SobraCerca escuchando en http://localhost:${PORT}`));
