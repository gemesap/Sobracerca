import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import comercioRoutes from './routes/comercio.js';
import ofertasRoutes from './routes/ofertas.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/salud', (_req, res) => res.json({ ok: true, servicio: 'SobraCerca', hora: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/comercio', comercioRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', ofertasRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  // En producción el mismo servidor entrega la aplicación web (carpeta dist)
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Manejo centralizado de errores
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Ocurrió un error inesperado. Intente de nuevo.' : err.message });
  });
  return app;
}
