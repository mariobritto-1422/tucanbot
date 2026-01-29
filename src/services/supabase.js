const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

// Crear cliente de Supabase con service role (acceso completo)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Buscar comercio por instance_key
 */
async function getComercioByInstanceKey(instanceKey) {
  const { data, error } = await supabase
    .from('comercios')
    .select('*, plan:planes(*)')
    .eq('wa_instance_key', instanceKey)
    .eq('activo', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error al buscar comercio:', error);
    return null;
  }

  return data;
}

/**
 * Obtener o crear cliente final
 */
async function getOrCreateCliente(comercioId, waNumber, nombre = null) {
  // Buscar cliente existente
  const { data: existingCliente } = await supabase
    .from('clientes_finales')
    .select('*')
    .eq('comercio_id', comercioId)
    .eq('wa_number', waNumber)
    .single();

  if (existingCliente) {
    // Actualizar última interacción
    await supabase
      .from('clientes_finales')
      .update({ ultima_interaccion: new Date().toISOString() })
      .eq('id', existingCliente.id);

    return existingCliente;
  }

  // Crear nuevo cliente
  const { data: newCliente, error } = await supabase
    .from('clientes_finales')
    .insert({
      comercio_id: comercioId,
      wa_number: waNumber,
      nombre_manual: nombre || `Cliente ${waNumber.slice(-4)}`
    })
    .select()
    .single();

  if (error) {
    console.error('Error al crear cliente:', error);
    return null;
  }

  console.log(`✅ Nuevo cliente creado: ${waNumber}`);
  return newCliente;
}

/**
 * Obtener categorías de un comercio
 */
async function getCategorias(comercioId) {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('comercio_id', comercioId)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error al obtener categorías:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtener productos por categoría
 */
async function getProductosByCategoria(categoriaId) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('categoria_id', categoriaId)
    .eq('stock_disponible', true)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error al obtener productos:', error);
    return [];
  }

  return data || [];
}

/**
 * Registrar mensaje en log
 */
async function logMensaje(comercioId, clienteId, waNumber, direccion, tipo, contenido) {
  const { error } = await supabase
    .from('mensajes_log')
    .insert({
      comercio_id: comercioId,
      cliente_id: clienteId,
      wa_number: waNumber,
      direccion: direccion, // 'incoming' o 'outgoing'
      tipo: tipo,
      contenido: contenido
    });

  if (error) {
    console.error('Error al registrar mensaje:', error);
  }
}

/**
 * Obtener o crear conversación
 */
async function getOrCreateConversacion(comercioId, clienteId) {
  // Buscar conversación existente
  const { data: existingConv } = await supabase
    .from('conversaciones')
    .select('*')
    .eq('comercio_id', comercioId)
    .eq('cliente_id', clienteId)
    .single();

  if (existingConv) {
    // Actualizar última actividad
    await supabase
      .from('conversaciones')
      .update({
        ultimo_mensaje_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
      .eq('id', existingConv.id);

    return existingConv;
  }

  // Crear nueva conversación
  const { data: newConv, error } = await supabase
    .from('conversaciones')
    .insert({
      comercio_id: comercioId,
      cliente_id: clienteId,
      estado: 'inicio',
      contexto: {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error al crear conversación:', error);
    return null;
  }

  return newConv;
}

/**
 * Actualizar estado de conversación
 */
async function updateConversacion(conversacionId, estado, contexto = null) {
  const updates = {
    estado: estado,
    ultimo_mensaje_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };

  if (contexto !== null) {
    updates.contexto = contexto;
  }

  const { error } = await supabase
    .from('conversaciones')
    .update(updates)
    .eq('id', conversacionId);

  if (error) {
    console.error('Error al actualizar conversación:', error);
  }
}

module.exports = {
  supabase,
  getComercioByInstanceKey,
  getOrCreateCliente,
  getCategorias,
  getProductosByCategoria,
  logMensaje,
  getOrCreateConversacion,
  updateConversacion
};
