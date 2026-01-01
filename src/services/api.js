// Use environment variable or dynamically determine the API URL
// In development, Vite exposes env vars via import.meta.env
const getApiBase = () => {
  // Check for Vite environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  // Use same host as the frontend (works when both are served from same origin)
  // Or fallback to localhost for local development
  const host = window.location.hostname;
  const port = 3001;
  return `http://${host}:${port}/api`;
};

const API_BASE = getApiBase();

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Markets
  async getMarkets(category = 'all') {
    const params = category !== 'all' ? `?category=${category}` : '';
    return this.request(`/markets${params}`);
  }

  async getMarket(id) {
    return this.request(`/markets/${id}`);
  }

  async getQuote(marketId, side, amountZec) {
    return this.request(`/markets/${marketId}/quote`, {
      method: 'POST',
      body: JSON.stringify({ side, amountZec }),
    });
  }

  async executeTrade(marketId, userId, side, amountZec) {
    return this.request(`/markets/${marketId}/trade`, {
      method: 'POST',
      body: JSON.stringify({ userId, side, amountZec }),
    });
  }

  // Wallet
  async connectWallet(viewingKey = null) {
    return this.request('/wallet/connect', {
      method: 'POST',
      body: JSON.stringify({ viewingKey }),
    });
  }

  async getBalance(userId) {
    return this.request(`/wallet/${userId}/balance`);
  }

  async getPositions(userId) {
    return this.request(`/wallet/${userId}/positions`);
  }

  async getTrades(userId) {
    return this.request(`/wallet/${userId}/trades`);
  }

  async requestFaucet(userId, amount = 1.0) {
    return this.request(`/wallet/${userId}/faucet`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getDepositInfo(userId) {
    return this.request(`/wallet/${userId}/deposit`, {
      method: 'POST',
    });
  }

  // Network
  async getNetworkStatus() {
    return this.request('/network/status');
  }

  async validateAddress(address) {
    return this.request('/network/validate-address', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }
}

export default new ApiService();

