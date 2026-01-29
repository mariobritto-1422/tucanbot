-- =====================================================
-- TUCANBOT - ESQUEMA MULTI-COMERCIO CON PLANES
-- =====================================================

-- 1. TABLA DE PLANES (Nido, Vuelo, Selva)
CREATE TABLE IF NOT EXISTS planes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL, -- 'Nido', 'Vuelo', 'Selva'
    descripcion TEXT,
    limite_mensajes INTEGER DEFAULT 0 -- 0 para ilimitado
);

-- 2. TABLA DE COMERCIOS (Tus clientes)
CREATE TABLE IF NOT EXISTS comercios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_fantasia VARCHAR(255) NOT NULL,
    rubro VARCHAR(50) NOT NULL, -- 'gastronomia', 'gimnasio', 'estetica', etc.
    plan_id INTEGER REFERENCES planes(id),
    wa_instance_key VARCHAR(255) UNIQUE, -- La Key de Evolution API
    wa_number VARCHAR(20), -- El número de WhatsApp del local
    mensaje_bienvenida TEXT DEFAULT '¡Hola! Bienvenid@ a {{nombre}}. ¿En qué podemos ayudarte?',
    configuracion JSONB DEFAULT '{}', -- Para guardar horarios, color de marca, etc.
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. TABLA DE CATEGORÍAS (Para el Menú o Servicios)
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
    es_servicio BOOLEAN DEFAULT false, -- TRUE para clases de gym o turnos
    duracion_minutos INTEGER DEFAULT 0, -- Solo para turnos
    max_gustos INTEGER DEFAULT 0 -- Para heladerías
);

-- 5. TABLA DE CLIENTES FINALES (Los vecinos que escriben)
CREATE TABLE IF NOT EXISTS clientes_finales (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id),
    wa_number VARCHAR(20) NOT NULL,
    nombre_manual VARCHAR(255),
    ultima_interaccion TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(comercio_id, wa_number)
);

-- 6. TABLA DE PEDIDOS / TURNOS
CREATE TABLE IF NOT EXISTS interacciones (
    id SERIAL PRIMARY KEY,
    comercio_id UUID REFERENCES comercios(id),
    cliente_id INTEGER REFERENCES clientes_finales(id),
    tipo VARCHAR(50), -- 'pedido', 'turno'
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'confirmado', 'entregado', 'cancelado'
    detalles JSONB, -- Aquí guardamos los items del pedido o la fecha del turno
    total DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. TABLA DE CONVERSACIONES (Estado del chat)
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
    direccion VARCHAR(10) NOT NULL, -- 'incoming', 'outgoing'
    tipo VARCHAR(50) NOT NULL, -- 'text', 'image', etc.
    contenido TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_comercios_instance_key ON comercios(wa_instance_key);
CREATE INDEX IF NOT EXISTS idx_clientes_comercio_wa ON clientes_finales(comercio_id, wa_number);
CREATE INDEX IF NOT EXISTS idx_conversaciones_comercio_cliente ON conversaciones(comercio_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_productos_comercio ON productos(comercio_id);

-- Insertar planes predefinidos
INSERT INTO planes (nombre, descripcion, limite_mensajes) VALUES
('Nido', 'Plan básico con 500 mensajes mensuales', 500),
('Vuelo', 'Plan intermedio con 2000 mensajes mensuales', 2000),
('Selva', 'Plan premium con mensajes ilimitados', 0)
ON CONFLICT DO NOTHING;

-- Comercio de ejemplo
INSERT INTO comercios (nombre_fantasia, rubro, plan_id, wa_instance_key, wa_number, mensaje_bienvenida, configuracion)
VALUES (
    'Pizzería Don Tucán',
    'gastronomia',
    (SELECT id FROM planes WHERE nombre = 'Selva'),
    'tucanbot-pizzeria',
    '+5491112345678',
    '¡Hola! 🍕 Bienvenido a {{nombre}}. Estamos listos para tomar tu pedido. ¿Qué te gustaría ordenar hoy?',
    '{
        "horario_apertura": "18:00",
        "horario_cierre": "23:30",
        "acepta_delivery": true,
        "radio_delivery_km": 5
    }'::JSONB
);
