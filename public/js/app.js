/**
 * Aplicação Principal — Simulador de Carteira Bahia Capital
 */

const App = {
  state: {
    user: null,
    portfolio: null,
    quotes: {},
    catalog: {},
    selectedTicker: 'PETR4',
    tradeType: 'BUY', // 'BUY' ou 'SELL'
    quantity: 1,
    quotesRefreshInterval: null,
  },

  // Inicialização
  async init() {
    this.bindEvents();
    await this.loadMarketCatalog();

    // Verifica se já está autenticado
    const token = API.getToken();
    if (token) {
      try {
        const userRes = await API.getMe();
        this.state.user = userRes.user;
        this.renderAuthUI();
        await this.refreshData();
      } catch {
        this.showAuthModal();
      }
    } else {
      this.showAuthModal();
    }

    // Auto-refresh de cotações a cada 30 segundos
    this.state.quotesRefreshInterval = setInterval(() => {
      if (this.state.user) {
        this.refreshMarketQuotesOnly();
      }
    }, 30000);
  },

  // Event Listeners
  bindEvents() {
    // Abas de Compra / Venda
    document.getElementById('tabBuy')?.addEventListener('click', () => this.setTradeType('BUY'));
    document.getElementById('tabSell')?.addEventListener('click', () => this.setTradeType('SELL'));

    // Mudança de Ativo na Boleta
    document.getElementById('assetSelect')?.addEventListener('change', (e) => {
      this.selectAsset(e.target.value);
    });

    // Quantidade
    const qtyInput = document.getElementById('tradeQuantity');
    qtyInput?.addEventListener('input', (e) => {
      this.state.quantity = Math.max(0, parseFloat(e.target.value) || 0);
      this.updateTradeTicketSummary();
    });

    // Botões de Percentual Rápido (25%, 50%, 75%, 100%)
    document.querySelectorAll('.btn-percent').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const percent = parseFloat(e.currentTarget.dataset.percent);
        this.applyPercentageQuantity(percent);
      });
    });

    // Submissão da Ordem
    document.getElementById('tradeForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitOrder();
    });

    // Botão de Reset de Carteira
    document.getElementById('btnResetPortfolio')?.addEventListener('click', () => {
      this.confirmResetPortfolio();
    });

    // Botão de Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      API.logout();
    });

    // Botão Demo Login no Modal
    document.getElementById('btnDemoLogin')?.addEventListener('click', async () => {
      await this.handleDemoLogin();
    });

    // Formulário de Login Tradicional
    document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin(e);
    });

    // Formulário de Cadastro
    document.getElementById('formRegister')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleRegister(e);
    });

    // Alternar entre Login e Cadastro
    document.getElementById('btnShowRegister')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('loginSection').classList.add('hidden');
      document.getElementById('registerSection').classList.remove('hidden');
    });

    document.getElementById('btnShowLogin')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('registerSection').classList.add('hidden');
      document.getElementById('loginSection').classList.remove('hidden');
    });

    // Escuta expiração de token
    window.addEventListener('auth:expired', () => {
      this.showToast('Sessão expirada. Faça login novamente.', 'warning');
      this.showAuthModal();
    });
  },

  // Carrega Catálogo e Cotações Iniciais
  async loadMarketCatalog() {
    try {
      const res = await API.getQuotes();
      this.state.quotes = res.quotes || {};
      this.populateAssetSelect();
      this.renderMarketTicker();
    } catch (err) {
      console.error('Erro ao carregar mercado:', err);
    }
  },

  // Atualiza Dados da Carteira e Cotações
  async refreshData() {
    if (!this.state.user) return;
    try {
      this.showLoadingIndicator(true);
      const [portfolioRes, historyRes, quotesRes] = await Promise.all([
        API.getPortfolio(),
        API.getHistory(),
        API.getQuotes(),
      ]);

      this.state.portfolio = portfolioRes.portfolio;
      this.state.quotes = quotesRes.quotes || {};

      this.renderKPIs();
      this.renderCharts();
      this.renderCustodyTable();
      this.renderHistoryTable(historyRes.history || []);
      this.renderMarketTicker();
      this.updateTradeTicketSummary();
    } catch (err) {
      this.showToast(err.message || 'Erro ao sincronizar dados da carteira.', 'error');
    } finally {
      this.showLoadingIndicator(false);
    }
  },

  async refreshMarketQuotesOnly() {
    try {
      const res = await API.getQuotes();
      this.state.quotes = res.quotes || {};
      this.renderMarketTicker();
      this.updateTradeTicketSummary();
    } catch (e) {
      console.warn('Falha silenciosa no auto-refresh de cotações:', e);
    }
  },

  // Renderizadores de UI
  renderAuthUI() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');

    const userNameEl = document.getElementById('headerUserName');
    if (userNameEl && this.state.user) {
      userNameEl.textContent = this.state.user.name;
    }
  },

  showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('hidden');
  },

  renderKPIs() {
    const p = this.state.portfolio;
    if (!p) return;

    // 1. Saldo em Caixa
    const cashEl = document.getElementById('kpiCashBalance');
    if (cashEl) cashEl.textContent = this.formatCurrency(p.cashBalance);

    // Header mini-saldo
    const headerCash = document.getElementById('headerCashBalance');
    if (headerCash) headerCash.textContent = this.formatCurrency(p.cashBalance);

    // 2. Total Investido
    const investedEl = document.getElementById('kpiInvested');
    if (investedEl) investedEl.textContent = this.formatCurrency(p.totalCurrentAssetsValue);

    // 3. Patrimônio Total Consolidado
    const equityEl = document.getElementById('kpiTotalEquity');
    if (equityEl) equityEl.textContent = this.formatCurrency(p.totalEquity);

    // 4. Lucro / Prejuízo Consolidado
    const pnlEl = document.getElementById('kpiTotalPnl');
    const pnlBadge = document.getElementById('kpiPnlBadge');
    if (pnlEl) {
      const isPositive = p.totalPnlBrl >= 0;
      const signal = isPositive ? '+' : '';
      pnlEl.textContent = `${signal}${this.formatCurrency(p.totalPnlBrl)}`;
      pnlEl.className = isPositive
        ? 'text-2xl font-bold text-[#00E676]'
        : 'text-2xl font-bold text-[#FF5252]';

      if (pnlBadge) {
        pnlBadge.textContent = `${signal}${p.totalPnlPercent}%`;
        pnlBadge.className = isPositive
          ? 'px-2 py-0.5 text-xs font-semibold rounded bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30'
          : 'px-2 py-0.5 text-xs font-semibold rounded bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30';
      }
    }
  },

  renderCharts() {
    const p = this.state.portfolio;
    if (!p) return;

    // Gráfico Donut de Alocação
    const allocCanvas = document.getElementById('allocationChart');
    if (allocCanvas && window.ChartsManager) {
      ChartsManager.initAllocationChart(allocCanvas.getContext('2d'), p.allocation);
    }

    // Gráfico de Linha de Evolução Patrimonial
    const perfCanvas = document.getElementById('performanceChart');
    if (perfCanvas && window.ChartsManager) {
      ChartsManager.initPerformanceChart(perfCanvas.getContext('2d'), p.initialCapital, p.totalEquity);
    }
  },

  populateAssetSelect() {
    const select = document.getElementById('assetSelect');
    if (!select) return;

    select.innerHTML = '';

    const quotes = this.state.quotes;
    const stockGroup = document.createElement('optgroup');
    stockGroup.label = 'Ações & FIIs da B3';

    const cryptoGroup = document.createElement('optgroup');
    cryptoGroup.label = 'Criptomoedas Globais';

    Object.keys(quotes).forEach((ticker) => {
      const q = quotes[ticker];
      const opt = document.createElement('option');
      opt.value = ticker;
      opt.textContent = `${ticker} — ${q.name} (${this.formatCurrency(q.price)})`;

      if (q.type === 'STOCK') {
        stockGroup.appendChild(opt);
      } else {
        cryptoGroup.appendChild(opt);
      }
    });

    select.appendChild(stockGroup);
    select.appendChild(cryptoGroup);

    if (this.state.selectedTicker) {
      select.value = this.state.selectedTicker;
    }
  },

  renderMarketTicker() {
    const tickerContainer = document.getElementById('marketTicker');
    if (!tickerContainer) return;

    const quotes = this.state.quotes;
    const items = Object.keys(quotes).map((ticker) => {
      const q = quotes[ticker];
      const badgeClass = q.type === 'CRYPTO' ? 'badge-crypto' : 'badge-stock';
      return `
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d1728]/80 border border-[#1a2a44] shrink-0 cursor-pointer hover:border-[#D4AF37] transition-all" onclick="App.quickSelectTicker('${ticker}')">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${q.type}</span>
          <span class="font-bold text-xs text-white">${ticker}</span>
          <span class="text-xs text-[#00E676] font-mono">${App.formatCurrency(q.price)}</span>
        </div>
      `;
    });

    tickerContainer.innerHTML = items.join('');
  },

  renderCustodyTable() {
    const tbody = document.getElementById('custodyTableBody');
    const emptyState = document.getElementById('custodyEmptyState');
    if (!tbody) return;

    const positions = this.state.portfolio?.positions || [];

    if (positions.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = positions
      .map((pos) => {
        const isProfit = pos.pnlBrl >= 0;
        const pnlColor = isProfit ? 'text-[#00E676]' : 'text-[#FF5252]';
        const pnlSign = isProfit ? '+' : '';
        const badgeClass = pos.assetType === 'CRYPTO' ? 'badge-crypto' : 'badge-stock';

        return `
          <tr class="border-b border-[#1a2a44]/60 hover:bg-[#121f36]/40 transition-colors">
            <td class="py-3 px-4">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${pos.assetType}</span>
                <div>
                  <div class="font-bold text-white text-sm">${pos.ticker}</div>
                  <div class="text-[11px] text-[#8a99ad]">${pos.name}</div>
                </div>
              </div>
            </td>
            <td class="py-3 px-4 font-mono text-sm text-right text-white">
              ${pos.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
            </td>
            <td class="py-3 px-4 font-mono text-sm text-right text-[#8a99ad]">
              ${this.formatCurrency(pos.averagePrice)}
            </td>
            <td class="py-3 px-4 font-mono text-sm text-right text-white font-semibold">
              ${this.formatCurrency(pos.currentPrice)}
            </td>
            <td class="py-3 px-4 font-mono text-sm text-right text-white font-bold">
              ${this.formatCurrency(pos.currentValue)}
            </td>
            <td class="py-3 px-4 font-mono text-sm text-right ${pnlColor} font-bold">
              ${pnlSign}${this.formatCurrency(pos.pnlBrl)}
              <span class="block text-[11px] font-normal">(${pnlSign}${pos.pnlPercent}%)</span>
            </td>
            <td class="py-3 px-4 text-center">
              <button 
                onclick="App.quickSellAsset('${pos.ticker}', ${pos.quantity})"
                class="px-2.5 py-1 text-xs rounded bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30 hover:bg-[#FF5252] hover:text-white transition-all font-semibold"
                title="Vender posição"
              >
                Vender
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  renderHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('historyEmptyState');
    if (!tbody) return;

    if (!history || history.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = history
      .map((tx) => {
        const isBuy = tx.transaction_type === 'BUY';
        const typeBadge = isBuy
          ? '<span class="px-2 py-0.5 rounded text-xs font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">COMPRA</span>'
          : '<span class="px-2 py-0.5 rounded text-xs font-bold bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30">VENDA</span>';

        const date = new Date(tx.created_at);
        const formattedDate = date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        return `
          <tr class="border-b border-[#1a2a44]/60 hover:bg-[#121f36]/40 transition-colors">
            <td class="py-2.5 px-4 text-xs text-[#8a99ad]">${formattedDate}</td>
            <td class="py-2.5 px-4">${typeBadge}</td>
            <td class="py-2.5 px-4 font-bold text-white text-sm">${tx.asset_ticker}</td>
            <td class="py-2.5 px-4 font-mono text-sm text-right text-white">
              ${parseFloat(tx.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
            </td>
            <td class="py-2.5 px-4 font-mono text-sm text-right text-[#8a99ad]">
              ${this.formatCurrency(tx.unit_price)}
            </td>
            <td class="py-2.5 px-4 font-mono text-sm text-right text-white font-bold">
              ${this.formatCurrency(tx.total_amount)}
            </td>
            <td class="py-2.5 px-4 text-center">
              <span class="inline-flex items-center gap-1 text-[11px] text-[#00E676]">
                <span class="w-1.5 h-1.5 rounded-full bg-[#00E676]"></span>
                Executada
              </span>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  // Boleta de Negociação (Trading Ticket)
  setTradeType(type) {
    this.state.tradeType = type;
    const tabBuy = document.getElementById('tabBuy');
    const tabSell = document.getElementById('tabSell');
    const submitBtn = document.getElementById('btnSubmitOrder');

    if (type === 'BUY') {
      tabBuy?.classList.add('active-buy');
      tabSell?.classList.remove('active-sell');
      if (submitBtn) {
        submitBtn.className =
          'w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00E676] to-[#00b35c] text-black font-extrabold text-sm tracking-wider uppercase shadow-[0_4px_20px_rgba(0,230,118,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer';
        submitBtn.textContent = 'CONFIRMAR COMPRA';
      }
    } else {
      tabSell?.classList.add('active-sell');
      tabBuy?.classList.remove('active-buy');
      if (submitBtn) {
        submitBtn.className =
          'w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF5252] to-[#d32f2f] text-white font-extrabold text-sm tracking-wider uppercase shadow-[0_4px_20px_rgba(255,82,82,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer';
        submitBtn.textContent = 'CONFIRMAR VENDA';
      }
    }

    this.updateTradeTicketSummary();
  },

  selectAsset(ticker) {
    this.state.selectedTicker = ticker;
    const select = document.getElementById('assetSelect');
    if (select) select.value = ticker;
    this.updateTradeTicketSummary();
  },

  quickSelectTicker(ticker) {
    this.selectAsset(ticker);
    document.getElementById('tradeTicketSection')?.scrollIntoView({ behavior: 'smooth' });
  },

  quickSellAsset(ticker, maxQuantity) {
    this.setTradeType('SELL');
    this.selectAsset(ticker);
    this.state.quantity = maxQuantity;
    const qtyInput = document.getElementById('tradeQuantity');
    if (qtyInput) qtyInput.value = maxQuantity;
    this.updateTradeTicketSummary();
    document.getElementById('tradeTicketSection')?.scrollIntoView({ behavior: 'smooth' });
  },

  applyPercentageQuantity(percent) {
    const q = this.state.quotes[this.state.selectedTicker];
    if (!q || q.price <= 0) return;

    let targetQty = 0;
    if (this.state.tradeType === 'BUY') {
      const availableCash = this.state.portfolio?.cashBalance || 0;
      const targetAmount = availableCash * (percent / 100);
      if (q.type === 'STOCK') {
        targetQty = Math.floor(targetAmount / q.price);
      } else {
        targetQty = parseFloat((targetAmount / q.price).toFixed(6));
      }
    } else {
      // Venda baseada na custódia que o investidor possui
      const custody = this.state.portfolio?.positions.find((p) => p.ticker === this.state.selectedTicker);
      const availableCustody = custody ? custody.quantity : 0;
      targetQty = parseFloat((availableCustody * (percent / 100)).toFixed(6));
      if (q.type === 'STOCK') {
        targetQty = Math.floor(targetQty);
      }
    }

    this.state.quantity = Math.max(0, targetQty);
    const qtyInput = document.getElementById('tradeQuantity');
    if (qtyInput) qtyInput.value = this.state.quantity;
    this.updateTradeTicketSummary();
  },

  updateTradeTicketSummary() {
    const ticker = this.state.selectedTicker;
    const quote = this.state.quotes[ticker];
    if (!quote) return;

    const unitPrice = quote.price;
    const qty = this.state.quantity;
    const total = qty * unitPrice;

    // Atualiza cotação em tempo real na boleta
    const quotePriceEl = document.getElementById('ticketQuotePrice');
    if (quotePriceEl) quotePriceEl.textContent = this.formatCurrency(unitPrice);

    const assetBadgeEl = document.getElementById('ticketAssetType');
    if (assetBadgeEl) {
      assetBadgeEl.textContent = quote.type;
      assetBadgeEl.className =
        quote.type === 'CRYPTO'
          ? 'px-2 py-0.5 rounded text-[10px] font-bold badge-crypto'
          : 'px-2 py-0.5 rounded text-[10px] font-bold badge-stock';
    }

    const totalEl = document.getElementById('ticketTotalAmount');
    if (totalEl) totalEl.textContent = this.formatCurrency(total);

    // Mensagem de validação prévia
    const validationEl = document.getElementById('ticketValidationMsg');
    if (!validationEl) return;

    if (this.state.tradeType === 'BUY') {
      const cash = this.state.portfolio?.cashBalance || 0;
      if (total > cash) {
        validationEl.textContent = `Atenção: Saldo insuficiente (${this.formatCurrency(cash)})`;
        validationEl.className = 'text-xs text-[#FF5252] mt-2 block font-medium';
      } else {
        validationEl.textContent = `Saldo após ordem: ${this.formatCurrency(cash - total)}`;
        validationEl.className = 'text-xs text-[#8a99ad] mt-2 block';
      }
    } else {
      const custody = this.state.portfolio?.positions.find((p) => p.ticker === ticker);
      const available = custody ? custody.quantity : 0;
      if (qty > available) {
        validationEl.textContent = `Atenção: Custódia insuficiente. Você tem ${available} un.`;
        validationEl.className = 'text-xs text-[#FF5252] mt-2 block font-medium';
      } else {
        validationEl.textContent = `Restante em custódia: ${(available - qty).toFixed(4)} un.`;
        validationEl.className = 'text-xs text-[#8a99ad] mt-2 block';
      }
    }
  },

  // Execução de Ordem
  async submitOrder() {
    const ticker = this.state.selectedTicker;
    const type = this.state.tradeType;
    const quantity = this.state.quantity;

    if (!quantity || quantity <= 0) {
      this.showToast('Informe uma quantidade válida maior que zero.', 'warning');
      return;
    }

    const btn = document.getElementById('btnSubmitOrder');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-block animate-spin mr-2">⚙️</span> Executando Ordem ACID...';
    }

    try {
      const res = await API.executeOrder(ticker, type, quantity);
      const actionLabel = type === 'BUY' ? 'compra' : 'venda';
      this.showToast(
        `Ordem de ${actionLabel} de ${quantity} ${ticker} executada com sucesso!`,
        'success'
      );

      // Limpa formulário e atualiza dados
      this.state.quantity = 1;
      const qtyInput = document.getElementById('tradeQuantity');
      if (qtyInput) qtyInput.value = 1;

      await this.refreshData();
    } catch (err) {
      this.showToast(err.message || 'Falha ao executar ordem.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  },

  // Reset de Carteira Educacional
  async confirmResetPortfolio() {
    const confirmed = confirm(
      'Tem certeza que deseja restaurar sua carteira educacional para R$ 10.000,00 fictícios?\n\nTodas as posições em custódia e histórico serão reiniciados.'
    );
    if (!confirmed) return;

    try {
      await API.resetPortfolio();
      this.showToast('Carteira restaurada com sucesso para R$ 10.000,00!', 'success');
      await this.refreshData();
    } catch (err) {
      this.showToast(err.message || 'Erro ao restaurar carteira.', 'error');
    }
  },

  // Autenticação
  async handleDemoLogin() {
    try {
      this.showLoadingIndicator(true);
      const res = await API.demoLogin();
      this.state.user = res.user;
      this.renderAuthUI();
      this.showToast(`Bem-vindo ao Simulador Bahia Capital, ${res.user.name}!`, 'success');
      await this.refreshData();
    } catch (err) {
      this.showToast(err.message || 'Falha no acesso demo.', 'error');
    } finally {
      this.showLoadingIndicator(false);
    }
  },

  async handleLogin(e) {
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      this.showLoadingIndicator(true);
      const res = await API.login(email, password);
      this.state.user = res.user;
      this.renderAuthUI();
      this.showToast(`Bem-vindo de volta, ${res.user.name}!`, 'success');
      await this.refreshData();
    } catch (err) {
      this.showToast(err.message || 'Erro no login.', 'error');
    } finally {
      this.showLoadingIndicator(false);
    }
  },

  async handleRegister(e) {
    const name = e.target.regName.value;
    const email = e.target.regEmail.value;
    const password = e.target.regPassword.value;
    try {
      this.showLoadingIndicator(true);
      const res = await API.register(name, email, password);
      this.state.user = res.user;
      this.renderAuthUI();
      this.showToast(`Conta criada com R$ 10.000,00 fictícios!`, 'success');
      await this.refreshData();
    } catch (err) {
      this.showToast(err.message || 'Erro no cadastro.', 'error');
    } finally {
      this.showLoadingIndicator(false);
    }
  },

  // Helpers de Formatação e Toast
  formatCurrency(value) {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'border-[#00E676] bg-[#0d1728] text-[#00E676]',
      error: 'border-[#FF5252] bg-[#0d1728] text-[#FF5252]',
      warning: 'border-[#FFB74D] bg-[#0d1728] text-[#FFB74D]',
      info: 'border-[#D4AF37] bg-[#0d1728] text-[#f0f4f8]',
    };

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 text-sm font-semibold ${
      colors[type] || colors.info
    }`;
    toast.innerHTML = `
      <span class="text-base">${icons[type] || '•'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  showLoadingIndicator(show) {
    const loader = document.getElementById('globalLoader');
    if (loader) {
      if (show) loader.classList.remove('hidden');
      else loader.classList.add('hidden');
    }
  },
};

// Inicialização automática quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
