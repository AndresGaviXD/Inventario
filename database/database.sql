DROP TABLE IF EXISTS movimientos, productos, usuarios CASCADE;


CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE productos (
    id           SERIAL PRIMARY KEY,
    codigo       VARCHAR(30)  NOT NULL UNIQUE,
    nombre       VARCHAR(150) NOT NULL,
    descripcion  TEXT,
    stock_minimo INT          NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE movimientos (
    id          BIGSERIAL PRIMARY KEY,
    producto_id INT         NOT NULL REFERENCES productos(id),
    tipo        CHAR(1)     NOT NULL CHECK (tipo IN ('E','S')),  -- E=Entrada, S=Salida
    cantidad    INT         NOT NULL CHECK (cantidad > 0),
    observacion TEXT,
    usuario_id  INT         REFERENCES usuarios(id),
    fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_movimientos_producto ON movimientos(producto_id);
CREATE INDEX ix_movimientos_fecha    ON movimientos(fecha DESC);


CREATE OR REPLACE PROCEDURE sp_registrar_entrada(
    p_producto_id INT,
    p_cantidad    INT,
    p_observacion TEXT,
    p_usuario_id  INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero' USING ERRCODE = 'IN001';
    END IF;

    PERFORM 1 FROM productos WHERE id = p_producto_id AND activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe o está inactivo', p_producto_id USING ERRCODE = 'IN002';
    END IF;

    INSERT INTO movimientos (producto_id, tipo, cantidad, observacion, usuario_id)
    VALUES (p_producto_id, 'E', p_cantidad, p_observacion, p_usuario_id);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_registrar_salida(
    p_producto_id INT,
    p_cantidad    INT,
    p_observacion TEXT,
    p_usuario_id  INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_stock INT;
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero' USING ERRCODE = 'IN001';
    END IF;

    -- Bloquea la fila del producto para evitar condiciones de carrera
    PERFORM 1 FROM productos WHERE id = p_producto_id AND activo = TRUE FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe o está inactivo', p_producto_id USING ERRCODE = 'IN002';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN tipo = 'E' THEN cantidad ELSE -cantidad END), 0)
      INTO v_stock
      FROM movimientos
     WHERE producto_id = p_producto_id;

    IF v_stock < p_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', v_stock, p_cantidad
            USING ERRCODE = 'IN003';
    END IF;

    INSERT INTO movimientos (producto_id, tipo, cantidad, observacion, usuario_id)
    VALUES (p_producto_id, 'S', p_cantidad, p_observacion, p_usuario_id);
END;
$$;

CREATE OR REPLACE FUNCTION sp_estado_inventario()
RETURNS TABLE (
    producto_id  INT,
    codigo       VARCHAR,
    nombre       VARCHAR,
    stock_minimo INT,
    entradas     BIGINT,
    salidas      BIGINT,
    stock_actual BIGINT,
    bajo_stock   BOOLEAN
)
LANGUAGE sql
AS $$
    SELECT p.id, p.codigo, p.nombre, p.stock_minimo,
           COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'E'), 0)::BIGINT,
           COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'S'), 0)::BIGINT,
           (COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'E'), 0)
          - COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'S'), 0))::BIGINT,
           (COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'E'), 0)
          - COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'S'), 0)) <= p.stock_minimo
      FROM productos p
      LEFT JOIN movimientos m ON m.producto_id = p.id
     WHERE p.activo = TRUE
     GROUP BY p.id
     ORDER BY p.nombre;
$$;

CREATE OR REPLACE FUNCTION sp_listar_movimientos(p_limite INT DEFAULT 50)
RETURNS TABLE (
    id          BIGINT,
    producto    VARCHAR,
    tipo        CHAR,
    cantidad    INT,
    observacion TEXT,
    usuario     VARCHAR,
    fecha       TIMESTAMPTZ
)
LANGUAGE sql
AS $$
    SELECT m.id, p.nombre, m.tipo, m.cantidad, m.observacion, u.username, m.fecha
      FROM movimientos m
      JOIN productos p ON p.id = m.producto_id
      LEFT JOIN usuarios u ON u.id = m.usuario_id
     ORDER BY m.fecha DESC
     LIMIT p_limite;
$$;

INSERT INTO productos (codigo, nombre, descripcion, stock_minimo) VALUES
('P-001', 'Teclado mecánico',  'Teclado USB',      5),
('P-002', 'Mouse inalámbrico', 'Mouse 2.4GHz',     5),
('P-003', 'Monitor 24"',       'Monitor Full HD',  3);

-- Roles y estado de usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol    VARCHAR(20) NOT NULL DEFAULT 'operador';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN     NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuarios_rol;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_rol CHECK (rol IN ('admin','operador'));

UPDATE usuarios SET rol = 'admin' WHERE id = (SELECT MIN(id) FROM usuarios);

CREATE OR REPLACE PROCEDURE sp_desactivar_producto(p_producto_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_stock BIGINT;
BEGIN
    PERFORM 1 FROM productos WHERE id = p_producto_id AND activo = TRUE FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe o ya está inactivo', p_producto_id USING ERRCODE = 'IN002';
    END IF;

    SELECT COALESCE(SUM(CASE WHEN tipo = 'E' THEN cantidad ELSE -cantidad END), 0)
      INTO v_stock
      FROM movimientos
     WHERE producto_id = p_producto_id;

    IF v_stock > 0 THEN
        RAISE EXCEPTION 'No se puede desactivar: el producto aún tiene % unidades en stock', v_stock
            USING ERRCODE = 'IN004';
    END IF;

    UPDATE productos SET activo = FALSE WHERE id = p_producto_id;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO usuarios (username, password_hash, rol) VALUES
('admin',     crypt('Admin123*',    gen_salt('bf', 11)), 'admin'),
('operador1', crypt('Operador123*', gen_salt('bf', 11)), 'operador')
ON CONFLICT (username) DO NOTHING;