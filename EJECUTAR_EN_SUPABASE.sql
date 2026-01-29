-- =====================================================
-- TUCANBOT - EJECUTAR ESTE SQL EN SUPABASE
-- =====================================================
-- Copiar y pegar TODO este archivo en el SQL Editor de Supabase
-- Ir a: https://fcjtpdkxoqffcmjenaaq.supabase.co → SQL Editor
-- Pegar este código y hacer click en RUN
-- =====================================================

-- 1. TABLA DE PLANES (Nido, Vuelo, Selva)
CREATE TABLE IF NOT EXISTS planes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    limite_mensajes INTEGER DEFAULT 0
);

-- 2. TABLA DE COMERCIOS (Tus clientes del SaaS)
CREATE TABLE IF NOT EXISTS comercios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_fantasia VARCHAR(255) NOT NULL,
    rubro VARCHAR(50) NOT NULL,
    plan_id INTEGER REFERENCES planes(id),
    wa_instance_key VARCHAR(255) UNIQUE,
    wa_number VARCHAR(20),
    mensaje_bienvenida TEXT DEFAULT '¡Hola! Bienvenid@ a {{nombre}}. ¿En qué podemos ayudarte?',
    configuracion JSONB DEFAULT '{}',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. TABLA DE CATEGORÍAS
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- 4. TABLA DE PRODUCTOS / SERVICIOS
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock_disponible BOOLEAN DEFAULT true,
    es_servicio BOOLEAN DEFAULT false,
    duracion_minutos INTEGER DEFAULT 0,
    max_gustos INTEGER DEFAULT 0
);

-- 5. TABLA DE CLIENTES FINALES (Los usuarios de WhatsApp)
CREATE TABLE IF NOT EXISTS clientes_finales (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id),
    wa_number VARCHAR(20) NOT NULL,
    nombre_manual VARCHAR(255),
    ultima_interaccion TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(comercio_id, wa_number)
);

-- 6. TABLA DE INTERACCIONES (Pedidos/Turnos)
CREATE TABLE IF NOT EXISTS interacciones (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id),
    cliente_id INTEGER REFERENCES clientes_finales(id),
    tipo VARCHAR(50),
    estado VARCHAR(50) DEFAULT 'pendiente',
    detalles JSONB,
    total DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. TABLA DE CONVERSACIONES
CREATE TABLE IF NOT EXISTS conversaciones (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id),
    cliente_id INTEGER REFERENCES clientes_finales(id),
    estado VARCHAR(50) DEFAULT 'inicio',
    contexto JSONB DEFAULT '{}',
    ultimo_mensaje_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(comercio_id, cliente_id)
);

-- 8. TABLA DE LOG DE MENSAJES
CREATE TABLE IF NOT EXISTS mensajes_log (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id),
    cliente_id INTEGER REFERENCES clientes_finales(id),
    wa_number VARCHAR(20) NOT NULL,
    direccion VARCHAR(10) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    contenido TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_comercios_instance_key ON comercios(wa_instance_key);
