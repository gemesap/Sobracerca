# SobraCerca

Prototipo funcional del proyecto de grado **«SobraCerca: plataforma digital para el aprovechamiento de excedentes alimentarios en pequeños comercios de Bogotá D.C.»**, Ingeniería de Sistemas, Universidad Nacional Abierta y a Distancia (UNAD).

Autor: Gabriel Esteban Mesa Pineda · Curso Proyecto de Grado (202016907_109)

SobraCerca conecta a las panaderías, fruterías, cafeterías y restaurantes del barrio Marruecos con los vecinos que quieren comprar, a menor precio, la comida en buen estado que no se vendió en el día.

## Qué hace el prototipo

| Rol | Funciones |
|---|---|
| Comercio | Registro, perfil con ubicación en el mapa, publicar excedentes, ver reservas, confirmar entregas con código, resumen de lo recuperado, registro del cierre del día |
| Consumidor | Ver ofertas cercanas en lista y mapa, reservar, código de recogida, cancelar, calificar, compartir por WhatsApp |
| Administrador | Validar comercios, indicadores del piloto (tasa de retiro, tasa de descarte en línea base y piloto) |

## Tecnologías

- Frontend: React 18 + Vite, aplicación web progresiva (PWA), Leaflet + OpenStreetMap
- Backend: Node.js + Express (API REST), autenticación con JWT y contraseñas cifradas con bcrypt
- Base de datos: PostgreSQL
- Pruebas: `node:test` + Supertest (19 casos de prueba ligados a los requerimientos)

## Estructura

```
server/          API REST (Express) y esquema de base de datos
  routes/        auth, comercio, ofertas/reservas, admin
  schema.sql     tablas: usuario, comercio, publicacion, reserva, calificacion, registro_cierre, notificacion
  seed.js        datos de demostración (comercios ficticios)
client/          aplicación web (React)
tests/           pruebas automatizadas de la API
```

## Cómo ejecutarlo en el computador

Requisitos: Node.js 20 o superior y una base de datos PostgreSQL (local o gratuita en Neon).

```bash
npm install
# Windows (PowerShell):  $env:DATABASE_URL="postgresql://..."
# Linux / macOS:         export DATABASE_URL="postgresql://..."
npm run build      # compila la aplicación web
npm run seed       # (opcional) carga comercios de demostración
npm start          # abre http://localhost:3000
```

Cuentas de demostración (después de `npm run seed`): `espiga@demo.co`, `paisa@demo.co`, `rosa@demo.co` (comercios) y `vecino@demo.co` (consumidor), todas con la contraseña `demo123`. Administrador: `admin@sobracerca.co` con la clave definida en `ADMIN_PASSWORD` (por defecto `admin123`).

## Pruebas

```bash
DATABASE_URL=postgresql://.../base_de_pruebas npm test
```

> Las pruebas borran los datos de la base indicada; use una base distinta a la de producción.

## Despliegue

El repositorio incluye `render.yaml` para publicarlo en Render con una base de datos PostgreSQL de Neon. Variables necesarias: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Alcance y limitaciones

Es un producto mínimo viable: no incluye pagos en línea ni domicilios (el pago es en el local), las notificaciones son dentro de la aplicación y no se pueden subir fotos de los productos. Los comercios que aparecen con «(demo)» son ficticios y solo sirven para probar el funcionamiento.
