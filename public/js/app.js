// Chat WebSocket Manager (inline to avoid extra fetch on first load)
const chatSocket = {
  ws: null,
  onMessage: null,
  onTyping: null,

  connect(conversationIds) {
    const token = localStorage.getItem('token');
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const convParam = encodeURIComponent(JSON.stringify(conversationIds || []));
    try {
      this.ws = new WebSocket(`${protocol}//${host}/ws?token=${token}&conversations=${convParam}`);
    } catch(e) { return; }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'message' && this.onMessage) this.onMessage(data);
        if (data.event === 'typing' && this.onTyping) this.onTyping(data);
      } catch(e) {}
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(conversationIds), 3000);
    };

    this.ws.onerror = () => {};
  },

  send(event, data) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ event, ...data }));
    }
  },

  subscribe(conversationIds) {
    this.send('subscribe', { conversationIds });
  }
};

window.chatSocket = chatSocket;

const EMOJI_PICKER = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '🤔', '✅'];

const App = {
  user: null,
  initialized: false,
  darkMode: false,
  autoDarkMode: false,
  autoDarkInterval: null,

  isDarkTime() {
    const hour = new Date().getHours();
    return hour < 7 || hour >= 20;
  },

  initDarkMode() {
    this.autoDarkMode = localStorage.getItem('autoDarkMode') === 'true';
    const saved = localStorage.getItem('darkMode');

    if (this.autoDarkMode) {
      this.darkMode = this.isDarkTime();
    } else {
      this.darkMode = saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.applyDarkMode();
    this.startAutoDarkCheck();

    document.getElementById('dark-toggle')?.addEventListener('click', () => {
      if (this.autoDarkMode) {
        this.autoDarkMode = false;
        localStorage.setItem('autoDarkMode', 'false');
      }
      this.darkMode = !this.darkMode;
      localStorage.setItem('darkMode', this.darkMode);
      this.applyDarkMode();
    });
  },

  startAutoDarkCheck() {
    if (this.autoDarkInterval) clearInterval(this.autoDarkInterval);
    this.autoDarkInterval = setInterval(() => {
      if (this.autoDarkMode) {
        const shouldBeDark = this.isDarkTime();
        if (shouldBeDark !== this.darkMode) {
          this.darkMode = shouldBeDark;
          this.applyDarkMode();
        }
      }
    }, 60000);
  },

  applyDarkMode() {
    const html = document.documentElement;
    const toggle = document.getElementById('dark-toggle');
    if (this.darkMode) {
      html.setAttribute('data-theme', 'dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0a0a0f');
      if (toggle) toggle.textContent = '☀️';
    } else {
      html.removeAttribute('data-theme');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0381fe');
      if (toggle) toggle.textContent = '🌙';
    }
  },

  async init() {
    API.init();
    Router.init();
    this.initDarkMode();

    // Register routes
    Router.register('login', (el) => renderLogin(el));
    Router.register('register', (el) => renderRegister(el));
    Router.register('home', (el) => renderHome(el));
    Router.register('sales', (el) => renderSales(el));
    Router.register('sessions', (el) => renderSessions(el));
    Router.register('companies', (el) => renderCompanies(el));
    Router.register('company', (el, p) => renderCompanyDetail(el, p));
    Router.register('profile', (el) => renderProfile(el));
    Router.register('activity', (el) => renderActivity(el));
    Router.register('join-requests', (el) => renderJoinRequests(el));
    Router.register('inventory', (el, p) => renderInventory(el, p));
    Router.register('commissions', (el, p) => renderCommissions(el, p));
    Router.register('chat', (el) => {
      if (typeof renderChatPage === 'function') {
        renderChatPage(el);
      } else {
        el.innerHTML = '<div class="list-empty"><p>Cargando chat...</p></div>';
        import('/js/pages/chat.js').then(() => renderChatPage(el));
      }
    });

    // Initialize WebSocket
    const wsToken = localStorage.getItem('token');
    if (wsToken) {
      chatSocket.connect([]);
      chatSocket.onMessage = () => {
        updateChatBadge();
      };
    }

    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page === Router.currentPage) return;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        location.hash = page;
        Router.go(page, {});
      });
    });

    // Menu button
    document.getElementById('menu-btn')?.addEventListener('click', () => {
      const current = Router.currentPage;
      const pages = ['home', 'sales', 'sessions', 'companies', 'chat', 'profile'];
      const idx = pages.indexOf(current);
      const next = pages[(idx + 1) % pages.length];
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-page="' + next + '"]')?.classList.add('active');
      location.hash = next;
      Router.go(next, {});
    });

    // Check auth
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const user = await API.me();
        this.user = user;
        this.showMainApp();
        Router.go('home', {});
      } catch {
        localStorage.removeItem('token');
        this.showAuth();
        Router.go('login', {});
      }
    } else {
      this.showAuth();
      Router.go('login', {});
    }

    // Hide splash
    setTimeout(() => {
      document.getElementById('splash-screen').classList.add('hide');
    }, 800);

    this.initialized = true;
  },

  showAuth() {
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById('main-container').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    document.getElementById('app-header').style.display = 'none';
    Router.setContainer('auth-page-content');
  },

  showMainApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('app-header').style.display = 'flex';
    this.updateHeader();
    document.getElementById('page-title').textContent = 'Inicio';
    Router.setContainer('page-content');
  },

  updateHeader() {
    const user = this.user;
    if (!user) return;
    document.getElementById('header-user').textContent = user.name || '';
    const avatarEl = document.getElementById('header-user');
    if (user.avatar) {
      avatarEl.innerHTML = '<img src="' + user.avatar + '" class="header-avatar" alt="">';
    } else {
      avatarEl.textContent = user.name || '';
    }
  },

  updateTitle(title) {
    document.getElementById('page-title').textContent = title;
  },

  showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.style.display = 'flex';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.hideModal();
    };
  },

  hideModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

  logout() {
    localStorage.removeItem('token');
    API.setToken(null);
    chatSocket.ws = null;
    this.user = null;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    this.showAuth();
    Router.go('login', {});
  },
};

function updateChatBadge() {
  // Update unread chat badge
  console.log('Chat updated');
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});