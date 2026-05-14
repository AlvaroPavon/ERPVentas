const API = {
  baseUrl: '',
  token: null,

  init() {
    this.token = localStorage.getItem('token');
  },

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },

  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(this.baseUrl + path, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },

  // Auth
  login(email, password) { return this.post('/api/auth/login', { email, password }); },
  register(name, email, password) { return this.post('/api/auth/register', { name, email, password }); },
  me() { return this.get('/api/auth/me'); },

  // Companies
  getCompanies() { return this.get('/api/companies'); },
  createCompany(name, description) { return this.post('/api/companies', { name, description }); },
  getCompany(id) { return this.get(`/api/companies/${id}`); },
  searchCompanies(q) { return this.get(`/api/companies/search?q=${encodeURIComponent(q)}`); },
  addUserToCompany(companyId, email, role) { return this.post(`/api/companies/${companyId}/users`, { email, role }); },
  removeUserFromCompany(companyId, userId) { return this.del(`/api/companies/${companyId}/users/${userId}`); },
  requestJoinCompany(companyId) { return this.post(`/api/companies/${companyId}/join-request`); },
  getJoinRequests(companyId) { return this.get(`/api/companies/${companyId}/join-requests`); },
  acceptJoinRequest(companyId, requestId) { return this.post(`/api/companies/${companyId}/join-requests/${requestId}/accept`); },
  rejectJoinRequest(companyId, requestId) { return this.post(`/api/companies/${companyId}/join-requests/${requestId}/reject`); },
  getMyRequests() { return this.get('/api/companies/my-requests'); },
  getIncomingRequests() { return this.get('/api/companies/incoming-requests'); },
  getPublicUser(userId) { return this.get(`/api/users/${userId}/public`); },

  // Sales Sessions
  getSessions() { return this.get('/api/sales/sessions'); },
  getCompanySessions(companyId) { return this.get(`/api/sales/sessions/${companyId}`); },
  createSession(company_id, name, session_date, notes) { return this.post('/api/sales/sessions', { company_id, name, session_date, notes }); },
  getSession(id) { return this.get(`/api/sales/session/${id}`); },
  addSaleItem(sessionId, product_name, price, quantity, image_url) { return this.post(`/api/sales/session/${sessionId}/items`, { product_name, price, quantity, image_url }); },
  deleteSaleItem(itemId) { return this.del(`/api/sales/items/${itemId}`); },
  updateSaleItem(itemId, data) { return this.put(`/api/sales/items/${itemId}`, data); },
  closeSession(id) { return this.post(`/api/sales/session/${id}/close`); },
  deleteSession(id) { return this.del(`/api/sales/session/${id}`); },
  updateSession(id, data) { return this.put(`/api/sales/session/${id}`, data); },

  // Dashboard
  getMonthly(year, month, companyId) {
    let url = `/api/dashboard/monthly?year=${year}&month=${month}`;
    if (companyId) url += `&companyId=${companyId}`;
    return this.get(url);
  },
  getTopProducts(limit, companyId) {
    let url = `/api/dashboard/top-products?limit=${limit || 10}`;
    if (companyId) url += `&companyId=${companyId}`;
    return this.get(url);
  },
  getDailyComparison(limit, companyId) {
    let url = `/api/dashboard/daily-comparison?limit=${limit || 20}`;
    if (companyId) url += `&companyId=${companyId}`;
    return this.get(url);
  },
  getOverview(companyId) {
    let url = '/api/dashboard/overview';
    if (companyId) url += `?companyId=${companyId}`;
    return this.get(url);
  },
  getAdvancedStats(companyId) {
    let url = '/api/dashboard/advanced';
    if (companyId) url += `?companyId=${companyId}`;
    return this.get(url);
  },

  // Activity
  getActivity(page = 1) { return this.get(`/api/activity?page=${page}&limit=50`); },

  // Permissions
  getCompanyPermissions(companyId) { return this.get(`/api/permissions/${companyId}`); },
  updateRolePermissions(companyId, role, permissions) { return this.put(`/api/permissions/${companyId}/${role}`, { permissions }); },

  // Products
  getCompanyProducts(companyId) { return this.get(`/api/companies/${companyId}/products`); },
  createProduct(companyId, name, price, category, image_url, prices) { return this.post(`/api/companies/${companyId}/products`, { name, price, category, image_url, prices }); },
  deleteProduct(productId) { return this.del(`/api/products/${productId}`); },

  // Push Notifications
  getVapidKey() { return this.get('/api/push/vapid-public-key'); },
  pushSubscribe(endpoint, keys) { return this.post('/api/push/subscribe', { endpoint, keys }); },
  pushUnsubscribe(endpoint) { return this.post('/api/push/unsubscribe', { endpoint }); },
  pushStatus() { return this.get('/api/push/status'); },
  pushTest() { return this.post('/api/push/test'); },

  // Chat
  getChatConversations() { return this.get('/api/chat/conversations'); },
  createChatConversation(name, type, company_id) { return this.post('/api/chat/conversations', { name, type, company_id }); },
  getChatMessages(conversationId, page, limit) { return this.get(`/api/chat/conversations/${conversationId}/messages?page=${page || 1}&limit=${limit || 50}`); },
  sendChatMessage(conversationId, content, image_url, type) { return this.post(`/api/chat/conversations/${conversationId}/messages`, { content, image_url, type }); },
  addChatParticipant(conversationId, user_id) { return this.post(`/api/chat/conversations/${conversationId}/participants`, { user_id }); },
  removeChatParticipant(participantId) { return this.del(`/api/chat/participants/${participantId}`); },
  addChatReaction(messageId, emoji) { return this.post(`/api/chat/messages/${messageId}/reaction`, { emoji }); },
  getChatParticipants(conversationId) { return this.get(`/api/chat/conversations/${conversationId}/participants`); },
  getChatOnline(conversationId) { return this.get(`/api/chat/conversations/${conversationId}/online`); },
  getChatContacts() { return this.get('/api/chat/contacts'); },
  deleteChatConversation(conversationId) { return this.del(`/api/chat/conversations/${conversationId}`); },

  // Export helpers
  downloadBlob(url, filename) {
    const token = this.token;
    return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Error al exportar');
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?(.+?)"?$/);
        const name = match ? match[1] : filename;
        return res.blob().then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.setAttribute('download', name);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        });
      });
  },

  downloadSessionCSV(sessionId) {
    return this.downloadBlob(`/api/sales/session/${sessionId}/csv`, 'export.csv');
  },

  downloadSessionXLSX(sessionId) {
    return this.downloadBlob(`/api/sales/session/${sessionId}/xlsx`, 'export.xlsx');
  },

  downloadCatalogCSV(companyId) {
    return this.downloadBlob(`/api/companies/${companyId}/export/csv`, 'catalogo.csv');
  },

  downloadCatalogXLSX(companyId) {
    return this.downloadBlob(`/api/companies/${companyId}/export/xlsx`, 'catalogo.xlsx');
  },

  downloadBackup() {
    return this.downloadBlob('/api/backup', `backup_${new Date().toISOString().slice(0,10)}.db`);
  },
  getBackupInfo() { return this.get('/api/backup/info'); },

  // Company dashboard
  getCompanyDashboard(companyId) { return this.get(`/api/dashboard/company/${companyId}`); },

  // Inventory
  getInventory(companyId) { return this.get(`/api/companies/${companyId}/inventory`); },
  getInventoryMovements(companyId) { return this.get(`/api/companies/${companyId}/inventory/movements`); },
  addStock(companyId, productId, quantity, notes) { return this.post(`/api/companies/${companyId}/inventory/${productId}/add-stock`, { quantity, notes }); },
  removeStock(companyId, productId, quantity, notes) { return this.post(`/api/companies/${companyId}/inventory/${productId}/remove-stock`, { quantity, notes }); },
  updateStockThreshold(companyId, productId, minStock) { return this.put(`/api/companies/${companyId}/inventory/${productId}/threshold`, { minStock }); },

  // Commissions
  getCommissionConfig(companyId) { return this.get(`/api/commissions/config/${companyId}`); },
  updateCommissionConfig(companyId, role, pct) { return this.put(`/api/commissions/config/${companyId}/${role}`, { commission_pct: pct }); },
  getCommissionSummary(companyId) { return this.get(`/api/commissions/summary/${companyId}`); },

  // Friends
  searchUsers(q) { return this.get(`/api/friends/search?q=${encodeURIComponent(q)}`); },
  sendFriendRequest(userId) { return this.post('/api/friends/request', { user_id: userId }); },
  getFriendRequests() { return this.get('/api/friends/requests/incoming'); },
  getSentFriendRequests() { return this.get('/api/friends/requests/sent'); },
  acceptFriendRequest(id) { return this.post(`/api/friends/requests/${id}/accept`); },
  rejectFriendRequest(id) { return this.post(`/api/friends/requests/${id}/reject`); },
  getFriends() { return this.get('/api/friends'); },
  removeFriend(id) { return this.del(`/api/friends/${id}`); },

  // User
  getProfile() { return this.get('/api/users/profile'); },
  updateProfile(name, email) { return this.put('/api/users/profile', { name, email }); },
  changePassword(currentPassword, newPassword) { return this.put('/api/users/password', { currentPassword, newPassword }); },
  updateAvatar(avatar) { return this.put('/api/users/avatar', { avatar }); },
  getUserLanguage() { return this.get('/api/user/language'); },
  updateLanguage(lang) { return this.put('/api/user/language', { language: lang }); },
};