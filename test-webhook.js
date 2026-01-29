#!/usr/bin/env node

/**
 * Script de prueba para enviar webhooks simulados a TucánBot
 * Útil para testing sin necesidad de Evolution API
 *
 * Uso:
 *   node test-webhook.js <instance_key> <wa_number> "<mensaje>"
 *
 * Ejemplo:
 *   node test-webhook.js pizzeria-dontucan 5491112345678 "hola"
 */

const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'http://localhost:3000/webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('❌ Uso incorrecto\n');
  console.log('📖 Uso:');
  console.log('   node test-webhook.js <instance_key> <wa_number> "<mensaje>"\n');
  console.log('📝 Ejemplo:');
  console.log('   node test-webhook.js pizzeria-dontucan 5491112345678 "hola"\n');
  process.exit(1);
}

const [instanceKey, waNumber, mensaje] = args;

// Construir webhook simulado con formato de Evolution API
const webhookData = {
  event: 'MESSAGES_UPSERT',
  instance: instanceKey,
  data: {
    key: {
      remoteJid: `${waNumber}@s.whatsapp.net`,
      fromMe: false,
      id: `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    pushName: 'Usuario de Prueba',
    message: {
      conversation: mensaje
    },
    messageType: 'conversation',
    messageTimestamp: Math.floor(Date.now() / 1000)
  },
  destination: instanceKey,
  server_url: WEBHOOK_URL,
  apikey: WEBHOOK_SECRET
};

console.log('\n🧪 Enviando webhook de prueba...\n');
console.log('📍 URL:', WEBHOOK_URL);
console.log('🏪 Instance:', instanceKey);
console.log('📱 WhatsApp:', waNumber);
console.log('💬 Mensaje:', mensaje);
console.log('\n' + '─'.repeat(50) + '\n');

// Enviar webhook
axios.post(WEBHOOK_URL, webhookData, {
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': WEBHOOK_SECRET
  }
})
  .then(response => {
    console.log('✅ Webhook enviado exitosamente\n');
    console.log('📥 Respuesta:', JSON.stringify(response.data, null, 2));
    console.log('\n💡 Revisa la consola del servidor para ver el procesamiento\n');
  })
  .catch(error => {
    console.error('❌ Error al enviar webhook:\n');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        console.error('\n⚠️ Error de autenticación. Verifica que WEBHOOK_SECRET esté configurado correctamente.\n');
      }
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor.');
      console.error('Verifica que TucánBot esté ejecutándose en:', WEBHOOK_URL);
    } else {
      console.error(error.message);
    }

    process.exit(1);
  });
