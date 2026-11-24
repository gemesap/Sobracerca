import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// En la nube (Neon, Render) la conexión exige SSL; en local no.
function crearPool(url) {
  const local = /localhost|127\.0\.0\.1/.test(url || '');
  return new pg.Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 10,
  });
}

export const pool = crearPool(process.env.DATABASE_URL);

export const query = (texto, params) => pool.query(texto, params);

// Ejecuta una función dentro de una transacción
export async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const r = await fn(cliente);
    await cliente.query('COMMIT');
    return r;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

export async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
