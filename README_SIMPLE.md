# 🦜 TucánBot - Implementación Simple

Sistema SaaS multi-tenant para WhatsApp usando Evolution API y Supabase.

## 📁 Estructura de Archivos

```
tucanbot/
├── src/
│   ├── index-simple.js              # Servidor Express principal
│   ├── services/
│   │   └── supabase.js              # Conexión y funciones de BD
│   └── handlers/
│       └── messageHandler.js        # Lógica de procesamiento de mensajes
├── .env                             # Variables de entorno (crear desde .env.example)
├── .env.example                     # Template de configuración
└── package.json                     # Dependencias
```

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
WEBHOOK_SECRET=genera_un_secreto_seguro
```

### 3. Crear tablas en Supabase

Ejecutar en SQL Editor de Supabase:

```sql
-- Usar el archivo: src/database/migrations/003_schema_multicomercio.sql
```

### 4. Iniciar servidor

```bash
node src/index-simple.js
```

Verás:

```
============================================================
🦜 TucánBot SaaS Multi-Comercio
============================================================
🌐 Servidor escuchando en puerto: 3000
🔗 Webhook URL: http://localhost:3000/webhook
📊 Health check: http://localhost:3000/health
🔒 Seguridad: Activada ✓
============================================================
💡 Esperando webhooks de Evolution API...
```

## 🔧 Configurar Evolution API

### 1. Crear instancia para tu comercio

```bash
curl -X POST https://tu-evolution-api.com/instance/create \
  -H "apikey: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "pizzeria-dontucan",
    "qrcode": true
  }'
```

### 2. Configurar webhook

```bash
curl -X POST https://tu-evolution-api.com/webhook/set/pizzeria-dontucan \
  -H "apikey: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-tucanbot.com/webhook",
    "events": ["MESSAGES_UPSERT"],
    "headers": {
      "x-api-key": "TU_WEBHOOK_SECRET"
    }
  }'
```

**Importante**: El header `x-api-key` debe coincidir con `WEBHOOK_SECRET` en tu `.env`.

## 🗄️ Configurar Comercio en Supabase

### 1. Insertar comercio

```sql
INSERT INTO comercios (
    nombre_fantasia,
    rubro,
    plan_id,
    wa_instance_key,
    wa_number,
    mensaje_bienvenida
) VALUES (
    'Pizzería Don Tucán',
    'gastronomia',
    (SELECT id FROM planes WHERE nombre = 'Selva'),
    'pizzeria-dontucan',  -- ← Debe coincidir con instanceName
    '+5491112345678',
    '¡Hola! 🍕 Bienvenido a {{nombre}}. Estamos listos para tomar tu pedido.'
);
```

### 2. Agregar categorías

```sql
INSERT INTO categorias (comercio_id, nombre, descripcion)
VALUES (
    (SELECT id FROM comercios WHERE wa_instance_key = 'pizzeria-dontucan'),
    'Pizzas',
    'Pizzas artesanales en masa madre'
);
```

### 3. Agregar productos

```sql
INSERT INTO productos (
    comercio_id,
    categoria_id,
    nombre,
    descripcion,
    precio,
    stock_disponible
) VALUES (
    (SELECT id FROM comercios WHERE wa_instance_key = 'pizzeria-dontucan'),
    (SELECT id FROM categorias WHERE nombre = 'Pizzas' LIMIT 1),
    'Muzzarella',
    'Salsa de tomate, muzzarella y aceitunas',
    2500.00,
    true
);
```

## 📱 Flujo de Usuario (Gastronomía)

```
Usuario: Hola
Bot: ¡Hola! 🍕 Bienvenido a Pizzería Don Tucán...
     📂 NUESTRAS CATEGORÍAS
     1️⃣ Pizzas
     2️⃣ Empanadas
     💡 Escribe el número de la categoría

Usuario: 1
Bot: 🍽️ PIZZAS
     1. Muzzarella - $2500.00
     2. Napolitana - $2800.00
     💡 Escribe el número del producto

Usuario: 1
Bot: ✅ Muzzarella agregado al pedido
     🛒 Total actual: $2500.00
     ¿Qué deseas hacer?
     1️⃣ Agregar más productos
     2️⃣ Finalizar pedido
     3️⃣ Ver carrito
     4️⃣ Cancelar pedido

Usuario: 2
Bot: 📝 RESUMEN DE TU PEDIDO
     1. Muzzarella - $2500.00
     ━━━━━━━━━━━━━━━━
     💵 TOTAL: $2500.00
     ⚠️ Pedido registrado
```

## 🧪 Probar Localmente

### Con ngrok

```bash
# Terminal 1: Iniciar TucánBot
node src/index-simple.js

# Terminal 2: Exponer con ngrok
ngrok http 3000

