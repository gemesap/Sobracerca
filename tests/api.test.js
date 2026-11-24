// Pruebas automatizadas de la API de SobraCerca.
// Cada prueba indica el requerimiento (RF/RNF) que verifica.
// Uso: DATABASE_URL=postgres://.../sobracerca_test npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearApp } from '../server/app.js';
import { migrar, pool, query } from '../server/db.js';

const app = crearApp();
const api = () => request(app);
const tk = {};
let idComercio, idPub, reserva;

const hora = (h) => new Date(Date.now() + h * 3600e3).toISOString();

before(async () => {
  await migrar();
  await query('TRUNCATE usuario, comercio, publicacion, reserva, calificacion, registro_cierre, notificacion RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('admin123', 10);
  await query(`INSERT INTO usuario (nombre, correo, password_hash, rol, acepta_tratamiento_datos) VALUES ('Admin','admin@t.co',$1,'admin',TRUE)`, [hash]);
  tk.admin = (await api().post('/api/auth/login').send({ correo: 'admin@t.co', password: 'admin123' })).body.token;
});
after(async () => { await pool.end(); });

test('CP-01 (RF01, RNF05) no se crea una cuenta sin aceptar la política de datos', async () => {
  const r = await api().post('/api/auth/registro').send({ nombre: 'Ana', correo: 'ana@t.co', password: 'secreto1', rol: 'consumidor', acepta_datos: false });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /política/);
});

test('CP-02 (RF01) registro e inicio de sesión de comercio y consumidor', async () => {
  let r = await api().post('/api/auth/registro').send({ nombre: 'Panadería Prueba', correo: 'pan@t.co', password: 'secreto1', rol: 'comercio', acepta_datos: true, tipo: 'panaderia' });
  assert.equal(r.status, 201); tk.comercio = r.body.token;
  r = await api().post('/api/auth/registro').send({ nombre: 'Vecina Uno', correo: 'v1@t.co', password: 'secreto1', rol: 'consumidor', acepta_datos: true });
  assert.equal(r.status, 201); tk.v1 = r.body.token;
  r = await api().post('/api/auth/registro').send({ nombre: 'Vecino Dos', correo: 'v2@t.co', password: 'secreto1', rol: 'consumidor', acepta_datos: true });
  tk.v2 = r.body.token;
  r = await api().post('/api/auth/login').send({ correo: 'pan@t.co', password: 'mala' });
  assert.equal(r.status, 401);
});

test('CP-03 (RNF04) las contraseñas se guardan cifradas y las rutas exigen el rol correcto', async () => {
  const q = await query(`SELECT password_hash FROM usuario WHERE correo='pan@t.co'`);
  assert.notEqual(q.rows[0].password_hash, 'secreto1');
  assert.match(q.rows[0].password_hash, /^\$2[aby]\$/);
  assert.equal((await api().get('/api/admin/indicadores').set('Authorization', `Bearer ${tk.v1}`)).status, 403);
  assert.equal((await api().get('/api/comercio/perfil')).status, 401);
});

test('CP-04 (RF02) el comercio completa su perfil con ubicación', async () => {
  const r = await api().put('/api/comercio/perfil').set('Authorization', `Bearer ${tk.comercio}`)
    .send({ razon_social: 'Panadería Prueba', tipo: 'panaderia', direccion: 'Calle 49 Sur # 5-20', latitud: 4.5592, longitud: -74.1188, horario: '6 a 9' });
  assert.equal(r.status, 200);
  idComercio = r.body.id_comercio;
});

