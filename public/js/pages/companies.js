async function renderCompanies(el) {
  App.updateTitle('Empresas');

  el.innerHTML = `
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" id="search-companies" placeholder="Buscar empresas...">
    </div>
    <div class="quick-actions">
      <button class="btn btn-primary" id="btn-create-company">+ Crear Empresa</button>
      <button class="btn btn-outline" id="btn-my-companies">Mis Empresas</button>
      <button class="btn btn-outline" id="btn-join-requests">📨 Solicitudes <span id="pending-badge" class="badge badge-danger" style="display:none;margin-left:4px;"></span></button>
    </div>
    <div class="section-title">Mis Empresas</div>
    <div id="companies-list"></div>
  `;

  loadMyCompanies();
  loadPendingCount();

  let searchTimeout;
  document.getElementById('search-companies')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = e.target.value.trim();
      if (q.length >= 2) searchCompanies(q);
      else loadMyCompanies();
    }, 400);
  });

  document.getElementById('btn-create-company')?.addEventListener('click', () => {
    App.showModal(`
      <div class="modal-header">
        <h3>Nueva Empresa</h3>
        <button class="modal-close" onclick="App.hideModal()">✕</button>
      </div>
      <form id="form-create-company">
        <div class="input-group">
          <label>Nombre de la empresa</label>
          <input type="text" id="company-name" placeholder="Ej: AlvaroPM" required>
        </div>
        <div class="input-group">
          <label>Descripción (opcional)</label>
          <textarea id="company-desc" placeholder="Describe tu empresa..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Crear Empresa</button>
      </form>
    `);

    document.getElementById('form-create-company').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('company-name').value;
      const desc = document.getElementById('company-desc').value;
      try {
        await API.createCompany(name, desc);
        App.hideModal();
        App.showToast('Empresa creada', 'success');
        loadMyCompanies();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });
  });

  document.getElementById('btn-my-companies')?.addEventListener('click', () => {
    document.getElementById('search-companies').value = '';
    loadMyCompanies();
  });

  document.getElementById('btn-join-requests')?.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-page="companies"]')?.classList.add('active');
    location.hash = 'join-requests';
    Router.go('join-requests', {});
  });
}

async function loadMyCompanies() {
  const list = document.getElementById('companies-list');
  if (!list) return;
  const sectionTitle = document.querySelector('.section-title');
  if (sectionTitle) sectionTitle.textContent = 'Mis Empresas';

  try {
    const companies = await API.getCompanies();
    if (companies.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">🏢</div><p>No estás en ninguna empresa. Crea una o busca una.</p></div>';
      return;
    }

    let html = '';
    companies.forEach(c => {
      let roleBadge;
      if (c.role === 'owner') roleBadge = '<span class="badge badge-warning">Propietario</span>';
      else if (c.role === 'admin') roleBadge = '<span class="badge badge-primary">Admin</span>';
      else roleBadge = '<span class="badge badge-success">Miembro</span>';
      html += `
        <div class="list-item" data-company-id="${c.id}">
          <div class="item-icon">🏢</div>
          <div class="item-content">
            <div class="item-title">${c.name} ${roleBadge}</div>
            <div class="item-subtitle">${c.user_count || 0} miembros · ${c.description || ''}</div>
          </div>
          <div class="item-right">
            <span style="font-size:18px;">›</span>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
    list.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.companyId;
        location.hash = `company/${id}`;
        Router.go('company', { id });
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}

async function searchCompanies(q) {
  const list = document.getElementById('companies-list');
  if (!list) return;

  try {
    const companies = await API.searchCompanies(q);
    if (companies.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">🔍</div><p>No se encontraron empresas</p></div>';
      return;
    }

    document.querySelector('.section-title').textContent = `Resultados para "${q}"`;

    let html = '';
    companies.forEach(c => {
      html += `
        <div class="list-item" data-company-id="${c.id}">
          <div class="item-icon">🏢</div>
          <div class="item-content">
            <div class="item-title">${c.name}</div>
            <div class="item-subtitle">${c.user_count || 0} miembros</div>
          </div>
          <div class="item-right">
            <span style="font-size:18px;">›</span>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
    list.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.companyId;
        location.hash = `company/${id}`;
        Router.go('company', { id });
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}

async function loadPendingCount() {
  try {
    const received = await API.getIncomingRequests();
    const pending = received.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('pending-badge');
    if (badge) {
      if (pending > 0) {
        badge.textContent = pending;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch {}
}
