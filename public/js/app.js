// chatSocket y EMOJI_PICKER ya están definidos en chat.js - usamos window.chatSocket

const App = {
  user: null,
  initialized: false,
  darkMode: false,
  themeMode: 'auto', // 'light' | 'dark' | 'auto'
  accentColor: 'blue',
  autoDarkInterval: null,
  accentListeners: [],

  // ===== Theme System =====

  get ACCENTS() {
    return [
      { id: 'blue', name: 'Azul', color: '#0381fe' },
      { id: 'green', name: 'Verde', color: '#10b981' },
      { id: 'purple', name: 'Morado', color: '#8b5cf6' },
      { id: 'orange', name: 'Naranja', color: '#f97316' },
      { id: 'pink', name: 'Rosa', color: '#ec4899' },
      { id: 'teal', name: 'Teal', color: '#14b8a6' },
      { id: 'red', name: 'Rojo', color: '#ef4444' },
      { id: 'indigo', name: 'Índigo', color: '#6366f1' },
    ];
  },

  get PRIMARY_HEX() {
    const accent = this.ACCENTS.find(a => a.id === this.accentColor);
    return accent ? accent.color : '#0381fe';
  },

  isDarkTime() {
    const hour = new Date().getHours();
    return hour < 7 || hour >= 20;
  },

  initTheme() {
    // Load saved preferences
    this.themeMode = localStorage.getItem('themeMode') || 'auto';
    this.accentColor = localStorage.getItem('accentColor') || 'blue';

    // Resolve actual dark mode
    this.resolveDarkMode();
    this.applyTheme();
    this.startAutoDarkCheck();

    // Listen for system dark mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themeMode === 'auto') {
        this.resolveDarkMode();
        this.applyTheme();
      }
    });

    // Dark toggle button in header
    document.getElementById('dark-toggle')?.addEventListener('click', () => {
      if (this.themeMode === 'auto') {
        this.themeMode = 'dark';
      } else if (this.themeMode === 'dark') {
        this.themeMode = 'light';
      } else {
        this.themeMode = 'auto';
      }
      localStorage.setItem('themeMode', this.themeMode);
      this.resolveDarkMode();
      this.applyTheme();
      this.notifyAccentListeners();
    });
  },

  resolveDarkMode() {
    if (this.themeMode === 'dark') {
      this.darkMode = true;
    } else if (this.themeMode === 'light') {
      this.darkMode = false;
    } else {
      // auto: follow system
      this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  },

  applyTheme() {
    const html = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const toggle = document.getElementById('dark-toggle');

    // Dark mode
    if (this.darkMode) {
      html.setAttribute('data-theme', 'dark');
      if (toggle) toggle.textContent = '☀️';
    } else {
      html.removeAttribute('data-theme');
      if (toggle) toggle.textContent = '🌙';
    }

    // Accent color
    html.setAttribute('data-accent', this.accentColor);

    // Update theme-color meta
    if (metaTheme) {
      metaTheme.setAttribute('content', this.darkMode ? '#0a0a0f' : this.PRIMARY_HEX);
    }
  },

  setAccent(id) {
    if (!this.ACCENTS.find(a => a.id === id)) return;
    this.accentColor = id;
    localStorage.setItem('accentColor', id);
    this.applyTheme();
    this.notifyAccentListeners();
  },

  setThemeMode(mode) {
    if (!['light', 'dark', 'auto'].includes(mode)) return;
    this.themeMode = mode;
    localStorage.setItem('themeMode', mode);
    this.resolveDarkMode();
    this.applyTheme();
    this.notifyAccentListeners();
  },

  onAccentChange(fn) {
    this.accentListeners.push(fn);
  },

  notifyAccentListeners() {
    this.accentListeners.forEach(fn => fn(this.accentColor, this.themeMode, this.darkMode));
  },

  startAutoDarkCheck() {
    if (this.autoDarkInterval) clearInterval(this.autoDarkInterval);
    this.autoDarkInterval = setInterval(() => {
      if (this.themeMode === 'auto') {
        const shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        // Also check time-based fallback for the old auto-dark behavior
        if (shouldBeDark !== this.darkMode) {
          this.darkMode = shouldBeDark;
          this.applyTheme();
        }
      }
    }, 60000);
  },

  async init() {
    API.init();
    Router.init();
    this.initTheme();

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