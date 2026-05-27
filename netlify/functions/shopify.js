// Netlify Serverless Function: shopify
// Caminho: netlify/functions/shopify.js

exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify({ message: 'Successful preflight' }),
    };
  }

  let storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  let accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  // Carregar credenciais dinâmicas do Supabase (tabela checkout_configs)
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const configUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/checkout_configs?select=*`;
      const configRes = await fetch(configUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (configRes.ok) {
        const configs = await configRes.json();
        let themeConfigStr = '';
        configs.forEach(c => {
          if (c.key === 'checkout_theme_config') themeConfigStr = c.value;
        });

        if (themeConfigStr) {
          const themeConfig = JSON.parse(themeConfigStr);
          if (themeConfig.shopifyDomain) {
            storeDomain = themeConfig.shopifyDomain.trim() + '.myshopify.com';
          }
          if (themeConfig.shopifyToken) {
            accessToken = themeConfig.shopifyToken.trim();
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar credenciais dinâmicas do Shopify:', err);
    }
  }

  const action = event.queryStringParameters ? (event.queryStringParameters.action || 'products') : 'products';

  if (action !== 'exchange_token' && (!storeDomain || !accessToken)) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Credenciais do Shopify ausentes no ambiente do servidor.' }),
    };
  }

  try {
    // ----------------------------------------------------
    // AÇÃO: EXCHANGE TOKEN (OBTER TOKEN DE ACESSO PERMANENTE)
    // ----------------------------------------------------
    if (action === 'exchange_token' && event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const { shop, code, client_id, client_secret } = data;

      if (!shop || !code || !client_id || !client_secret) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Shop, code, client_id e client_secret são obrigatórios.' }),
        };
      }

      let shopUrl = shop.trim();
      if (!shopUrl.endsWith('.myshopify.com')) {
        shopUrl = shopUrl + '.myshopify.com';
      }

      const oauthUrl = `https://${shopUrl}/admin/oauth/access_token`;
      console.log(`📡 Solicitando Token de Acesso Permanente em: ${oauthUrl}`);

      const response = await fetch(oauthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: client_id.trim(),
          client_secret: client_secret.trim(),
          code: code.trim()
        })
      });

      const resText = await response.text();
      if (!response.ok) {
        throw new Error(`Erro na troca de código por token na Shopify: ${response.status} - ${resText}`);
      }

      const resData = JSON.parse(resText);
      console.log(`✅ Token gerado com sucesso para a loja: ${shopUrl}`);

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: resData.access_token,
          scope: resData.scope
        }),
      };
    }

    // ----------------------------------------------------
    // AÇÃO: BUSCAR PRODUTOS
    // ----------------------------------------------------
    if (action === 'products' && event.httpMethod === 'GET') {
      const url = `https://${storeDomain}/admin/api/2024-01/products.json?limit=250`;
      console.log(`📡 Buscando produtos da Shopify em: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro na API do Shopify ao buscar produtos: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(resData.products || []),
      };
    }

    // ----------------------------------------------------
    // AÇÃO: BUSCAR COLEÇÕES
    // ----------------------------------------------------
    if (action === 'collections' && event.httpMethod === 'GET') {
      // Busca coleções customizadas e inteligentes
      const customUrl = `https://${storeDomain}/admin/api/2024-01/custom_collections.json`;
      const smartUrl = `https://${storeDomain}/admin/api/2024-01/smart_collections.json`;
      
      const headers = {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      };

      console.log('📡 Buscando coleções da Shopify...');

      const [customRes, smartRes] = await Promise.all([
        fetch(customUrl, { headers }),
        fetch(smartUrl, { headers })
      ]);

      let collections = [];

      if (customRes.ok) {
        const customData = await customRes.json();
        collections = collections.concat(customData.custom_collections || []);
      }
      if (smartRes.ok) {
        const smartData = await smartRes.json();
        collections = collections.concat(smartData.smart_collections || []);
      }

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(collections),
      };
    }

    // ----------------------------------------------------
    // AÇÃO: BUSCAR COLEÇÕES DE UM PRODUTO
    // ----------------------------------------------------
    if (action === 'product_collections' && event.httpMethod === 'GET') {
      const productId = event.queryStringParameters.product_id;
      if (!productId) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'product_id é obrigatório.' }),
        };
      }

      const customUrl = `https://${storeDomain}/admin/api/2024-01/custom_collections.json?product_id=${productId}`;
      const smartUrl = `https://${storeDomain}/admin/api/2024-01/smart_collections.json?product_id=${productId}`;
      
      const headers = {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      };

      console.log(`📡 Buscando coleções do produto ${productId}...`);

      const [customRes, smartRes] = await Promise.all([
        fetch(customUrl, { headers }),
        fetch(smartUrl, { headers })
      ]);

      let collections = [];

      if (customRes.ok) {
        const customData = await customRes.json();
        collections = collections.concat(customData.custom_collections || []);
      }
      if (smartRes.ok) {
        const smartData = await smartRes.json();
        collections = collections.concat(smartData.smart_collections || []);
      }

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(collections),
      };
    }


    // ----------------------------------------------------
    // AÇÃO: CRIAR PRODUTO NA SHOPIFY
    // ----------------------------------------------------
    if (action === 'createProduct' && event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const { title, price, sku, description, image_url, vendor } = data;

      if (!title || !price || !sku) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Título, Preço e SKU são obrigatórios para criar um produto.' }),
        };
      }

      const url = `https://${storeDomain}/admin/api/2024-01/products.json`;
      console.log(`📡 Criando produto na Shopify: ${url}`);

      const payload = {
        product: {
          title: title,
          body_html: description || '',
          vendor: vendor || 'Checkout Admin',
          product_type: 'Geral',
          status: 'active',
          variants: [
            {
              price: parseFloat(price).toFixed(2),
              sku: sku,
              inventory_policy: 'deny',
              fulfillment_service: 'manual'
            }
          ]
        }
      };

      // Adiciona imagem ao produto se houver
      if (image_url && image_url.trim() !== '') {
        payload.product.images = [
          {
            src: image_url.trim()
          }
        ];
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resText = await response.text();
      if (!response.ok) {
        throw new Error(`Erro na API do Shopify ao criar produto: ${response.status} - ${resText}`);
      }

      const resData = JSON.parse(resText);
      console.log(`✅ Produto criado com sucesso na Shopify: ID ${resData.product.id}`);

      return {
        statusCode: 201,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(resData.product),
      };
    }

    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Ação ou método inválido: ${action} [${event.httpMethod}]` }),
    };

  } catch (error) {
    console.error('❌ Erro no processamento do Shopify Function:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
