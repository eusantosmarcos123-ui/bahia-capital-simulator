/**
 * Cliente de API Autenticado — Bahia Capital Simulador
 */
const API = {
  baseUrl: window.location.origin,

  getToken() {
    return localStorage.getItem('bahia_capital_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('bahia_capital_token', token);
    } else {
      localStorage.removeItem('bahia_capital_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/demo')) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw new Error(data.message || 'Erro durante a requisição à API.');
    }

    return data;
  },

  // Autenticação
  async demoLogin() {
    const res = await this.request('/api/auth/demo', { method: 'POST' });
    this.setToken(res.token);
    return res;
  },

  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  },

  async register(name, email, password) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(res.token);
    return res;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  logout() {
    this.setToken(null);
    window.location.reload();
  },

  // Mercado
  async getQuotes() {
    return this.request('/api/market/quotes');
  },

  async getQuote(ticker) {
    return this.request(`/api/market/quote/${ticker}`);
  },

  // Negociações & Carteira
  async executeOrder(ticker, transactionType, quantity) {
    return this.request('/api/trade/order', {
      method: 'POST',
      body: JSON.stringify({ ticker, transactionType, quantity }),
    });
  },

  async getPortfolio() {
    return this.request('/api/portfolio');
  },

  async getHistory() {
    return this.request('/api/trade/history');
  },

  async resetPortfolio() {
    return this.request('/api/portfolio/reset', { method: 'POST' });
  },
};
