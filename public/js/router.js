const Router = {
  routes: {},
  currentPage: null,
  currentParams: {},
  containerId: 'page-content',

  register(name, handler) {
    this.routes[name] = handler;
  },

  setContainer(id) {
    this.containerId = id;
  },

  async go(name, params) {
    if (name === this.currentPage && JSON.stringify(params) === JSON.stringify(this.currentParams)) return;

    this.currentPage = name;
    this.currentParams = params || {};

    const pageContent = document.getElementById(this.containerId);
    if (!pageContent) return;
    pageContent.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

    try {
      const handler = this.routes[name];
      if (handler) {
        await handler(pageContent, params || {});
      } else {
        pageContent.innerHTML = '<div class="list-empty"><div class="empty-icon">🔍</div><p>Página no encontrada</p></div>';
      }
    } catch (err) {
      console.error('Router error:', err);
      pageContent.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error al cargar la página: ${err.message}</p></div>`;
    }

    window.scrollTo(0, 0);
  },

  init() {
    window.addEventListener('popstate', () => {
      const hash = location.hash.slice(1) || 'home';
      const [name, ...rest] = hash.split('/');
      this.go(name, rest.length ? { id: rest.join('/') } : {});
    });

    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-nav]');
      if (link) {
        e.preventDefault();
        const page = link.dataset.nav;
        location.hash = page;
        this.go(page, {});
      }
    });
  },
};