test('CP-05 (RF12) un comercio sin validar no puede publicar; el administrador lo valida', async () => {
  const datos = { descripcion_producto: 'Pan del día x6', cantidad: 5, precio_original: 6000, precio_oferta: 3000, hora_inicio_recogida: hora(0), hora_fin_recogida: hora(2) };
  let r = await api().post('/api/comercio/publicaciones').set('Authorization', `Bearer ${tk.comercio}`).send(datos);
  assert.equal(r.status, 403);
  r = await api().patch(`/api/admin/comercios/${idComercio}/validar`).set('Authorization', `Bearer ${tk.admin}`).send({ validado: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.validado, true);
});

test('CP-06 (RF03) validaciones del formulario de publicación', async () => {
  const base = { descripcion_producto: 'Pan', cantidad: 5, precio_original: 6000, precio_oferta: 3000, hora_inicio_recogida: hora(0), hora_fin_recogida: hora(2) };
  const casos = [
    [{ ...base, precio_oferta: 7000 }, /menor/],
    [{ ...base, cantidad: 0 }, /cantidad/],
    [{ ...base, hora_fin_recogida: hora(-1) }, /posterior|pasó/],
    [{ ...base, descripcion_producto: '' }, /obligatorio/],
  ];
  for (const [datos, msg] of casos) {
    const r = await api().post('/api/comercio/publicaciones').set('Authorization', `Bearer ${tk.comercio}`).send(datos);
    assert.equal(r.status, 400); assert.match(r.body.error, msg);
  }
});

test('CP-07 (RF03) el comercio publica un excedente válido', async () => {
  const r = await api().post('/api/comercio/publicaciones').set('Authorization', `Bearer ${tk.comercio}`)
    .send({ descripcion_producto: 'Bolsa de pan del día (6 unidades)', cantidad: 5, precio_original: 6000, precio_oferta: 3000, hora_inicio_recogida: hora(0), hora_fin_recogida: hora(2) });
  assert.equal(r.status, 201);
  assert.equal(r.body.cantidad_disponible, 5);
  idPub = r.body.id_publicacion;
});

test('CP-08 (RF05) las ofertas vigentes se listan ordenadas por distancia', async () => {
  // segundo comercio más lejano
  const r0 = await api().post('/api/auth/registro').send({ nombre: 'Frutería Lejana', correo: 'fru@t.co', password: 'secreto1', rol: 'comercio', acepta_datos: true, tipo: 'fruteria' });
  const t2 = r0.body.token;
  const p = await api().put('/api/comercio/perfil').set('Authorization', `Bearer ${t2}`).send({ razon_social: 'Frutería Lejana', tipo: 'fruteria', direccion: 'Lejos', latitud: 4.5700, longitud: -74.1000 });
  await api().patch(`/api/admin/comercios/${p.body.id_comercio}/validar`).set('Authorization', `Bearer ${tk.admin}`).send({ validado: true });
  await api().post('/api/comercio/publicaciones').set('Authorization', `Bearer ${t2}`).send({ descripcion_producto: 'Mango maduro', cantidad: 3, precio_original: 5000, precio_oferta: 2500, hora_inicio_recogida: hora(0), hora_fin_recogida: hora(1) });
  const r = await api().get('/api/ofertas?lat=4.5590&lng=-74.1190');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 2);
  assert.equal(r.body[0].razon_social, 'Panadería Prueba');
  assert.ok(r.body[0].distancia_m < r.body[1].distancia_m);
});

test('CP-09 (RF06, RF09) reservar descuenta unidades, genera código y notifica al comercio', async () => {
  const r = await api().post('/api/reservas').set('Authorization', `Bearer ${tk.v1}`).send({ id_publicacion: idPub, cantidad: 2 });
  assert.equal(r.status, 201);
  assert.match(r.body.codigo_recogida, /^SC-\d{4}$/);
  reserva = r.body;
  const o = await api().get(`/api/ofertas/${idPub}`);
  assert.equal(o.body.cantidad_disponible, 3);
  const n = await api().get('/api/notificaciones').set('Authorization', `Bearer ${tk.comercio}`);
  assert.ok(n.body.some((x) => x.mensaje.includes(reserva.codigo_recogida)));
});

test('CP-10 (RNF06) reservas simultáneas no superan la cantidad publicada', async () => {
  // quedan 3 unidades; 5 solicitudes de 1 unidad al mismo tiempo
  const tokens = [];
  for (let i = 0; i < 5; i++) {
    const r = await api().post('/api/auth/registro').send({ nombre: `Vecino ${i}`, correo: `c${i}@t.co`, password: 'secreto1', rol: 'consumidor', acepta_datos: true });
    tokens.push(r.body.token);
  }
  const res = await Promise.all(tokens.map((t) => api().post('/api/reservas').set('Authorization', `Bearer ${t}`).send({ id_publicacion: idPub, cantidad: 1 })));
  assert.equal(res.filter((r) => r.status === 201).length, 3);
  assert.equal(res.filter((r) => r.status === 409).length, 2);
  const o = await api().get(`/api/ofertas/${idPub}`);
  assert.equal(o.body.cantidad_disponible, 0);
  assert.equal(o.body.estado, 'agotada');
});

test('CP-11 (RF04) una oferta agotada no aparece en la lista', async () => {
  const r = await api().get('/api/ofertas');
  assert.ok(!r.body.some((o) => o.id_publicacion === idPub));
});

test('CP-12 (RF08) cancelar libera las unidades y reactiva la oferta', async () => {
  const mias = await api().get('/api/reservas').set('Authorization', `Bearer ${tk.v1}`);
  // se crea y cancela una reserva adicional para conservar la reserva principal
  const r = await api().patch(`/api/reservas/${mias.body[0].id_reserva}/cancelar`).set('Authorization', `Bearer ${tk.v1}`);
  assert.equal(r.status, 200);
  const o = await api().get(`/api/ofertas/${idPub}`);
  assert.equal(o.body.cantidad_disponible, 2);
  assert.equal(o.body.estado, 'activa');
  const r2 = await api().patch(`/api/reservas/${mias.body[0].id_reserva}/cancelar`).set('Authorization', `Bearer ${tk.v1}`);
  assert.equal(r2.status, 409);
  // nueva reserva para continuar el flujo
  const n = await api().post('/api/reservas').set('Authorization', `Bearer ${tk.v1}`).send({ id_publicacion: idPub, cantidad: 2 });
  assert.equal(n.status, 201);
  reserva = n.body;
});

