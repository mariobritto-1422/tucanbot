# 🦜 TucánBot

Sistema SaaS para automatización de WhatsApp con Evolution API y Supabase.

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
PORT=3000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
EVOLUTION_API_URL=https://tu-evolution-api.com
EVOLUTION_API_KEY=tu_api_key
EVOLUTION_INSTANCE_NAME=tu-instancia
WEBHOOK_SECRET=genera_un_secreto_seguro
```

### 3. Crear tablas en Supabase

1. Ir a tu proyecto en Supabase → SQL Editor
2. Ejecutar el script: `src/database/migrations/003_schema_multicomercio.sql`
3. Verificar que se crearon las tablas

### 4. Insertar tu primer comercio

```sql
INSERT INTO comercios (
    nombre_fantasia,
    rubro,
    plan_id,
    wa_instance_key,
    wa_number,
    mensaje_bienvenida
) VALUES (
    'Mi Negocio',
    'gastronomia',
    (SELECT id FROM planes WHERE nombre = 'Selva'),
    'mi-negocio-bot',
    '+5491112345678',
    '¡Hola! Bienvenido a {{nombre}}. ¿En qué podemos ayudarte?'
);
```

### 5. Agregar categorías y productos

```sql
-- Categoría
INSERT INTO categorias (comercio_id, nombre)
VALUES (
    (SELECT id FROM comercios WHERE wa_instance_key = 'mi-negocio-bot'),
    'Productos'
);

-- Producto
INSERT INTO productos (comercio_id, categoria_id, nombre, precio, stock_disponible)
VALUES (
    (SELECT id FROM comercios WHERE wa_instance_key = 'mi-negocio-bot'),
    (SELECT id FROM categorias WHERE nombre = 'Productos' LIMIT 1),
    'Producto 1',
    1000.00,
    true
);
```

### 6. Iniciar servidor

```bash
npm start
```

### 7. Configurar Evolution API

```bash
# Crear instancia
curl -X POST https://tu-evolution-api.com/instance/create \
  -H "apikey: TU_API_KEY" \
  -d '{"instanceName": "mi-negocio-bot"}'

# Escanear QR con WhatsApp

# Configurar webhook
curl -X POST https://tu-evolution-api.com/webhook/set/mi-negocio-bot \
  -H "apikey: TU_API_KEY" \
  -d '{
    "url": "https://tu-dominio.com/webhook",
    "events": ["MESSAGES_UPSERT"],
    "headers": {"x-api-key": "TU_WEBHOOK_SECRET"}
  }'
```

### 8. Probar

```bash
node test-webhook.js mi-negocio-bot 5491112345678 "hola"
```

## 📁 Estructura

```
tucanbot/
├── src/
│   ├── index.js                    # Servidor principal
│   ├── services/
│   │   └── supabase.js             # Conexión a Supabase
│   ├── handlers/
│   │   └── messageHandler.js       # Lógica de mensajes por rubro
│   └── database/
│       └── migrations/
│           └── 003_schema_multicomercio.sql
├── .env                            # Variables de entorno
├── test-webhook.js                 # Script de prueba
└── package.json
```

## 🎯 Funcionalidades

### ✅ Multi-Comercio
- Identifica automáticamente el comercio por `instance_key`
- Cada comercio tiene sus propios clientes, productos y conversaciones

### ✅ Rubro Gastronomía (Implementado)
- Mensaje de bienvenida personalizable
- Lista de categorías
- Navegación de productos
- Sistema de carrito
- Finalización de pedidos

### 🚧 Otros Rubros
- Gimnasio (placeholder)
- Estética (placeholder)
- Fácil de expandir

## 🔒 Seguridad

- Validación de webhooks con `x-api-key`
- Service Role Key solo en backend
- Credenciales en variables de entorno

## 🧪 Testing Local

### Con ngrok

```bash
# Terminal 1
npm start

# Terminal 2
ngrok http 3000

# Actualizar webhook en Evolution API con URL de ngrok
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 📊 Verificar en Supabase

```sql
-- Ver últimos mensajes
SELECT * FROM mensajes_log ORDER BY created_at DESC LIMIT 10;

-- Ver conversaciones activas
SELECT * FROM conversaciones WHERE expires_at > NOW();

-- Ver clientes
SELECT * FROM clientes_finales ORDER BY ultima_interaccion DESC;
```

## 🆘 Troubleshooting

**Comercio no encontrado:**
- Verificar que `wa_instance_key` en Supabase = `instanceName` en Evolution API

**No autorizado (401):**
- Verificar que `WEBHOOK_SECRET` coincide en .env y Evolution API

**Bot no responde:**
- Ver logs en consola del servidor
- Verificar credenciales en .env
- Probar health check

## 📚 Documentación Adicional

- **INICIO_RAPIDO.txt** - Guía paso a paso en 5 minutos
- **README_SIMPLE.md** - Documentación detallada
- **RESUMEN_PROYECTO.md** - Resumen completo del sistema

## 💡 Flujo de Usuario (Gastronomía)

```
Usuario: hola
Bot: ¡Bienvenido! [Muestra categorías]

Usuario: 1
Bot: [Muestra productos de la categoría]

Usuario: 2
Bot: Producto agregado. Total: $1000
     1) Agregar más  2) Finalizar  3) Ver carrito  4) Cancelar

Usuario: 2
Bot: [Resumen del pedido]
```

## 🔧 Desarrollo

```bash
# Modo desarrollo (auto-reload)
npm run dev

# Probar webhook
node test-webhook.js <instance_key> <wa_number> "<mensaje>"
```

## 📝 Licencia

MIT

---

**TucánBot** - Sistema de automatización de WhatsApp para comercios
