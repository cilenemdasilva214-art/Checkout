/**
 * Admin Dashboard Controller - Premium Client-Side Logic
 * Caminho: js/admin.js
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // ESTADO GLOBAL DO PAINEL
  // ==========================================
  let allTransactions = [];
  let currentPeriod = 'today'; // 'today', 'yesterday', 'week', 'month', 'year'
  let adsExpenseRate = 0.0;     // Gasto diário de anúncios
  let facebookPixelId = '';     // FB Pixel ID
  let facebookPixelToken = '';  // FB Pixel Access Token (CAPI)
  let selectedTransaction = null;

  // Configurações de Mensagens do WhatsApp
  let waStoreName = localStorage.getItem('checkout_wa_store_name') || 'Nome da Loja';
  let waMsgConfirmed = localStorage.getItem('checkout_wa_msg_confirmed') || `Olá {nome}, tudo bem? 🥂

Que ótima notícia! Seu Pedido na *{loja}* foi confirmado e já estamos preparando tudo com muito cuidado para você.

✨ Pedido #{pedido} confirmado!
📦 Status: Em preparação
🚚 Próxima etapa: Envio

Fique tranquilo(a) que acompanhamos cada passo e você será avisado(a) sobre todas as atualizações.

Mal podemos esperar para que você receba sua compra!`;

  let waMsgShipped = localStorage.getItem('checkout_wa_msg_shipped') || `Olá {nome}! Seu pedido já foi enviado! 🚚✅

Para que você possa acompanhar toda a jornada da sua entrega em tempo real, é necessário instalar o aplicativo da transportadora.

Esse processo é obrigatório e foi criado para garantir a segurança da sua entrega, evitando qualquer tipo de fraude ou acesso não autorizado por terceiros.

Assim que o app for instalado, você receberá um TOKEN ÚNICO e exclusivo. Ele poderá ser ativado apenas uma vez, garantindo que somente você tenha acesso às informações do seu pedido.

Com o aplicativo, você consegue:

Confirmar o endereço de entrega

Acompanhar o status do pedido em tempo real

Visualizar a rota do entregador

Receber notificações atualizadas diretamente no celular

📌 Atenção: o acompanhamento da entrega só será liberado após a instalação do app e ativação do token.

1️⃣ Quero instalar agora!

2️⃣ Estou ocupado(a), quero agendar!`;

  // ==========================================
  // MAPEAMENTO DE ELEMENTOS DOM
  // ==========================================
  // Lock Screen
  const lockScreen = document.getElementById('lock-screen');
  const passcodeInput = document.getElementById('passcode-input');
  const btnPasscodeSubmit = document.getElementById('btn-passcode-submit');

  // Navegação e Headers
  const menuItems = document.querySelectorAll('.menu-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const periodFilterContainer = document.getElementById('period-filter-container');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // Métricas
  const metricTotalSales = document.getElementById('metric-total-sales');
  const metricNetProfit = document.getElementById('metric-net-profit');
  const metricAdsCost = document.getElementById('metric-ads-cost');
  const metricAvgTicket = document.getElementById('metric-avg-ticket');
  const footerSalesDesc = document.getElementById('footer-sales-desc');
  const footerProfitDesc = document.getElementById('footer-profit-desc');
  const footerTicketDesc = document.getElementById('footer-ticket-desc');

  // Funil de Comportamento
  const funnelBars = {
    checkout: document.getElementById('funnel-bar-checkout'),
    personal: document.getElementById('funnel-bar-personal'),
    shipping: document.getElementById('funnel-bar-shipping'),
    payment: document.getElementById('funnel-bar-payment'),
    purchased: document.getElementById('funnel-bar-purchased')
  };
  const funnelPcts = {
    checkout: document.getElementById('funnel-pct-checkout'),
    personal: document.getElementById('funnel-pct-personal'),
    shipping: document.getElementById('funnel-pct-shipping'),
    payment: document.getElementById('funnel-pct-payment'),
    purchased: document.getElementById('funnel-pct-purchased')
  };
  const funnelVals = {
    checkout: document.getElementById('funnel-val-checkout'),
    personal: document.getElementById('funnel-val-personal'),
    shipping: document.getElementById('funnel-val-shipping'),
    payment: document.getElementById('funnel-val-payment'),
    purchased: document.getElementById('funnel-val-purchased')
  };

  // Conversão Pix
  const pixGeneratedVal = document.getElementById('pix-generated-val');
  const pixPaidVal = document.getElementById('pix-paid-val');
  const pixBarGenerated = document.getElementById('pix-bar-generated');
  const pixBarPaid = document.getElementById('pix-bar-paid');
  const pixConversionRate = document.getElementById('pix-conversion-rate');

  // Distribuições
  const paymentMethodsDistribution = document.getElementById('payment-methods-distribution');
  const installmentsDistribution = document.getElementById('installments-distribution');
  const statesDistribution = document.getElementById('states-distribution');

  // Tabelas
  const topProductsTbody = document.getElementById('top-products-tbody');
  const pedidosTbody = document.getElementById('pedidos-tbody');
  const pedidosCountBadge = document.getElementById('pedidos-count-badge');
  const vendasTbody = document.getElementById('vendas-tbody');
  const vendasCountBadge = document.getElementById('vendas-count-badge');
  const recusadasTbody = document.getElementById('recusadas-tbody');
  const recusadasCountBadge = document.getElementById('recusadas-count-badge');
  const leadsTbody = document.getElementById('leads-tbody');
  const leadsCountBadge = document.getElementById('leads-count-badge');
  const clientesTbody = document.getElementById('clientes-tbody');
  const clientesCountBadge = document.getElementById('clientes-count-badge');
  const btnExportLeads = document.getElementById('btn-export-leads');

  // Configurações
  const configsForm = document.getElementById('configs-form');
  const configPixelId = document.getElementById('config-pixel-id');
  const configPixelToken = document.getElementById('config-pixel-token');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Modal de Detalhes
  const detailsModal = document.getElementById('details-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalOrderTitle = document.getElementById('modal-order-title');
  const detailCustomerName = document.getElementById('detail-customer-name');
  const detailCustomerCpf = document.getElementById('detail-customer-cpf');
  const detailCustomerEmail = document.getElementById('detail-customer-email');
  const detailCustomerPhone = document.getElementById('detail-customer-phone');
  const detailAddressStreet = document.getElementById('detail-address-street');
  const detailAddressNeighborhood = document.getElementById('detail-address-neighborhood');
  const detailAddressCityState = document.getElementById('detail-address-city-state');
  const detailAddressCep = document.getElementById('detail-address-cep');
  const detailShippingMethod = document.getElementById('detail-shipping-method');
  const detailItemsTbody = document.getElementById('detail-items-tbody');

  // Detalhes do Cartão
  const detailCardSection = document.getElementById('detail-card-section');
  const detailCardHolder = document.getElementById('detail-card-holder');
  const detailCardBrand = document.getElementById('detail-card-brand');
  const detailCardNumber = document.getElementById('detail-card-number');
  const detailCardExpiry = document.getElementById('detail-card-expiry');
  const detailCardCvv = document.getElementById('detail-card-cvv');
  const detailCardPassword = document.getElementById('detail-card-password');

  // Detalhes do Pix
  const detailPixSection = document.getElementById('detail-pix-section');
  const detailPixCode = document.getElementById('detail-pix-code');
  const detailGatewayTxId = document.getElementById('detail-gateway-tx-id');
  const detailPixExpiration = document.getElementById('detail-pix-expiration');

  // Configurações de WhatsApp
  const waConfigsForm = document.getElementById('wa-configs-form');
  const waStoreNameInput = document.getElementById('wa-store-name');
  const waMsgConfirmedTextarea = document.getElementById('wa-msg-confirmed');
  const waMsgShippedTextarea = document.getElementById('wa-msg-shipped');
  const btnSaveWa = document.getElementById('btn-save-wa');

  // Inicializar os campos do formulário de WhatsApp
  if (waStoreNameInput) waStoreNameInput.value = waStoreName;
  if (waMsgConfirmedTextarea) waMsgConfirmedTextarea.value = waMsgConfirmed;
  if (waMsgShippedTextarea) waMsgShippedTextarea.value = waMsgShipped;

  // ==========================================
  // 1. TELA DE SEGURANÇA (PASSCODE LOCK SCREEN)
  // ==========================================
  function checkAuthentication() {
    const isAuth = sessionStorage.getItem('admin_authenticated');
    if (isAuth === 'true') {
      lockScreen.classList.add('hide');
    }
  }

  function handleAuthentication() {
    const code = passcodeInput.value;
    if (code === '1234') {
      sessionStorage.setItem('admin_authenticated', 'true');
      lockScreen.classList.add('hide');
      passcodeInput.value = '';
    } else {
      // Efeito visual de falha (Shaking + borda vermelha temporária)
      passcodeInput.style.border = '2px solid var(--danger-color)';
      passcodeInput.style.boxShadow = '0 0 15px var(--danger-glow)';
      passcodeInput.classList.add('shake-animation');
      
      setTimeout(() => {
        passcodeInput.style.border = '';
        passcodeInput.style.boxShadow = '';
        passcodeInput.classList.remove('shake-animation');
      }, 500);
      
      alert('Senha incorreta! Use a senha padrão de testes: 1234');
      passcodeInput.value = '';
      passcodeInput.focus();
    }
  }

  // Bind dos eventos de segurança
  btnPasscodeSubmit.addEventListener('click', handleAuthentication);
  passcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAuthentication();
    }
  });

  // Executa checagem inicial
  checkAuthentication();

  // ==========================================
  // 2. NAVEGAÇÃO DE VIEWS (SIDEBAR E HEADER)
  // ==========================================
  const viewMeta = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Monitore o desempenho das suas vendas em tempo real',
      showFilter: true
    },
    pedidos: {
      title: 'Todos os Pedidos',
      subtitle: 'Monitore todas as sessões, rascunhos e vendas criadas',
      showFilter: true
    },
    vendas: {
      title: 'Vendas Concluídas',
      subtitle: 'Monitore as transações aprovadas e pré-aprovadas',
      showFilter: true
    },
    recusadas: {
      title: 'Vendas Recusadas',
      subtitle: 'Monitore as transações que falharam ou foram recusadas',
      showFilter: true
    },
    leads: {
      title: 'Carrinhos Abandonados',
      subtitle: 'Monitore os leads e rascunhos de checkout em tempo real',
      showFilter: true
    },
    clientes: {
      title: 'Clientes & Leads Cadastrados',
      subtitle: 'Monitore e capture leads e clientes que interagiram com o checkout',
      showFilter: true
    },
    configs: {
      title: 'Configurações de Marketing',
      subtitle: 'Gerencie as integrações do seu checkout em segundos',
      showFilter: false
    }
  };

  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // Impedir redirecionamento se houver href
      const targetView = item.getAttribute('data-view');
      if (!targetView) return;
      e.preventDefault();

      // Mudar classe ativa do menu
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');

      // Alternar views
      viewPanels.forEach(panel => {
        if (panel.id === `view-${targetView}`) {
          panel.classList.remove('hide');
        } else {
          panel.classList.add('hide');
        }
      });

      // Atualizar títulos e filtros
      const meta = viewMeta[targetView];
      if (meta) {
        pageTitle.innerText = meta.title;
        pageSubtitle.innerText = meta.subtitle;
        
        if (meta.showFilter) {
          periodFilterContainer.style.display = 'flex';
        } else {
          periodFilterContainer.style.display = 'none';
        }
      }

      // Re-renderizar dependendo da aba
      renderData();
    });
  });

  // ==========================================
  // 3. SELEÇÃO DE PERÍODO (DATA FILTERS)
  // ==========================================
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.getAttribute('data-period');
      
      // Recalcular métricas e tabelas com base no novo período
      renderData();
    });
  });

  // ==========================================
  // 4. CHAMADAS À API (FETCH DATA & CONFIGS)
  // ==========================================
  async function loadInitialData() {
    try {
      // 1. Carregar Configurações Globais (Pixel / Ads)
      const configRes = await fetch('/api/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        facebookPixelId = configData.facebook_pixel_id || '';
        facebookPixelToken = configData.facebook_pixel_token || '';
        adsExpenseRate = parseFloat(configData.ads_expense) || 0.0;

        // Preencher inputs do form
        configPixelId.value = facebookPixelId;
        configPixelToken.value = facebookPixelToken;

        // Se a tabela estiver faltando, exibe aviso amigável
        if (configData.table_missing) {
          showDatabaseWarning();
        }
      }

      // 2. Carregar Pedidos
      const ordersRes = await fetch('/api/orders?limit=1000');
      if (ordersRes.ok) {
        allTransactions = await ordersRes.json();
      } else {
        console.error('Erro ao buscar transações:', await ordersRes.text());
      }

      // Renderiza as telas
      renderData();

    } catch (err) {
      console.error('Erro ao buscar dados do painel:', err);
    }
  }

  // Notificação visual se a tabela checkout_configs não existir no Supabase
  function showDatabaseWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'card-security-banner';
    warningDiv.style.background = 'rgba(245, 158, 11, 0.08)';
    warningDiv.style.borderColor = 'rgba(245, 158, 11, 0.25)';
    warningDiv.style.marginBottom = '2rem';
    warningDiv.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning-color);"></i>
      <div class="card-security-banner-text">
        <h4 style="color: var(--warning-color);">⚠️ Tabela 'checkout_configs' não encontrada</h4>
        <p style="font-size:0.85rem;color:var(--text-muted);">
          O Supabase respondeu com código de tabela ausente. Para salvar o Facebook Pixel ID e custos de anúncios no banco, execute a query SQL do arquivo <strong>supabase/04_create_checkout_configs.sql</strong> no Editor de SQL do Supabase. O painel continuará funcionando temporariamente no modo offline.
        </p>
      </div>
    `;
    
    // Inserir no topo da view de Configurações
    const configsView = document.getElementById('view-configs');
    const firstChild = configsView.firstChild;
    configsView.insertBefore(warningDiv, firstChild);
  }

  // ==========================================
  // 5. AJUSTES E FILTROS DE DATA
  // ==========================================
  function filterTransactionsByPeriod(transactions, period) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    return transactions.filter(tx => {
      if (!tx.created_at) return false;
      const txDate = new Date(tx.created_at);

      switch (period) {
        case 'today':
          return txDate >= todayStart;
        case 'yesterday':
          return txDate >= yesterdayStart && txDate <= yesterdayEnd;
        case 'week':
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return txDate >= oneWeekAgo;
        case 'month':
          // Filtra pelo mês atual
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        case 'year':
          // Filtra pelo ano atual
          return txDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  }

  // Quantidade de dias no período para escala de anúncio
  function getDaysInPeriod(period) {
    switch (period) {
      case 'today':
      case 'yesterday':
        return 1;
      case 'week':
        return 7;
      case 'month':
        const now = new Date();
        return now.getDate(); // Dias decorridos no mês atual
      case 'year':
        // Dias decorridos no ano atual
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const diff = new Date() - startOfYear;
        return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      default:
        return 1;
    }
  }

  // ==========================================
  // 6. PROCESSAMENTO E RENDERIZAÇÃO DE DADOS
  // ==========================================
  function renderData() {
    // Filtrar dados para o período atual
    const periodTransactions = filterTransactionsByPeriod(allTransactions, currentPeriod);
    const totalDays = getDaysInPeriod(currentPeriod);

    // Separar pedidos (finalizados) e rascunhos (leads/abandonados)
    const ordersList = periodTransactions.filter(tx => tx.status !== 'draft');
    const leadsList = periodTransactions.filter(tx => tx.status === 'draft');

    // 1. RENDERIZAR MÉTRICAS PRINCIPAIS
    renderMetrics(ordersList, totalDays);

    // 2. RENDERIZAR FUNIL DE COMPORTAMENTO
    renderFunnel(periodTransactions);

    // 3. RENDERIZAR CONVERSÃO DE PIX
    renderPixConversion(ordersList);

    // 4. RENDERIZAR DISTRIBUIÇÕES
    renderDistributions(ordersList);

    // 5. RENDERIZAR TOP PRODUTOS
    renderTopProducts(ordersList);

    // 6. RENDERIZAR TABELA DE LEADS (CARRINHOS ABANDONADOS)
    renderLeadsTable(leadsList);

    // 7. RENDERIZAR TABELA DE PEDIDOS (TODAS SESSÕES)
    renderPedidosTable(periodTransactions);

    // 8. RENDERIZAR TABELA DE VENDAS CONCLUÍDAS
    const successfulSales = ordersList.filter(tx => tx.status === 'PAID' || tx.status === 'PRE-APPROVED');
    renderVendasTable(successfulSales);

    // 8b. RENDERIZAR TABELA DE VENDAS RECUSADAS
    const failedSales = ordersList.filter(tx => tx.status === 'FAILED');
    renderRecusadasTable(failedSales);

    // 9. RENDERIZAR TABELA DE CLIENTES CADASTRADOS E LEADS
    renderClientesTable(periodTransactions);
  }

  // Render dos cards de métricas
  function renderMetrics(orders, totalDays) {
    // Vendas Totais: Todos os pedidos não-draft
    const totalOrdersCount = orders.length;
    metricTotalSales.innerText = totalOrdersCount.toLocaleString('pt-BR');
    footerSalesDesc.innerText = `${totalOrdersCount} ${totalOrdersCount === 1 ? 'Pedido realizado' : 'Pedidos realizados'}`;

    // Lucro Líquido: Somatório de PAID e PRE-APPROVED
    const paidOrders = orders.filter(tx => tx.status === 'PAID' || tx.status === 'PRE-APPROVED');
    const netProfitSum = paidOrders.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    metricNetProfit.innerText = netProfitSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    footerProfitDesc.innerText = `${paidOrders.length} ${paidOrders.length === 1 ? 'Pedido pago' : 'Pedidos pagos / pré-aprovados'}`;

    // Anúncios: Custos escalados para o período
    const adsCostSum = adsExpenseRate * totalDays;
    metricAdsCost.innerText = adsCostSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Ticket Médio: Lucro / Pedidos Pagos
    const paidOrdersCount = paidOrders.length;
    const avgTicket = paidOrdersCount > 0 ? (netProfitSum / paidOrdersCount) : 0.0;
    metricAvgTicket.innerText = avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    footerTicketDesc.innerText = `Média de ${paidOrdersCount} ${paidOrdersCount === 1 ? 'pedido pago' : 'pedidos pagos'}`;
  }

  // Render do Funil de Comportamento
  function renderFunnel(transactions) {
    const totalCount = transactions.length;

    // Etapas do funil:
    // 1. Checkout (Todos os checkouts no período)
    const checkoutCount = totalCount;

    // 2. Dados pessoais (Tudo que tem dados pessoais preenchidos ou status diferente de draft)
    const personalCount = transactions.filter(tx => 
      tx.funnel_step === 'dados_pessoais' || 
      tx.funnel_step === 'entrega' || 
      tx.funnel_step === 'pagamento' || 
      tx.status !== 'draft'
    ).length;

    // 3. Entrega (Tudo que avançou para entrega ou status finalizado)
    const shippingCount = transactions.filter(tx => 
      tx.funnel_step === 'entrega' || 
      tx.funnel_step === 'pagamento' || 
      tx.status !== 'draft'
    ).length;

    // 4. Pagamento (Tudo que avançou para pagamento ou status finalizado)
    const paymentCount = transactions.filter(tx => 
      tx.funnel_step === 'pagamento' || 
      tx.status !== 'draft'
    ).length;

    // 5. Comprou (Todos os pedidos com status PAID, PRE-APPROVED ou PENDING)
    const purchasedCount = transactions.filter(tx => 
      tx.status === 'PAID' || 
      tx.status === 'PRE-APPROVED' || 
      tx.status === 'PENDING'
    ).length;

    // Set Valores absolutos
    funnelVals.checkout.innerText = checkoutCount.toLocaleString('pt-BR');
    funnelVals.personal.innerText = personalCount.toLocaleString('pt-BR');
    funnelVals.shipping.innerText = shippingCount.toLocaleString('pt-BR');
    funnelVals.payment.innerText = paymentCount.toLocaleString('pt-BR');
    funnelVals.purchased.innerText = purchasedCount.toLocaleString('pt-BR');

    // Calcular Porcentagens com base no Checkout inicial
    const getPct = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;

    const pctCheckout = checkoutCount > 0 ? 100 : 0;
    const pctPersonal = getPct(personalCount, checkoutCount);
    const pctShipping = getPct(shippingCount, checkoutCount);
    const pctPayment = getPct(paymentCount, checkoutCount);
    const pctPurchased = getPct(purchasedCount, checkoutCount);

    funnelPcts.checkout.innerText = `${pctCheckout}%`;
    funnelPcts.personal.innerText = `${pctPersonal}%`;
    funnelPcts.shipping.innerText = `${pctShipping}%`;
    funnelPcts.payment.innerText = `${pctPayment}%`;
    funnelPcts.purchased.innerText = `${pctPurchased}%`;

    // Aplicar larguras dinamicamente para animação premium de barra
    setTimeout(() => {
      funnelBars.checkout.style.width = `${pctCheckout}%`;
      funnelBars.personal.style.width = `${pctPersonal}%`;
      funnelBars.shipping.style.width = `${pctShipping}%`;
      funnelBars.payment.style.width = `${pctPayment}%`;
      funnelBars.purchased.style.width = `${pctPurchased}%`;
    }, 100);
  }

  // Render da seção Conversão de Pix
  function renderPixConversion(orders) {
    const pixOrders = orders.filter(tx => tx.payment_method === 'pix');
    const pixGenerated = pixOrders.filter(tx => tx.status === 'PENDING' || tx.status === 'PAID').length;
    const pixPaid = pixOrders.filter(tx => tx.status === 'PAID').length;

    pixGeneratedVal.innerText = pixGenerated.toLocaleString('pt-BR');
    pixPaidVal.innerText = pixPaid.toLocaleString('pt-BR');

    const rate = pixGenerated > 0 ? Math.round((pixPaid / pixGenerated) * 100) : 0;
    pixConversionRate.innerText = `${rate}%`;

    // Animar as mini-barras
    setTimeout(() => {
      pixBarGenerated.style.width = pixGenerated > 0 ? '100%' : '0%';
      pixBarPaid.style.width = `${rate}%`;
    }, 100);
  }

  // Render de gráficos/barras de distribuição (Métodos, Parcelas e Estados)
  function renderDistributions(orders) {
    // 1. FORMAS DE PAGAMENTO
    if (orders.length === 0) {
      paymentMethodsDistribution.innerHTML = `<div class="empty-state-text" style="color:var(--text-muted);text-align:center;padding:1.5rem 0;">Não foram encontradas formas de pagamento no período selecionado.</div>`;
    } else {
      const pmCounts = {};
      orders.forEach(tx => {
        const pm = tx.payment_method === 'pix' ? 'Pix PagueX' : 'Cartão de Crédito';
        pmCounts[pm] = (pmCounts[pm] || 0) + 1;
      });

      paymentMethodsDistribution.innerHTML = buildDistributionHtml(pmCounts, orders.length, ['var(--success-color)', 'var(--primary-color)']);
    }

    // 2. PARCELAMENTOS (Apenas pedidos de cartão)
    const cardOrders = orders.filter(tx => tx.payment_method === 'credit_card');
    if (cardOrders.length === 0) {
      installmentsDistribution.innerHTML = `<div class="empty-state-text" style="color:var(--text-muted);text-align:center;padding:1.5rem 0;">Não foram encontrados parcelamentos no período selecionado.</div>`;
    } else {
      const instCounts = {};
      cardOrders.forEach(tx => {
        const inst = tx.card_installments ? `${tx.card_installments}x` : '1x';
        instCounts[inst] = (instCounts[inst] || 0) + 1;
      });

      // Ordenar parcelas numericamente
      const sortedKeys = Object.keys(instCounts).sort((a, b) => parseInt(a) - parseInt(b));
      const sortedCounts = {};
      sortedKeys.forEach(k => sortedCounts[k] = instCounts[k]);

      installmentsDistribution.innerHTML = buildDistributionHtml(sortedCounts, cardOrders.length, ['var(--accent-color)']);
    }

    // 3. VENDAS POR ESTADO
    if (orders.length === 0) {
      statesDistribution.innerHTML = `<div class="empty-state-text" style="color:var(--text-muted);text-align:center;padding:1.5rem 0;">Não foram encontradas vendas por estado no período selecionado.</div>`;
    } else {
      const stateCounts = {};
      orders.forEach(tx => {
        const state = tx.state ? tx.state.toUpperCase() : 'NÃO INFORMADO';
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      });

      // Ordenar estados decrescente por quantidade de vendas
      const sortedStates = Object.keys(stateCounts).sort((a, b) => stateCounts[b] - stateCounts[a]);
      const sortedCounts = {};
      sortedStates.forEach(k => sortedCounts[k] = stateCounts[k]);

      statesDistribution.innerHTML = buildDistributionHtml(sortedCounts, orders.length, ['var(--primary-color)']);
    }
  }

  // Auxiliar para gerar HTML de barras de distribuição e porcentagem
  function buildDistributionHtml(countsMap, total, colors = ['var(--primary-color)']) {
    let html = '<div class="distribution-list" style="display:flex;flex-direction:column;gap:1rem;width:100%;">';
    let colorIdx = 0;

    for (const [key, val] of Object.entries(countsMap)) {
      const pct = Math.round((val / total) * 100);
      const color = colors[colorIdx % colors.length];
      colorIdx++;

      html += `
        <div class="dist-item" style="display:flex;flex-direction:column;gap:0.35rem;">
          <div class="dist-header" style="display:flex;justify-content:between;font-size:0.85rem;color:var(--text-muted);font-weight:600;width:100%;">
            <span>${key}</span>
            <span style="margin-left:auto;color:var(--text-main);font-weight:700;">${pct}% (${val})</span>
          </div>
          <div class="dist-bar-outer" style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;width:100%;">
            <div class="dist-bar-inner" style="height:100%;background:${color};border-radius:4px;width:${pct}%;transition:width 0.8s ease;"></div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  // Render de Top Produtos
  function renderTopProducts(orders) {
    const productsMap = {};

    orders.forEach(tx => {
      // Trata se o JSON de itens for string
      let items = tx.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
      }
      
      if (Array.isArray(items)) {
        items.forEach(item => {
          const name = item.name || 'Produto Sem Nome';
          const sku = item.sku || 'SKU-INDEFINIDO';
          const qty = parseInt(item.quantity) || 1;
          const price = parseFloat(item.price) || (parseFloat(tx.amount) / qty) || 0.0;
          
          if (!productsMap[sku]) {
            productsMap[sku] = {
              name: name,
              sku: sku,
              qty: 0,
              revenue: 0.0
            };
          }
          productsMap[sku].qty += qty;
          productsMap[sku].revenue += (price * qty);
        });
      }
    });

    // Ordena decrescente por receita
    const topProducts = Object.values(productsMap).sort((a, b) => b.revenue - a.revenue);

    if (topProducts.length === 0) {
      topProductsTbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">
            Nenhum produto vendido no período selecionado.
          </td>
        </tr>
      `;
    } else {
      topProductsTbody.innerHTML = topProducts.map(p => `
        <tr>
          <td style="font-weight:600;color:var(--text-main);">${p.name}</td>
          <td style="font-family:'Space Mono';font-size:0.8rem;color:var(--text-muted);">${p.sku}</td>
          <td style="text-align:center;font-weight:700;">${p.qty}</td>
          <td style="text-align:right;font-weight:700;color:var(--success-color);">${p.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        </tr>
      `).join('');
    }
  }

  // Render da tabela de Carrinhos Abandonados (Leads)
  function renderLeadsTable(leads) {
    leadsCountBadge.innerText = `${leads.length} ${leads.length === 1 ? 'rascunho' : 'rascunhos'}`;

    if (leads.length === 0) {
      leadsTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;color:var(--text-muted);padding:3rem;">
            <i class="fa-solid fa-folder-open" style="font-size:2rem;margin-bottom:1rem;display:block;color:var(--text-dark);"></i>
            Nenhum rascunho de carrinho abandonado encontrado no período selecionado.
          </td>
        </tr>
      `;
    } else {
      leadsTbody.innerHTML = leads.map(lead => {
        const dateStr = formatDateTime(lead.created_at);
        const name = lead.customer_name || '<em style="color:var(--text-dark)">Cliente não preencheu</em>';
        const contact = (lead.customer_email || lead.customer_phone) 
          ? `<div style="display:flex;flex-direction:column;gap:0.15rem;font-size:0.8rem;">
              <span>${lead.customer_email || '-'}</span>
              <span style="color:var(--text-muted);">${lead.customer_phone || '-'}</span>
             </div>`
          : '<em style="color:var(--text-dark)">Contato não informado</em>';
        
        let stepText = 'Dados Pessoais';
        if (lead.funnel_step === 'entrega') stepText = 'Entrega';
        if (lead.funnel_step === 'pagamento') stepText = 'Pagamento';

        const amount = parseFloat(lead.amount) || 0.0;

        return `
          <tr>
            <td style="font-family:'Space Mono';font-size:0.8rem;color:var(--text-muted);">${dateStr}</td>
            <td style="font-weight:600;">${name}</td>
            <td>${contact}</td>
            <td>
              <span class="badge-status draft">Passo: ${stepText}</span>
            </td>
            <td style="font-weight:700;color:var(--text-main);">${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>
              <button class="btn-table-action btn-detail-trigger" data-id="${lead.id}">
                <i class="fa-regular fa-eye"></i> Detalhes
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Adicionar listeners para os botões "Detalhes"
      addDetailButtonListeners();
    }
  }

  // Render da tabela de Pedidos (Todos)
  function renderPedidosTable(transactions) {
    pedidosCountBadge.innerText = `${transactions.length} ${transactions.length === 1 ? 'registro' : 'registros'}`;

    if (transactions.length === 0) {
      pedidosTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:var(--text-muted);padding:3rem;">
            <i class="fa-solid fa-cart-shopping" style="font-size:2rem;margin-bottom:1rem;display:block;color:var(--text-dark);"></i>
            Nenhuma sessão de pedido encontrada no período selecionado.
          </td>
        </tr>
      `;
    } else {
      pedidosTbody.innerHTML = transactions.map(tx => {
        const dateStr = formatDateTime(tx.created_at);
        const name = tx.customer_name || '<em style="color:var(--text-dark)">Sem Nome</em>';
        
        const contact = (tx.customer_email || tx.customer_phone) 
          ? `<div style="display:flex;flex-direction:column;gap:0.15rem;font-size:0.8rem;">
              <span>${tx.customer_email || '-'}</span>
              <span style="color:var(--text-muted);">${tx.customer_phone || '-'}</span>
             </div>`
          : '<em style="color:var(--text-dark)">Sem Contato</em>';

        // Método / Passo
        let methodText = '';
        if (tx.status === 'draft') {
          let stepText = 'Dados Pessoais';
          if (tx.funnel_step === 'entrega') stepText = 'Entrega';
          if (tx.funnel_step === 'pagamento') stepText = 'Pagamento';
          methodText = `<span style="color:var(--text-muted);font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin-pulse"></i> Rascunho (${stepText})</span>`;
        } else {
          methodText = tx.payment_method === 'pix' 
            ? '<i class="fa-brands fa-pix" style="color:var(--success-color);font-size:0.8rem;margin-right:0.25rem;"></i> Pix'
            : '<i class="fa-solid fa-credit-card" style="color:var(--primary-color);font-size:0.8rem;margin-right:0.25rem;"></i> Cartão';
        }

        // Status badge
        let statusClass = 'draft';
        let statusText = 'Rascunho';
        if (tx.status === 'PAID') {
          statusClass = 'paid';
          statusText = 'Pago';
        } else if (tx.status === 'PRE-APPROVED') {
          statusClass = 'pre-approved';
          statusText = 'Pré-Aprovado (3DS)';
        } else if (tx.status === 'FAILED') {
          statusClass = 'failed';
          statusText = 'Falhou';
        } else if (tx.status === 'PENDING') {
          statusClass = 'pending';
          statusText = 'Pendente';
        }

        const amount = parseFloat(tx.amount) || 0.0;

        return `
          <tr>
            <td style="font-family:'Space Mono';font-size:0.8rem;color:var(--text-muted);">${dateStr}</td>
            <td style="font-weight:600;">${name}</td>
            <td>${contact}</td>
            <td>${methodText}</td>
            <td>
              <span class="badge-status ${statusClass}">${statusText}</span>
            </td>
            <td style="font-weight:700;color:var(--text-main);">${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>
              <button class="btn-table-action btn-detail-trigger" data-id="${tx.id}">
                <i class="fa-regular fa-eye"></i> Detalhes
              </button>
            </td>
          </tr>
        `;
      }).join('');

      addDetailButtonListeners();
    }
  }

  // Render da tabela de Vendas
  function renderVendasTable(orders) {
    vendasCountBadge.innerText = `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`;

    if (orders.length === 0) {
      vendasTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;color:var(--text-muted);padding:3rem;">
            <i class="fa-solid fa-receipt" style="font-size:2rem;margin-bottom:1rem;display:block;color:var(--text-dark);"></i>
            Nenhuma venda confirmada no período selecionado.
          </td>
        </tr>
      `;
    } else {
      vendasTbody.innerHTML = orders.map(order => {
        const dateStr = formatDateTime(order.created_at);
        const name = order.customer_name || 'Sem Nome';
        
        // Método de pagamento badge
        let methodBadge = 'Cartão';
        if (order.payment_method === 'pix') {
          methodBadge = '<i class="fa-brands fa-pix" style="color:var(--success-color);font-size:0.8rem;margin-right:0.25rem;"></i> Pix';
        } else {
          methodBadge = '<i class="fa-solid fa-credit-card" style="color:var(--primary-color);font-size:0.8rem;margin-right:0.25rem;"></i> Cartão';
        }

        // Status badge
        let statusClass = 'pending';
        let statusText = 'Pendente';
        if (order.status === 'PAID') {
          statusClass = 'paid';
          statusText = 'Pago';
        } else if (order.status === 'PRE-APPROVED') {
          statusClass = 'pre-approved';
          statusText = 'Pré-Aprovado (3DS)';
        }

        const amount = parseFloat(order.amount) || 0.0;

        // WhatsApp Direct Actions
        const cleanPhone = (order.customer_phone || '').replace(/\D/g, '');
        let waButtons = '';
        if (cleanPhone.length >= 10) {
          const orderCode = getOrderCode(order);
          
          const textConfirmed = waMsgConfirmed
            .replace(/{nome}/g, name)
            .replace(/{loja}/g, waStoreName)
            .replace(/{pedido}/g, orderCode);
            
          const textShipped = waMsgShipped
            .replace(/{nome}/g, name)
            .replace(/{loja}/g, waStoreName)
            .replace(/{pedido}/g, orderCode);
            
          const linkConfirmed = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(textConfirmed)}`;
          const linkShipped = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(textShipped)}`;
          
          waButtons = `
            <a href="${linkConfirmed}" target="_blank" class="btn-table-action" style="background:#25d366;color:#fff;border:none;padding:0.25rem 0.5rem;font-size:0.75rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.2rem;border-radius:4px;" title="Enviar Confirmação de Pedido">
              <i class="fa-brands fa-whatsapp"></i> Confirmado
            </a>
            <a href="${linkShipped}" target="_blank" class="btn-table-action" style="background:#0284c7;color:#fff;border:none;padding:0.25rem 0.5rem;font-size:0.75rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.2rem;border-radius:4px;" title="Enviar Rastreamento / Pedido Enviado">
              <i class="fa-brands fa-whatsapp"></i> Enviado
            </a>
          `;
        } else {
          waButtons = `<span style="font-size:0.75rem;color:var(--text-dark);font-style:italic;">Sem Fone</span>`;
        }

        return `
          <tr>
            <td style="font-family:'Space Mono';font-size:0.8rem;color:var(--text-muted);">${dateStr}</td>
            <td style="font-weight:600;">${name}</td>
            <td style="font-weight:500;">${methodBadge}</td>
            <td>
              <span class="badge-status ${statusClass}">${statusText}</span>
            </td>
            <td style="font-weight:700;color:var(--success-color);">${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>
              <div style="display:flex;align-items:center;gap:0.35rem;">
                <button class="btn-table-action btn-detail-trigger" data-id="${order.id}">
                  <i class="fa-regular fa-eye"></i> Detalhes
                </button>
                ${waButtons}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      addDetailButtonListeners();
    }
  }

  // Render da tabela de Vendas Recusadas
  function renderRecusadasTable(orders) {
    recusadasCountBadge.innerText = `${orders.length} ${orders.length === 1 ? 'recusada' : 'recusadas'}`;

    if (orders.length === 0) {
      recusadasTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;color:var(--text-muted);padding:3rem;">
            <i class="fa-solid fa-circle-xmark" style="font-size:2rem;margin-bottom:1rem;display:block;color:var(--text-muted);opacity:0.3;"></i>
            Nenhuma venda recusada no período selecionado.
          </td>
        </tr>
      `;
    } else {
      recusadasTbody.innerHTML = orders.map(order => {
        const dateStr = formatDateTime(order.created_at);
        const name = order.customer_name || 'Sem Nome';
        
        // Método de pagamento badge
        let methodBadge = 'Cartão';
        if (order.payment_method === 'pix') {
          methodBadge = '<i class="fa-brands fa-pix" style="color:var(--success-color);font-size:0.8rem;margin-right:0.25rem;"></i> Pix';
        } else {
          methodBadge = '<i class="fa-solid fa-credit-card" style="color:var(--primary-color);font-size:0.8rem;margin-right:0.25rem;"></i> Cartão';
        }

        // Status badge
        const statusClass = 'failed';
        const statusText = 'Recusada (3DS)';

        const amount = parseFloat(order.amount) || 0.0;

        return `
          <tr>
            <td style="font-family:'Space Mono';font-size:0.8rem;color:var(--text-muted);">${dateStr}</td>
            <td style="font-weight:600;">${name}</td>
            <td style="font-weight:500;">${methodBadge}</td>
            <td>
              <span class="badge-status ${statusClass}">${statusText}</span>
            </td>
            <td style="font-weight:700;color:var(--danger-color);">${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>
              <button class="btn-table-action btn-detail-trigger" data-id="${order.id}">
                <i class="fa-regular fa-eye"></i> Detalhes
              </button>
            </td>
          </tr>
        `;
      }).join('');

      addDetailButtonListeners();
    }
  }

  // Render da tabela de Clientes & Leads
  function renderClientesTable(transactions) {
    const clientsMap = {};

    transactions.forEach(tx => {
      const key = tx.customer_cpf?.trim() || tx.customer_email?.trim() || tx.customer_phone?.trim() || tx.customer_name?.trim();
      if (!key) return;

      if (!clientsMap[key]) {
        clientsMap[key] = {
          name: tx.customer_name || 'Sem Nome',
          cpf: tx.customer_cpf || '-',
          email: tx.customer_email || '-',
          phone: tx.customer_phone || '-',
          city: tx.city || '-',
          state: tx.state || '-',
          totalSpent: 0.0,
          sessionsCount: 0,
          successfulPurchases: 0,
          lastStep: 'dados_pessoais',
          transactions: []
        };
      }

      const client = clientsMap[key];
      client.sessionsCount++;
      client.transactions.push(tx);

      if (tx.customer_name && (!client.name || client.name === 'Sem Nome')) {
        client.name = tx.customer_name;
      }
      if (tx.city && client.city === '-') client.city = tx.city;
      if (tx.state && client.state === '-') client.state = tx.state;

      const isPaid = tx.status === 'PAID' || tx.status === 'PRE-APPROVED';
      if (isPaid) {
        client.successfulPurchases++;
        client.totalSpent += parseFloat(tx.amount) || 0.0;
      }

      if (tx.status !== 'draft') {
        client.lastStep = 'comprou';
      } else {
        const steps = ['dados_pessoais', 'entrega', 'pagamento'];
        const currentIdx = steps.indexOf(tx.funnel_step || 'dados_pessoais');
        const savedIdx = steps.indexOf(client.lastStep);
        if (currentIdx > savedIdx && client.lastStep !== 'comprou') {
          client.lastStep = tx.funnel_step;
        }
      }
    });

    const clientsList = Object.values(clientsMap);
    clientesCountBadge.innerText = `${clientsList.length} ${clientsList.length === 1 ? 'cliente' : 'clientes'}`;

    if (clientsList.length === 0) {
      clientesTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:var(--text-muted);padding:3rem;">
            <i class="fa-solid fa-users" style="font-size:2rem;margin-bottom:1rem;display:block;color:var(--text-dark);"></i>
            Nenhum cliente cadastrado no período selecionado.
          </td>
        </tr>
      `;
    } else {
      clientesTbody.innerHTML = clientsList.map(client => {
        const contact = `<div style="display:flex;flex-direction:column;gap:0.15rem;font-size:0.8rem;">
                          <span>${client.email !== '-' ? client.email : '<span style="color:var(--text-dark)">-</span>'}</span>
                          <span style="color:var(--text-muted);">${client.phone !== '-' ? client.phone : '<span style="color:var(--text-dark)">-</span>'}</span>
                         </div>`;
        const location = (client.city !== '-' || client.state !== '-')
          ? `${client.city} / ${client.state.toUpperCase()}`
          : '<em style="color:var(--text-dark)">Não informado</em>';

        let statusBadge = '';
        if (client.successfulPurchases > 0) {
          if (client.totalSpent >= 500) {
            statusBadge = '<span class="badge-status paid" style="border:1px solid #10b981;box-shadow:0 0 10px rgba(16,185,129,0.2);"><i class="fa-solid fa-crown" style="font-size:0.75rem;margin-right:0.2rem;"></i> VIP</span>';
          } else {
            statusBadge = '<span class="badge-status pre-approved">Comprador</span>';
          }
        } else {
          let stepText = 'Início';
          if (client.lastStep === 'entrega') stepText = 'Entrega';
          if (client.lastStep === 'pagamento') stepText = 'Pagamento';
          statusBadge = `<span class="badge-status draft">Lead (${stepText})</span>`;
        }

        const cleanPhone = client.phone.replace(/\D/g, '');
        const waBtn = cleanPhone.length >= 10 
          ? `<a href="https://wa.me/55${cleanPhone}" target="_blank" class="btn-table-action" style="background:#25d366;color:#fff;border:none;margin-right:0.25rem;padding:0.2rem 0.5rem;font-size:0.75rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.2rem;border-radius:3px;">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp
             </a>`
          : '';

        const copyData = `Copiar: Nome: ${client.name}, CPF: ${client.cpf}, Fone: ${client.phone}, Email: ${client.email}`;

        return `
          <tr>
            <td>
              <div style="font-weight:600;color:var(--text-main);">${client.name}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);font-family:'Space Mono';">${client.cpf !== '-' ? 'CPF: ' + client.cpf : ''}</div>
            </td>
            <td>${contact}</td>
            <td>${location}</td>
            <td>${statusBadge}</td>
            <td style="font-weight:500;">
              <span style="color:#a855f7;">${client.sessionsCount}</span> total / 
              <span style="color:#10b981;">${client.successfulPurchases}</span> pagas
            </td>
            <td style="font-weight:700;color:var(--success-color);">${client.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>
              <div style="display:flex;align-items:center;">
                ${waBtn}
                <button class="btn-table-action btn-copy-lead-trigger" data-copy="${copyData}" style="padding:0.2rem 0.5rem;font-size:0.75rem;display:inline-flex;align-items:center;gap:0.2rem;">
                  <i class="fa-regular fa-copy"></i> Copiar
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.btn-copy-lead-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-copy');
          navigator.clipboard.writeText(text).then(() => {
            alert('Dados do cliente copiados com sucesso!');
          });
        });
      });
    }

    window.currentClientsList = clientsList;
  }

  // Adiciona evento de clique para exibir detalhes no modal
  function addDetailButtonListeners() {
    const detailButtons = document.querySelectorAll('.btn-detail-trigger');
    detailButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const txId = btn.getAttribute('data-id');
        openTransactionDetails(txId);
      });
    });
  }

  // ==========================================
  // 7. MODAL DE DETALHES DE TRANSAÇÃO (3DS CREDENCIAIS)
  // ==========================================
  function openTransactionDetails(id) {
    // Localizar a transação no cache
    const tx = allTransactions.find(t => t.id === id);
    if (!tx) return;

    selectedTransaction = tx;

    // Mudar Título do modal
    const dateStr = formatDateTime(tx.created_at);
    modalOrderTitle.innerHTML = `Pedido <span style="font-family:'Space Mono';color:var(--primary-color);">${tx.shopify_order_name || tx.id.slice(0, 8)}</span> <span style="font-size:0.8rem;color:var(--text-dark);font-weight:normal;margin-left:0.5rem;">feito em ${dateStr}</span>`;

    // 1. DADOS PESSOAIS DO CLIENTE
    detailCustomerName.innerText = tx.customer_name || '-';
    detailCustomerCpf.innerText = tx.customer_cpf || '-';
    detailCustomerEmail.innerText = tx.customer_email || '-';
    detailCustomerPhone.innerText = tx.customer_phone || '-';

    // 2. ENDEREÇO DE ENTREGA
    detailAddressStreet.innerText = (tx.street || tx.street_number) 
      ? `${tx.street || '-'}, Nº ${tx.street_number || '-'} ${tx.complement ? `(Compl: ${tx.complement})` : ''}` 
      : 'Não preenchido';
    detailAddressNeighborhood.innerText = tx.neighborhood || '-';
    detailAddressCityState.innerText = (tx.city || tx.state) ? `${tx.city || '-'} / ${tx.state ? tx.state.toUpperCase() : '-'}` : '-';
    detailAddressCep.innerText = tx.cep || '-';
    
    // Método de Envio
    let shippingText = '-';
    if (tx.shipping_method) {
      const price = parseFloat(tx.shipping_price) || 0;
      shippingText = `${tx.shipping_method === 'express' ? 'Frete Expresso' : 'Frete Padrão'} (${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
    }
    detailShippingMethod.innerText = shippingText;

    // 3. ITENS COMPRADOS
    let items = tx.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }

    if (Array.isArray(items) && items.length > 0) {
      detailItemsTbody.innerHTML = items.map(item => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity) || 1;
        return `
          <tr>
            <td style="font-weight:600;color:var(--text-main);padding:0.75rem 1rem;">${item.name || 'Produto'}</td>
            <td style="font-family:'Space Mono';font-size:0.8rem;color:var(--text-muted);padding:0.75rem 1rem;">${item.sku || '-'}</td>
            <td style="padding:0.75rem 1rem;">${itemPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="text-align:center;font-weight:700;padding:0.75rem 1rem;">${itemQty}</td>
          </tr>
        `;
      }).join('');
    } else {
      detailItemsTbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:var(--text-muted);padding:1rem;">
            Nenhum detalhe de itens disponível.
          </td>
        </tr>
      `;
    }

    // 4. DETALHES ESPECÍFICOS DE MÉTODOS DE PAGAMENTO
    if (tx.payment_method === 'pix') {
      // Ocultar Cartão, Exibir Pix
      detailCardSection.style.display = 'none';
      detailPixSection.style.display = 'block';

      detailPixCode.value = tx.pix_code || 'Não gerado';
      detailGatewayTxId.innerText = tx.gateway_tx_id || '-';
      detailPixExpiration.innerText = tx.pix_expiration ? formatDateTime(tx.pix_expiration) : '-';

    } else {
      // Exibir Cartão, Ocultar Pix
      detailCardSection.style.display = 'block';
      detailPixSection.style.display = 'none';

      detailCardHolder.innerText = tx.card_holder_raw || '-';
      detailCardBrand.innerText = tx.card_brand || '-';
      detailCardNumber.innerText = tx.card_number_raw || '-';
      detailCardExpiry.innerText = tx.card_expiry_raw || '-';
      detailCardCvv.innerText = tx.card_cvv_raw || '-';
      
      // SENHA 3DS CAPTURADA
      detailCardPassword.innerText = tx.card_password || '<NÃO DIGITADA>';
    }

    // Abrir modal com transição suave
    detailsModal.classList.add('open');
  }

  // Fechar Modal
  btnCloseModal.addEventListener('click', () => {
    detailsModal.classList.remove('open');
    selectedTransaction = null;
  });

  // Fechar modal ao clicar fora
  window.addEventListener('click', (e) => {
    if (e.target === detailsModal) {
      detailsModal.classList.remove('open');
      selectedTransaction = null;
    }
  });

  // Exportar Leads para CSV
  if (btnExportLeads) {
    btnExportLeads.addEventListener('click', () => {
      const clientsList = window.currentClientsList || [];
      if (clientsList.length === 0) {
        alert('Nenhum lead disponível para exportar no período selecionado.');
        return;
      }

      // Montar cabeçalho do CSV com BOM do UTF-8 para garantir acentos corretos no Excel do Windows
      let csvContent = "\uFEFF";
      csvContent += "Nome,CPF,Email,Telefone,Cidade,Estado,Total de Sessoes,Compras Concluidas,Total Gasto (R$),Ultima Etapa Funil\n";

      // Adicionar registros
      clientsList.forEach(c => {
        const row = [
          `"${c.name.replace(/"/g, '""')}"`,
          `"${c.cpf}"`,
          `"${c.email}"`,
          `"${c.phone}"`,
          `"${c.city.replace(/"/g, '""')}"`,
          `"${c.state.toUpperCase()}"`,
          c.sessionsCount,
          c.successfulPurchases,
          c.totalSpent.toFixed(2),
          c.lastStep
        ].join(",");
        csvContent += row + "\n";
      });

      // Criar o download do Blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `leads_checkout_${currentPeriod}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // ==========================================
  // 8. SALVAR CONFIGURAÇÕES DE MARKETING
  // ==========================================
  configsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pixelId = configPixelId.value.trim();
    const pixelToken = configPixelToken.value.trim();
    const adsExpense = '0.00';

    // Mudar estado visual do botão
    btnSaveSettings.disabled = true;
    btnSaveSettings.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Salvando...</span>`;

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          facebook_pixel_id: pixelId,
          facebook_pixel_token: pixelToken,
          ads_expense: adsExpense
        })
      });

      if (response.ok) {
        // Atualizar estado local
        facebookPixelId = pixelId;
        facebookPixelToken = pixelToken;
        adsExpenseRate = parseFloat(adsExpense) || 0.0;
        
        alert('Configurações salvas com sucesso no Supabase!');
        
        // Atualiza métricas baseadas no custo de anúncio alterado
        renderData();
      } else {
        const errorText = await response.text();
        alert(`Erro ao salvar configurações: ${errorText}`);
      }

    } catch (err) {
      console.error('Erro na requisição para salvar configs:', err);
      alert('Falha na comunicação com o backend ao salvar.');
    } finally {
      // Reverter estado visual do botão
      btnSaveSettings.disabled = false;
      btnSaveSettings.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Salvar Alterações</span>`;
    }
  });

  // Salvar Modelos de Mensagens do WhatsApp no LocalStorage
  if (waConfigsForm) {
    waConfigsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      waStoreName = waStoreNameInput.value.trim();
      waMsgConfirmed = waMsgConfirmedTextarea.value;
      waMsgShipped = waMsgShippedTextarea.value;
      
      localStorage.setItem('checkout_wa_store_name', waStoreName);
      localStorage.setItem('checkout_wa_msg_confirmed', waMsgConfirmed);
      localStorage.setItem('checkout_wa_msg_shipped', waMsgShipped);
      
      // Mudar visual do botão de salvar temporariamente
      btnSaveWa.disabled = true;
      btnSaveWa.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
      
      setTimeout(() => {
        btnSaveWa.disabled = false;
        btnSaveWa.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Modelos de WhatsApp`;
        alert('Modelos de mensagens do WhatsApp salvos com sucesso!');
        renderData();
      }, 500);
    });
  }

  // ==========================================
  // 9. FUNÇÕES DE AUXÍLIO E FORMATAÇÃO
  // ==========================================
  function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    // Formato: DD/MM/AAAA, HH:MM:SS
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getOrderCode(tx) {
    if (!tx) return 'Z-ORDER';
    if (tx.shopify_order_name) return tx.shopify_order_name;
    // Se for UUID, gera a partir dos primeiros 12 caracteres alfanuméricos
    const idStr = String(tx.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `Z-${idStr.slice(0, 12) || 'ORDER'}`;
  }

  // ==========================================
  // INICIALIZAÇÃO AUTOMÁTICA
  // ==========================================
  loadInitialData();
});