# Copiar URL HTTPS (ej: https://abc123.ngrok.io)
# Actualizar webhook en Evolution API con: https://abc123.ngrok.io/webhook
```

### Health check

```bash
curl http://localhost:3000/health
```

Respuesta:
```json
{
  "success": true,
  "status": "healthy",
  "mode": "multi-comercio",
  "timestamp": "2024-01-28T..."
}
```

## 🔍 Debugging

### Ver logs en tiempo real

Los logs se muestran en la consola:

```
📥 Webhook recibido de instancia: pizzeria-dontucan
📨 Mensaje de: 5491112345678
💬 Contenido: hola
🏪 Comercio: Pizzería Don Tucán (gastronomia)
✅ Nuevo cliente creado: 5491112345678
👤 Cliente: Cliente 5678
📨 Procesando mensaje para rubro: gastronomia
📤 Mensaje enviado a 5491112345678
✅ Mensaje procesado exitosamente
```

### Verificar en Supabase

```sql
-- Ver últimos mensajes
SELECT * FROM mensajes_log ORDER BY created_at DESC LIMIT 10;

-- Ver conversaciones activas
SELECT * FROM conversaciones WHERE expires_at > NOW();

-- Ver clientes registrados
SELECT * FROM clientes_finales ORDER BY ultima_interaccion DESC;
```

## 🎯 Cómo Funciona

### 1. Recepción del Webhook

```javascript
POST /webhook
Headers: x-api-key: TU_WEBHOOK_SECRET
Body: {
  "instance": "pizzeria-dontucan",
  "event": "MESSAGES_UPSERT",
  "data": {
    "key": { "remoteJid": "5491112345678@s.whatsapp.net" },
    "message": { "conversation": "hola" }
  }
}
```

### 2. Identificación del Comercio

```javascript
// En src/services/supabase.js
const comercio = await getComercioByInstanceKey('pizzeria-dontucan');
// Retorna: { id, nombre_fantasia, rubro, mensaje_bienvenida, ... }
```

### 3. Gestión de Cliente

```javascript
// Si el cliente no existe, se crea automáticamente
const cliente = await getOrCreateCliente(comercio.id, '5491112345678');
```

### 4. Procesamiento según Rubro

```javascript
// En src/handlers/messageHandler.js
switch (comercio.rubro) {
  case 'gastronomia':
    await handleGastronomia(...);
    break;
  case 'gimnasio':
    await handleGimnasio(...);
    break;
}
```

### 5. Respuesta al Cliente

```javascript
// Envía mensaje vía Evolution API
await sendMessage(instanceKey, waNumber, textoRespuesta);
```

## 🛡️ Seguridad

### Validación de Webhook

```javascript
// En src/index-simple.js
function validateWebhook(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}
```

### Variables Sensibles

- `SUPABASE_SERVICE_ROLE_KEY`: Solo en backend, nunca exponer
- `EVOLUTION_API_KEY`: Para autenticación con Evolution API
- `WEBHOOK_SECRET`: Para validar webhooks entrantes

## 📊 Estados de Conversación

- `inicio`: Primer mensaje, enviar bienvenida
- `esperando_categoria`: Esperando selección de categoría
- `seleccionando_producto`: Navegando productos
- `gestionando_pedido`: Revisando carrito/finalizando

## 🔄 Agregar Nuevo Rubro

### 1. Crear handler en messageHandler.js

```javascript
async function handleTuRubro(comercio, cliente, mensaje, conversacion) {
  const { wa_instance_key } = comercio;
  const waNumber = cliente.wa_number;

  // Tu lógica aquí
  await sendMessage(wa_instance_key, waNumber, 'Tu respuesta');
}
```

### 2. Agregar al switch

```javascript
switch (rubro) {
  case 'tu_rubro':
    await handleTuRubro(comercio, cliente, mensaje, conversacion);
    break;
}
```

## 🆘 Troubleshooting

### Webhook no llega

1. Verificar que Evolution API esté enviando a la URL correcta
2. Verificar que el header `x-api-key` coincida con `WEBHOOK_SECRET`
3. Ver logs: `tail -f logs/combined.log` (si está configurado)

### Comercio no encontrado

Verificar que `wa_instance_key` en Supabase coincide con `instanceName`:

```sql
SELECT wa_instance_key FROM comercios WHERE activo = true;
```

### Bot no responde

1. Ver logs de la consola
2. Verificar credenciales de Evolution API en `.env`
3. Probar endpoint: `GET /health`

## 📚 Próximos Pasos

- [ ] Implementar registro de interacciones (pedidos)
- [ ] Agregar más rubros (gimnasio, estética, etc.)
- [ ] Dashboard de administración
- [ ] Sistema de notificaciones
- [ ] Analíticas y reportes

---

¡Listo! Tu TucánBot está funcionando 🎉