test('CP-13 (RF07) el comercio confirma la entrega con el código; un código inválido se rechaza', async () => {
  let r = await api().post('/api/comercio/entregas').set('Authorization', `Bearer ${tk.comercio}`).send({ codigo: 'SC-0000' });
  assert.equal(r.status, 404);
  r = await api().post('/api/comercio/entregas').set('Authorization', `Bearer ${tk.comercio}`).send({ codigo: reserva.codigo_recogida.toLowerCase() });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'retirada');
  r = await api().post('/api/comercio/entregas').set('Authorization', `Bearer ${tk.comercio}`).send({ codigo: reserva.codigo_recogida });
  assert.equal(r.status, 409);
});

test('CP-14 (RF10) solo se califica una reserva recogida y una sola vez', async () => {
  let r = await api().post('/api/calificaciones').set('Authorization', `Bearer ${tk.v1}`).send({ id_reserva: reserva.id_reserva, puntaje: 5, comentario: 'Pan muy fresco' });
  assert.equal(r.status, 201);
  r = await api().post('/api/calificaciones').set('Authorization', `Bearer ${tk.v1}`).send({ id_reserva: reserva.id_reserva, puntaje: 4 });
  assert.equal(r.status, 409);
  r = await api().post('/api/calificaciones').set('Authorization', `Bearer ${tk.v2}`).send({ id_reserva: reserva.id_reserva, puntaje: 4 });
  assert.equal(r.status, 404);
});

test('CP-15 (RF11) el resumen del comercio refleja lo publicado, reservado, retirado y el valor recuperado', async () => {
  const r = await api().get('/api/comercio/resumen').set('Authorization', `Bearer ${tk.comercio}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.publicadas, 5);
  assert.equal(r.body.retiradas, 2);
  assert.equal(r.body.valor_recuperado, 6000);
  assert.equal(Number(r.body.calificacion_promedio), 5);
});

test('CP-16 (RF04) una publicación vencida se desactiva y sus reservas activas pasan a vencidas', async () => {
  await query(`UPDATE publicacion SET hora_inicio_recogida = now() - interval '3 hours', hora_fin_recogida = now() - interval '1 minute' WHERE id_publicacion=$1`, [idPub]);
  const r = await api().get('/api/ofertas');
  assert.ok(!r.body.some((o) => o.id_publicacion === idPub));
  const q = await query(`SELECT estado FROM publicacion WHERE id_publicacion=$1`, [idPub]);
  assert.equal(q.rows[0].estado, 'vencida');
  const act = await query(`SELECT COUNT(*)::int n FROM reserva WHERE id_publicacion=$1 AND estado='activa'`, [idPub]);
  assert.equal(act.rows[0].n, 0);
});

test('CP-17 (Indicadores, Tabla 10) registro de cierre y cálculo de la tasa de descarte por fase', async () => {
  let r = await api().post('/api/comercio/cierres').set('Authorization', `Bearer ${tk.comercio}`)
    .send({ fecha: '2026-11-02', fase: 'linea_base', unidades_sobrantes: 10, vendidas_fuera_app: 2, regaladas: 2, descartadas: 6 });
  assert.equal(r.status, 201);
  r = await api().post('/api/comercio/cierres').set('Authorization', `Bearer ${tk.comercio}`)
    .send({ fecha: '2026-11-16', fase: 'piloto', unidades_sobrantes: 10, vendidas_fuera_app: 1, regaladas: 1, descartadas: 9 });
  assert.equal(r.status, 400); // la suma supera lo sobrante
  r = await api().post('/api/comercio/cierres').set('Authorization', `Bearer ${tk.comercio}`)
    .send({ fecha: '2026-11-16', fase: 'piloto', unidades_sobrantes: 10, vendidas_fuera_app: 1, regaladas: 1, descartadas: 3 });
  assert.equal(r.status, 201);
  const ind = await api().get('/api/admin/indicadores').set('Authorization', `Bearer ${tk.admin}`);
  assert.equal(ind.body.linea_base.tasa_descarte, 60);
  assert.equal(ind.body.piloto.tasa_descarte, 30);
  assert.equal(ind.body.unidades_retiradas, 2);
});

test('CP-18 (RNF03) la consulta de ofertas responde en menos de 2 segundos', async () => {
  const t0 = performance.now();
  const r = await api().get('/api/ofertas');
  const ms = performance.now() - t0;
  assert.equal(r.status, 200);
  assert.ok(ms < 2000, `tardó ${ms} ms`);
});

test('CP-19 (RNF05) el usuario puede eliminar su cuenta', async () => {
  const r = await api().delete('/api/auth/cuenta').set('Authorization', `Bearer ${tk.v2}`);
  assert.equal(r.status, 200);
  const q = await query(`SELECT 1 FROM usuario WHERE correo='v2@t.co'`);
  assert.equal(q.rowCount, 0);
});