CREATE INDEX IF NOT EXISTS idx_clientes_comercio_wa ON clientes_finales(comercio_id, wa_number);
CREATE INDEX IF NOT EXISTS idx_conversaciones_comercio_cliente ON conversaciones(comercio_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_productos_comercio ON productos(comercio_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_log_comercio ON mensajes_log(comercio_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_log_created ON mensajes_log(created_at DESC);

-- =====================================================
-- DATOS DE EJEMPLO
-- =====================================================

-- Insertar planes
INSERT INTO planes (nombre, descripcion, limite_mensajes) VALUES
('Nido', 'Plan básico con 500 mensajes mensuales', 500),
('Vuelo', 'Plan intermedio con 2000 mensajes mensuales', 2000),
('Selva', 'Plan premium con mensajes ilimitados', 0)
ON CONFLICT DO NOTHING;

-- Insertar comercio de ejemplo
INSERT INTO comercios (nombre_fantasia, rubro, plan_id, wa_instance_key, wa_number, mensaje_bienvenida, configuracion)
VALUES (
    'Pizzería Don Tucán',
    'gastronomia',
    (SELECT id FROM planes WHERE nombre = 'Selva'),
    'tucanbot-pizzeria',
    '+5491112345678',
    '¡Hola! 🍕 Bienvenido a {{nombre}}. Estamos listos para tomar tu pedido. ¿Qué te gustaría ordenar hoy?',
    '{"horario_apertura": "18:00", "horario_cierre": "23:30", "acepta_delivery": true}'::JSONB
)
ON CONFLICT (wa_instance_key) DO NOTHING;

-- Insertar categorías de ejemplo
INSERT INTO categorias (comercio_id, nombre, descripcion)
SELECT
    id,
    'Pizzas',
    'Pizzas artesanales en masa madre'
FROM comercios
WHERE wa_instance_key = 'tucanbot-pizzeria'
ON CONFLICT DO NOTHING;

INSERT INTO categorias (comercio_id, nombre, descripcion)
SELECT
    id,
    'Empanadas',
    'Empanadas caseras horneadas'
FROM comercios
WHERE wa_instance_key = 'tucanbot-pizzeria'
ON CONFLICT DO NOTHING;

INSERT INTO categorias (comercio_id, nombre, descripcion)
SELECT
    id,
    'Bebidas',
    'Bebidas frías y calientes'
FROM comercios
WHERE wa_instance_key = 'tucanbot-pizzeria'
ON CONFLICT DO NOTHING;

-- Insertar productos de ejemplo
-- Pizzas
INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Muzzarella',
    'Salsa de tomate, muzzarella y aceitunas',
    2500.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Pizzas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Napolitana',
    'Salsa de tomate, muzzarella, tomate y ajo',
    2800.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Pizzas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Fugazzeta',
    'Muzzarella, cebolla y orégano',
    3000.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Pizzas'
ON CONFLICT DO NOTHING;

-- Empanadas
INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Empanadas de Carne',
    'Carne cortada a cuchillo (por docena)',
    2100.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Empanadas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Empanadas de Jamón y Queso',
    'Jamón cocido y queso cremoso (por docena)',
    2100.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Empanadas'
ON CONFLICT DO NOTHING;

-- Bebidas
INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Coca Cola 1.5L',
    'Gaseosa de cola',
    600.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Bebidas'
ON CONFLICT DO NOTHING;

INSERT INTO productos (comercio_id, categoria_id, nombre, descripcion, precio, stock_disponible)
SELECT
    c.id,
    cat.id,
    'Agua Mineral 500ml',
    'Agua sin gas',
    300.00,
    true
FROM comercios c
JOIN categorias cat ON cat.comercio_id = c.id
WHERE c.wa_instance_key = 'tucanbot-pizzeria' AND cat.nombre = 'Bebidas'
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ver resumen de datos creados
SELECT
    'Planes' as tabla,
    COUNT(*) as cantidad
FROM planes
UNION ALL
SELECT
    'Comercios',
    COUNT(*)
FROM comercios
UNION ALL
SELECT
    'Categorías',
    COUNT(*)
FROM categorias
UNION ALL
SELECT
    'Productos',
    COUNT(*)
FROM productos;

-- Ver el comercio de ejemplo
SELECT
    nombre_fantasia,
    rubro,
    wa_instance_key,
    activo
FROM comercios;

-- Ver productos por categoría
SELECT
    cat.nombre as categoria,
    COUNT(p.id) as productos,
    ROUND(AVG(p.precio), 2) as precio_promedio
FROM categorias cat
LEFT JOIN productos p ON p.categoria_id = cat.id
GROUP BY cat.id, cat.nombre
ORDER BY cat.id;

-- =====================================================
-- ✅ LISTO!
-- =====================================================
-- Si todo salió bien, verás:
-- - 3 planes (Nido, Vuelo, Selva)
-- - 1 comercio (Pizzería Don Tucán)
-- - 3 categorías (Pizzas, Empanadas, Bebidas)
-- - 7 productos
-- =====================================================
