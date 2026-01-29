const axios = require('axios');
const {
  getCategorias,
  getProductosByCategoria,
  getOrCreateConversacion,
  updateConversacion
} = require('../services/supabase');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

/**
 * Enviar mensaje de texto a través de Evolution API
 */
async function sendMessage(instanceKey, waNumber, text) {
  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${instanceKey}`,
      {
        number: waNumber,
        text: text
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        }
      }
    );

    console.log(`📤 Mensaje enviado a ${waNumber}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Manejador principal de mensajes
 * Enruta según el rubro del comercio
 */
async function handleMessage(comercio, cliente, mensaje) {
  const { rubro, wa_instance_key } = comercio;
  const waNumber = cliente.wa_number;

  console.log(`📨 Procesando mensaje para rubro: ${rubro}`);

  // Obtener o crear conversación
  const conversacion = await getOrCreateConversacion(comercio.id, cliente.id);

  // Enrutar según rubro
  switch (rubro) {
    case 'gastronomia':
      await handleGastronomia(comercio, cliente, mensaje, conversacion);
      break;

    case 'gimnasio':
      await handleGimnasio(comercio, cliente, mensaje, conversacion);
      break;

    case 'estetica':
      await handleEstetica(comercio, cliente, mensaje, conversacion);
      break;

    default:
      // Rubro no implementado, enviar mensaje genérico
      await sendMessage(
        wa_instance_key,
        waNumber,
        `Hola! Gracias por contactar a ${comercio.nombre_fantasia}. En breve te atenderemos.`
      );
  }
}

/**
 * Manejador de mensajes para rubro GASTRONOMÍA
 */
async function handleGastronomia(comercio, cliente, mensaje, conversacion) {
  const { wa_instance_key, nombre_fantasia, mensaje_bienvenida } = comercio;
  const waNumber = cliente.wa_number;
  const textoMensaje = mensaje.toLowerCase().trim();

  // Si es el primer mensaje o solicita el menú
  if (conversacion.estado === 'inicio' || textoMensaje === 'menu' || textoMensaje === 'hola') {
    // Enviar mensaje de bienvenida
    const bienvenida = mensaje_bienvenida
      .replace(/\{\{nombre\}\}/g, nombre_fantasia)
      .replace(/\{\{cliente\}\}/g, cliente.nombre_manual || 'Cliente');

    await sendMessage(wa_instance_key, waNumber, bienvenida);

    // Obtener categorías
    const categorias = await getCategorias(comercio.id);

    if (categorias.length > 0) {
      // Construir mensaje con categorías
      let mensajeCategorias = '📂 *NUESTRAS CATEGORÍAS*\n\n';

      categorias.forEach((cat, index) => {
        mensajeCategorias += `${index + 1}️⃣ ${cat.nombre}\n`;
        if (cat.descripcion) {
          mensajeCategorias += `   _${cat.descripcion}_\n`;
        }
        mensajeCategorias += '\n';
      });

      mensajeCategorias += '💡 *Escribe el número de la categoría que deseas ver*';

      await sendMessage(wa_instance_key, waNumber, mensajeCategorias);

      // Actualizar estado de conversación
      await updateConversacion(conversacion.id, 'esperando_categoria', {
        categorias: categorias.map(c => ({ id: c.id, nombre: c.nombre }))
      });
    } else {
      await sendMessage(
        wa_instance_key,
        waNumber,
        '❌ Lo sentimos, aún no tenemos productos disponibles.'
      );
    }

    return;
  }

  // Si está esperando selección de categoría
  if (conversacion.estado === 'esperando_categoria') {
    const numeroCategoria = parseInt(textoMensaje);
    const categorias = conversacion.contexto?.categorias || [];

    if (isNaN(numeroCategoria) || numeroCategoria < 1 || numeroCategoria > categorias.length) {
      await sendMessage(
        wa_instance_key,
        waNumber,
        '❌ Opción no válida. Por favor escribe el número de una categoría o "menu" para volver al inicio.'
      );
      return;
    }

    const categoriaSeleccionada = categorias[numeroCategoria - 1];

    // Obtener productos de la categoría
    const productos = await getProductosByCategoria(categoriaSeleccionada.id);

    if (productos.length > 0) {
      let mensajeProductos = `🍽️ *${categoriaSeleccionada.nombre.toUpperCase()}*\n\n`;

      productos.forEach((prod, index) => {
        mensajeProductos += `${index + 1}. *${prod.nombre}*\n`;
        if (prod.descripcion) {
          mensajeProductos += `   ${prod.descripcion}\n`;
        }
        mensajeProductos += `   💰 $${parseFloat(prod.precio).toFixed(2)}\n\n`;
      });

      mensajeProductos += '💡 Escribe el número del producto para agregarlo al pedido\n';
      mensajeProductos += '📝 Escribe "menu" para ver otras categorías';

      await sendMessage(wa_instance_key, waNumber, mensajeProductos);

      // Actualizar estado
      await updateConversacion(conversacion.id, 'seleccionando_producto', {
        ...conversacion.contexto,
        categoria_actual: categoriaSeleccionada,
        productos: productos.map(p => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio
        }))
      });
    } else {
      await sendMessage(
        wa_instance_key,
        waNumber,
        '❌ Esta categoría no tiene productos disponibles en este momento.\n\nEscribe "menu" para ver otras opciones.'
      );
    }

    return;
  }

  // Si está seleccionando producto
  if (conversacion.estado === 'seleccionando_producto') {
    const numeroProducto = parseInt(textoMensaje);
    const productos = conversacion.contexto?.productos || [];

    if (isNaN(numeroProducto) || numeroProducto < 1 || numeroProducto > productos.length) {
      await sendMessage(
        wa_instance_key,
        waNumber,
        '❌ Opción no válida. Escribe el número del producto o "menu" para volver al inicio.'
      );
      return;
    }

    const productoSeleccionado = productos[numeroProducto - 1];

    // Agregar al carrito (contexto)
    const carrito = conversacion.contexto?.carrito || [];
    carrito.push({
      producto_id: productoSeleccionado.id,
      nombre: productoSeleccionado.nombre,
      precio: productoSeleccionado.precio,
      cantidad: 1
    });

    const total = carrito.reduce((sum, item) => sum + parseFloat(item.precio), 0);

    await sendMessage(
      wa_instance_key,
      waNumber,
      `✅ *${productoSeleccionado.nombre}* agregado al pedido\n\n` +
      `🛒 Total actual: $${total.toFixed(2)}\n\n` +
      `¿Qué deseas hacer?\n` +
      `1️⃣ Agregar más productos\n` +
      `2️⃣ Finalizar pedido\n` +
      `3️⃣ Ver carrito\n` +
      `4️⃣ Cancelar pedido`
    );

    await updateConversacion(conversacion.id, 'gestionando_pedido', {
      ...conversacion.contexto,
      carrito: carrito
    });

    return;
  }

  // Si está gestionando el pedido
  if (conversacion.estado === 'gestionando_pedido') {
    const opcion = textoMensaje;

    switch (opcion) {
      case '1':
        // Volver a categorías
        const categorias = await getCategorias(comercio.id);
        let mensajeCategorias = '📂 *CATEGORÍAS*\n\n';
        categorias.forEach((cat, i) => {
          mensajeCategorias += `${i + 1}️⃣ ${cat.nombre}\n`;
        });
        mensajeCategorias += '\n💡 Escribe el número de la categoría';

        await sendMessage(wa_instance_key, waNumber, mensajeCategorias);
        await updateConversacion(conversacion.id, 'esperando_categoria', {
          ...conversacion.contexto,
          categorias: categorias.map(c => ({ id: c.id, nombre: c.nombre }))
        });
        break;

      case '2':
        // Finalizar pedido
        const carrito = conversacion.contexto?.carrito || [];
        if (carrito.length === 0) {
          await sendMessage(wa_instance_key, waNumber, '❌ Tu carrito está vacío.');
          return;
        }

        let resumen = '📝 *RESUMEN DE TU PEDIDO*\n\n';
        let total = 0;

        carrito.forEach((item, i) => {
          resumen += `${i + 1}. ${item.nombre} - $${parseFloat(item.precio).toFixed(2)}\n`;
          total += parseFloat(item.precio);
        });

        resumen += `\n━━━━━━━━━━━━━━━━\n`;
        resumen += `💵 *TOTAL: $${total.toFixed(2)}*\n\n`;
        resumen += `⚠️ *Pedido registrado*\n`;
        resumen += `En breve nos comunicaremos contigo para confirmar.\n\n`;
        resumen += `Escribe "menu" para hacer un nuevo pedido.`;

        await sendMessage(wa_instance_key, waNumber, resumen);

        // TODO: Crear registro en tabla interacciones

        // Resetear conversación
        await updateConversacion(conversacion.id, 'inicio', {});
        break;

      case '3':
        // Ver carrito
        const carritoActual = conversacion.contexto?.carrito || [];
        if (carritoActual.length === 0) {
          await sendMessage(wa_instance_key, waNumber, '🛒 Tu carrito está vacío.');
          return;
        }

        let mensajeCarrito = '🛒 *TU CARRITO*\n\n';
        let totalCarrito = 0;

        carritoActual.forEach((item, i) => {
          mensajeCarrito += `${i + 1}. ${item.nombre} - $${parseFloat(item.precio).toFixed(2)}\n`;
          totalCarrito += parseFloat(item.precio);
        });

        mensajeCarrito += `\n💵 Total: $${totalCarrito.toFixed(2)}`;

        await sendMessage(wa_instance_key, waNumber, mensajeCarrito);
        break;

      case '4':
        // Cancelar pedido
        await sendMessage(
          wa_instance_key,
          waNumber,
          '❌ Pedido cancelado.\n\nEscribe "menu" cuando quieras hacer un nuevo pedido.'
        );
        await updateConversacion(conversacion.id, 'inicio', {});
        break;

      default:
        await sendMessage(
          wa_instance_key,
          waNumber,
          '❌ Opción no válida. Escribe 1, 2, 3 o 4.'
        );
    }

    return;
  }

  // Estado no reconocido, resetear
  await sendMessage(
    wa_instance_key,
    waNumber,
    'Escribe "menu" para ver nuestras opciones.'
  );
}

/**
 * Manejador para rubro GIMNASIO
 */
async function handleGimnasio(comercio, cliente, mensaje, conversacion) {
  const { wa_instance_key, nombre_fantasia } = comercio;
  const waNumber = cliente.wa_number;

  // Implementación básica
  await sendMessage(
    wa_instance_key,
    waNumber,
    `¡Hola! Bienvenido a ${nombre_fantasia} 💪\n\nFuncionalidad en desarrollo.\n\nPronto podrás:\n- Reservar clases\n- Consultar horarios\n- Ver planes disponibles`
  );
}

/**
 * Manejador para rubro ESTÉTICA
 */
async function handleEstetica(comercio, cliente, mensaje, conversacion) {
  const { wa_instance_key, nombre_fantasia } = comercio;
  const waNumber = cliente.wa_number;

  // Implementación básica
  await sendMessage(
    wa_instance_key,
    waNumber,
    `¡Hola! Bienvenido a ${nombre_fantasia} ✨\n\nFuncionalidad en desarrollo.\n\nPronto podrás:\n- Agendar turnos\n- Ver servicios disponibles\n- Consultar precios`
  );
}

module.exports = {
  handleMessage,
  sendMessage
};
