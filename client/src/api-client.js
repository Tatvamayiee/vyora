// API client for Vyora POS frontend
const API_BASE_URL = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = '/screen_01_authentication_entry/code.html';
        throw new Error('Session expired. Please log in again.');
      }

      if (response.status === 403) {
        throw new Error('You do not have permission for this action');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `Request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Authentication APIs
  async login(email, password, role) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    this.setToken(response.token);
    localStorage.setItem('userRole', response.user.role.name);
    localStorage.setItem('userId', response.user.id);
    localStorage.setItem('employeeBranchId', response.user.employee?.branchId || null);
    return response;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('employeeBranchId');
  }

  async getCurrentUser() {
    return await this.request('/auth/me');
  }

  // Dashboard APIs
  async getOwnerDashboard(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/dashboard/owner?${queryString}`);
  }

  async getManagerDashboard(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/dashboard/manager?${queryString}`);
  }

  // Products APIs
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/products?${queryString}`);
  }

  async getProduct(id) {
    return await this.request(`/products/${id}`);
  }

  async createProduct(productData) {
    return await this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async updateProduct(id, productData) {
    return await this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  async deleteProduct(id) {
    return await this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Inventory APIs
  async getInventory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/inventory?${queryString}`);
  }

  async updateInventory(id, inventoryData) {
    return await this.request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(inventoryData),
    });
  }

  async updateStock(updateData) {
    return await this.request('/inventory/stock-update', {
      method: 'POST',
      body: JSON.stringify(updateData),
    });
  }

  async getStockMovements(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/inventory/movements?${queryString}`);
  }

  // Sales APIs
  async createSale(saleData) {
    return await this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  async getSales(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/sales?${queryString}`);
  }

  async getSale(id) {
    return await this.request(`/sales/${id}`);
  }

  // Staff APIs
  async getStaff(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/staff?${queryString}`);
  }

  async createStaff(staffData) {
    return await this.request('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  }

  async updateStaff(id, staffData) {
    return await this.request(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffData),
    });
  }

  // Branches APIs
  async getBranches() {
    return await this.request('/branches');
  }

  // Promotions APIs
  async getPromotions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/promotions?${queryString}`);
  }

  async createPromotion(promotionData) {
    return await this.request('/promotions', {
      method: 'POST',
      body: JSON.stringify(promotionData),
    });
  }

  async updatePromotion(id, promotionData) {
    return await this.request(`/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(promotionData),
    });
  }

  // Loyalty APIs
  async getLoyalty(customerId) {
    return await this.request(`/loyalty/${customerId}`);
  }

  async createLoyaltyTransaction(transactionData) {
    return await this.request('/loyalty/transaction', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  // Reports APIs
  async getReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/reports?${queryString}`);
  }

  // Sync APIs
  async syncOfflineTransaction(transactionData) {
    return await this.request('/sync/offline-transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  // Notifications APIs
  async getNotifications(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/notifications?${queryString}`);
  }

  async markNotificationRead(id) {
    return await this.request(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isRead: true }),
    });
  }
}

// Global API client instance
window.apiClient = new ApiClient();

// Utility functions for frontend
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '<div class="loading">Loading...</div>';
  }
}

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="error">Error: ${message}</div>`;
  }
}

function showEmpty(elementId, message = 'No data available') {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="empty-state">${message}</div>`;
  }
}

// Auth helper functions
function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

function getUserRole() {
  return localStorage.getItem('userRole');
}

function requireAuth(redirectUrl = '/screen_01_authentication_entry/code.html') {
  if (!isAuthenticated()) {
    window.location.href = redirectUrl;
    return false;
 }
 return true;
}

function requireRole(role, redirectUrl = '/screen_01_authentication_entry/code.html') {
  if (!requireAuth(redirectUrl)) return false;
  if (getUserRole() !== role) {
    window.location.href = redirectUrl;
    return false;
 }
 return true;
}

// Format currency function
function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// Format date function
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

console.log('API client loaded');