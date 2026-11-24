-- Esquema de base de datos de SobraCerca (PostgreSQL)
-- Se ejecuta al iniciar el servidor; es idempotente.

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario      SERIAL PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  correo          VARCHAR(160) NOT NULL UNIQUE,
  telefono        VARCHAR(20),
  password_hash   VARCHAR(100) NOT NULL,
  rol             VARCHAR(12)  NOT NULL CHECK (rol IN ('comercio','consumidor','admin')),
  acepta_tratamiento_datos BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_registro  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comercio (
  id_comercio   SERIAL PRIMARY KEY,
  id_usuario    INTEGER NOT NULL UNIQUE REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  razon_social  VARCHAR(120) NOT NULL,
  tipo          VARCHAR(30)  NOT NULL DEFAULT 'panaderia',
  direccion     VARCHAR(160),
  latitud       DOUBLE PRECISION,
  longitud      DOUBLE PRECISION,
  horario       VARCHAR(80),
  validado      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS publicacion (
  id_publicacion      SERIAL PRIMARY KEY,
  id_comercio         INTEGER NOT NULL REFERENCES comercio(id_comercio) ON DELETE CASCADE,
  descripcion_producto VARCHAR(160) NOT NULL,
  cantidad_publicada  INTEGER NOT NULL CHECK (cantidad_publicada > 0),
  cantidad_disponible INTEGER NOT NULL CHECK (cantidad_disponible >= 0),
  precio_original     INTEGER NOT NULL CHECK (precio_original > 0),
  precio_oferta       INTEGER NOT NULL CHECK (precio_oferta > 0),
  hora_inicio_recogida TIMESTAMPTZ NOT NULL,
  hora_fin_recogida   TIMESTAMPTZ NOT NULL,
  estado              VARCHAR(12) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','agotada','vencida','cerrada')),
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reserva (
  id_reserva      SERIAL PRIMARY KEY,
  id_publicacion  INTEGER NOT NULL REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
  id_usuario      INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  codigo_recogida VARCHAR(10) NOT NULL UNIQUE,
  estado          VARCHAR(12) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','retirada','cancelada','vencida')),
  fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_entrega   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calificacion (
  id_calificacion SERIAL PRIMARY KEY,
  id_reserva      INTEGER NOT NULL UNIQUE REFERENCES reserva(id_reserva) ON DELETE CASCADE,
  puntaje         INTEGER NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
  comentario      VARCHAR(300),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registro diario de excedentes (Anexo D del documento): línea base y piloto
CREATE TABLE IF NOT EXISTS registro_cierre (
  id_registro     SERIAL PRIMARY KEY,
  id_comercio     INTEGER NOT NULL REFERENCES comercio(id_comercio) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  fase            VARCHAR(12) NOT NULL CHECK (fase IN ('linea_base','piloto')),
  unidades_sobrantes   INTEGER NOT NULL CHECK (unidades_sobrantes >= 0),
  vendidas_fuera_app   INTEGER NOT NULL DEFAULT 0 CHECK (vendidas_fuera_app >= 0),
  regaladas            INTEGER NOT NULL DEFAULT 0 CHECK (regaladas >= 0),
  descartadas          INTEGER NOT NULL DEFAULT 0 CHECK (descartadas >= 0),
  UNIQUE (id_comercio, fecha)
);

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion SERIAL PRIMARY KEY,
  id_usuario      INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  mensaje         VARCHAR(250) NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publicacion_estado ON publicacion(estado, hora_fin_recogida);
CREATE INDEX IF NOT EXISTS idx_reserva_usuario ON reserva(id_usuario);
