const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Centralized HTTP request utility with credentials (cookies) and standardized error handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: 'include', // Always send and accept session cookies
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new Error('Network error: Unable to connect to ShopSphere API server');
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.code || 'API_ERROR';
    error.errors = data?.errors || null;
    throw error;
  }

  return data?.data || data;
}

// -------------------------------------------------------------
// API Subsystems
// -------------------------------------------------------------

export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  getMe: () => request('/auth/me', { method: 'GET' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

export const categoriesApi = {
  getAll: () => request('/categories', { method: 'GET' }),
};

export const productsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return request(`/products${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },
  getBySlugOrId: (idOrSlug) => request(`/products/${idOrSlug}`, { method: 'GET' }),
};

export const cartApi = {
  get: () => request('/cart', { method: 'GET' }),
  addItem: (productId, quantity = 1) =>
    request('/cart/items', { method: 'POST', body: { productId, quantity } }),
  updateQuantity: (productId, quantity) =>
    request(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity } }),
  removeItem: (productId) =>
    request(`/cart/items/${productId}`, { method: 'DELETE' }),
  clear: () => request('/cart', { method: 'DELETE' }),
};

export const ordersApi = {
  checkout: (shippingAddress) =>
    request('/orders/checkout', { method: 'POST', body: { shippingAddress } }),
  getMyOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/orders/my-orders${query ? `?${query}` : ''}`, { method: 'GET' });
  },
  getById: (id) => request(`/orders/${id}`, { method: 'GET' }),
  cancel: (id, reason) =>
    request(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
};

export const paymentsApi = {
  initiate: (orderId) =>
    request('/payments/initiate', { method: 'POST', body: { orderId } }),
  verify: (paymentData) =>
    request('/payments/verify', { method: 'POST', body: paymentData }),
  reportFailure: (orderId, errorData) =>
    request('/payments/failure', { method: 'POST', body: { orderId, ...errorData } }),
};

export const reviewsApi = {
  getProductReviews: (productId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products/${productId}/reviews${query ? `?${query}` : ''}`, { method: 'GET' });
  },
  create: (productId, reviewData) =>
    request(`/products/${productId}/reviews`, { method: 'POST', body: reviewData }),
  delete: (id) => request(`/reviews/${id}`, { method: 'DELETE' }),
};

export const wishlistApi = {
  get: () => request('/wishlist', { method: 'GET' }),
  add: (productId) => request(`/wishlist/${productId}`, { method: 'POST' }),
  remove: (productId) => request(`/wishlist/${productId}`, { method: 'DELETE' }),
  moveToCart: (productId) => request(`/wishlist/${productId}/move-to-cart`, { method: 'POST' }),
};

export const adminApi = {
  getDashboard: () => request('/admin/dashboard', { method: 'GET' }),
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/orders${query ? `?${query}` : ''}`, { method: 'GET' });
  },
  updateOrderStatus: (orderId, statusData) =>
    request(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: statusData }),
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/users${query ? `?${query}` : ''}`, { method: 'GET' });
  },
  getLowStock: (threshold = 5) =>
    request(`/admin/inventory/low-stock?threshold=${threshold}`, { method: 'GET' }),
};
