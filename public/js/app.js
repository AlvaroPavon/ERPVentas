// chatSocket y EMOJI_PICKER ya están definidos en chat.js - usamos window.chatSocket

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
    Router.register('chat', (el) => renderChatPage(el));

    // Initialize WebSocket
    const wsToken = localStorage.getItem('token');
    if (wsToken) {
      window.chatSocket.connect([]);
      window.chatSocket.onMessage = () => {
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
        const lang = user.language || 'es';
        if (typeof I18n?.load !== 'function') {
          console.warn('I18n not loaded, creating inline fallback');
          window.I18n = { translations: {}, currentLang: 'es', fallbackLang: 'es', t: k => k, load: async () => {} };
        }
        await I18n.load(lang);
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
    document.getElementById('page-title').textContent = I18n.t('dashboard.title');
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
    window.chatSocket.ws = null;
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