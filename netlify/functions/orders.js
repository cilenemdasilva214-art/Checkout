// Netlify Serverless Function: orders
// Caminho: netlify/functions/orders.js

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: JSON.stringify({ message: 'Successful preflight' }),
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Método não permitido. Use GET.' }),
    };
  }

  // Obter o domínio de onde a requisição de orders foi iniciada
  const referer = event.headers.referer || event.headers.Origin || event.headers.origin || '';
  let requestDomain = '';
  if (referer) {
    try {
      const url = new URL(referer);
      requestDomain = url.hostname;
    } catch (e) {
      console.warn('Erro ao parsear referer em orders:', referer, e.message);
    }
  }
  if (!requestDomain) {
    requestDomain = event.headers.host || '';
  }
  requestDomain = requestDomain.split(':')[0].toLowerCase();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Configuração do banco de dados ausente no backend.' }),
    };
  }

  // Obter parâmetros da query string (limites, etc.)
  const id = event.queryStringParameters ? event.queryStringParameters.id : null;
  const limit = (event.queryStringParameters && event.queryStringParameters.limit) || '1000';
  
  let targetUrl;
  if (id) {
    targetUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/card_checkout_test_raw?id=eq.${id}&select=*`;
  } else {
    targetUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/card_checkout_test_raw?select=*&order=created_at.desc&limit=${limit}`;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ao buscar pedidos no Supabase: ${response.status} - ${errText}`);
    }

    const orders = await response.json();

    // Filtragem inteligente baseada no domínio
    let filteredOrders = orders;
    if (requestDomain && requestDomain !== 'localhost' && requestDomain !== '127.0.0.1') {
      const isPorto = requestDomain.includes('portodosvinhos') || requestDomain.includes('porto-dos-vinhos');
      filteredOrders = orders.filter(order => {
        const orderDomain = order.domain ? order.domain.toLowerCase() : '';
        if (isPorto) {
          // Porto dos Vinhos: exibe pedidos do próprio domínio + pedidos históricos sem domínio
          return orderDomain === requestDomain || !order.domain;
        } else {
          // Novo Checkout: exibe estritamente apenas os pedidos gerados neste domínio
          return orderDomain === requestDomain;
        }
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filteredOrders),
    };

  } catch (error) {
    console.error('❌ Erro no processamento de orders:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
