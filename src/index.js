require('dotenv').config();
const express = require('express');
const {
  getComercioByInstanceKey,
  getOrCreateCliente,
  logMensaje
} = require('./services/supabase');
const { handleMessage } = require('./handlers/messageHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * Middleware de seguridad para webhook
 * Valida que la petición venga de Evolution API
 */
function validateWebhook(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['apikey'];

  if (!WEBHOOK_SECRET) {
    console.warn('⚠️ WEBHOOK_SECRET no configurado');
    return next();
  }

  if (!apiKey || apiKey !== WEBHOOK_SECRET) {
    console.warn('🚫 Intento de acceso no autorizado al webhook');
    return res.status(401).json({
      success: false,
      error: 'No autorizado'
    });
  }

  next();
}

/**
 * Extraer datos del mensaje desde el webhook de Evolution API
 */
function extractMessageData(webhookData) {
  try {
    const event = webhookData.event;
    const data = webhookData.data;

    // Solo procesar mensajes entrantes
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return null;
    }

    const key = data.key;
    const message = data.message;

    // Ignorar mensajes propios
    if (key.fromMe) {
      return null;
    }

    // Extraer número de WhatsApp (sin @s.whatsapp.net)
    const whatsapp = key.remoteJid.replace('@s.whatsapp.net', '');

    // Extraer contenido según tipo
    let contenido = null;
    let tipo = 'text';

    if (message.conversation) {
      contenido = message.conversation;
    } else if (message.extendedTextMessage) {
      contenido = message.extendedTextMessage.text;
    } else if (message.imageMessage) {
      contenido = message.imageMessage.caption || '[Imagen]';
      tipo = 'image';
    } else if (message.audioMessage) {
      contenido = '[Audio]';
      tipo = 'audio';
    } else {
      console.warn('⚠️ Tipo de mensaje no soportado:', Object.keys(message));
      return null;
    }

    const nombreContacto = data.pushName || null;

    return {
      whatsapp,
      contenido,
      tipo,
      nombreContacto,
      messageId: key.id,
      timestamp: data.messageTimestamp
    };

  } catch (error) {
    console.error('❌ Error al extraer datos del mensaje:', error.message);
    return null;
  }
}

/**
 * ENDPOINT PRINCIPAL: Webhook para recibir mensajes de Evolution API
 */
app.post('/webhook', validateWebhook, async (req, res) => {
  try {
    const webhookData = req.body;
    const instanceKey = webhookData.instance;

    console.log(`\n📥 Webhook recibido de instancia: ${instanceKey}`);

    // Responder inmediatamente (no bloquear Evolution API)
    res.status(200).json({
      success: true,
      message: 'Webhook recibido',
      timestamp: new Date().toISOString()
    });

    // Procesar de forma asíncrona
    processWebhook(webhookData, instanceKey).catch(error => {
      console.error('❌ Error procesando webhook:', error);
    });

  } catch (error) {
    console.error('❌ Error en endpoint webhook:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

/**
 * Procesar webhook de forma asíncrona
 */
async function processWebhook(webhookData, instanceKey) {
  try {
    // 1. Extraer datos del mensaje
    const messageData = extractMessageData(webhookData);

    if (!messageData) {
      console.log('⏭️ Mensaje ignorado (no válido o no soportado)');
      return;
    }

    console.log(`📨 Mensaje de: ${messageData.whatsapp}`);
    console.log(`💬 Contenido: ${messageData.contenido}`);

    // 2. Identificar comercio por instance_key
    const comercio = await getComercioByInstanceKey(instanceKey);

    if (!comercio) {
      console.warn(`⚠️ Comercio no encontrado para instance_key: ${instanceKey}`);
      return;
    }

    console.log(`🏪 Comercio: ${comercio.nombre_fantasia} (${comercio.rubro})`);

    // 3. Obtener o crear cliente
    const cliente = await getOrCreateCliente(
      comercio.id,
      messageData.whatsapp,
      messageData.nombreContacto
    );

    if (!cliente) {
      console.error('❌ Error al obtener/crear cliente');
      return;
    }

    console.log(`👤 Cliente: ${cliente.nombre_manual}`);

    // 4. Registrar mensaje en log
    await logMensaje(
      comercio.id,
      cliente.id,
      messageData.whatsapp,
      'incoming',
      messageData.tipo,
      messageData.contenido
    );

    // 5. Procesar mensaje según rubro
    await handleMessage(comercio, cliente, messageData.contenido);

    console.log('✅ Mensaje procesado exitosamente\n');

  } catch (error) {
    console.error('❌ Error en processWebhook:', error);
  }
}

/**
 * Endpoint de health check
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    mode: 'multi-comercio',
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint raíz - información de la API
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    app: 'TucánBot SaaS',
    version: '2.0',
    mode: 'multi-comercio',
    endpoints: {
      webhook: 'POST /webhook',
      health: 'GET /health'
    },
    info: 'Sistema de automatización de WhatsApp para múltiples comercios'
  });
});

/**
 * Manejo de rutas no encontradas
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    available_routes: ['POST /webhook', 'GET /health', 'GET /']
  });
});

/**
 * Iniciar servidor
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🦜 TucánBot SaaS Multi-Comercio');
  console.log('='.repeat(60));
  console.log(`🌐 Servidor escuchando en puerto: ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Seguridad: ${WEBHOOK_SECRET ? 'Activada ✓' : 'Desactivada ⚠️'}`);
  console.log('='.repeat(60));
  console.log('💡 Esperando webhooks de Evolution API...\n');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Servidor detenido (SIGTERM)');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Servidor detenido (SIGINT)');
  process.exit(0);
});
