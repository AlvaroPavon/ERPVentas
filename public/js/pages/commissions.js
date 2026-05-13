async function renderCommissions(el, params) {
  App.updateTitle('Comisiones');

  const companyId = params.id;
  if (!companyId) {
    // Show list of companies to pick from
    try {
      const companies = await API.getCompanies();
      if (companies.length === 0) {
        el.innerHTML = '<div class="list-empty"><div class="empty-icon">🏢</div><p>No tienes empresas. Crea una primero.</p></div>';
        return;
      }

      let html = '<div class="section-title">Selecciona una empresa</div>';
      companies.forEach(c => {
        html += `
          <div class="list-item" data-company-id="${c.id}" style="cursor:pointer;">
            <div class="item-icon">🏢</div>
            <div class="item-content">
              <div class="item-title">${c.name}</div>
              <div class="item-subtitle">${c.user_count} miembros</div>
            </div>
            <div class="item-right"><span style="font-size:18px;">›</span></div>
          </div>
        `;
      });

      el.innerHTML = html;

      el.querySelectorAll('[data-company-id]').forEach(item => {
        item.addEventListener('click', () => {
          location.hash = `commissions/${item.dataset.companyId}`;
          Router.go('commissions', { id: item.dataset.companyId });
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
    }
    return;
  }

  // Get company name
  let companyName = '';
  try {
    const companies = await API.getCompanies();
    const company = companies.find(c => c.id === parseInt(companyId));
    companyName = company?.name || '';
  } catch {}

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <button class="btn btn-ghost btn-sm" id="btn-back-commissions">← Comisiones</button>
      <div style="flex:1;text-align:center;font-weight:600;">${companyName}</div>
    </div>

    <div class="section-title">⚙️ Configuración de Comisiones</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">
      Porcentaje de comisión sobre ventas cerradas por cada rol.
      El propietario no recibe comisión automática.
    </div>
    <div id="commission-config"></div>

    <div class="section-title" style="margin-top:20px;">📊 Resumen de Comisiones</div>
    <div id="commission-summary">
      <div style="text-align:center;padding:20px;"><div class="spinner"></div></div>
    </div>
  `;

  loadCommissionConfig(companyId);
  loadCommissionSummary(companyId);

  document.getElementById('btn-back-commissions')?.addEventListener('click', () => {
    location.hash = 'commissions';
    Router.go('commissions', {});
  });
}

async function loadCommissionConfig(companyId) {
  const container = document.getElementById('commission-config');
  if (!container) return;

  try {
    const config = await API.getCommissionConfig(companyId);
    const labels = { admin: 'Administrador', member: 'Miembro', cashier: 'Cajero' };

    let html = '';
    config.forEach(c => {
      const label = labels[c.role] || c.role;
      html += `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:8px 12px;background:var(--surface);border-radius:var(--radius-sm);">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${label}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="number" id="comm-${c.role}" value="${c.commission_pct}" min="0" max="100" step="0.5"
              style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;text-align:right;background:var(--surface-2);color:var(--text);">
            <span style="font-size:12px;color:var(--text-secondary);">%</span>
            <button class="btn btn-sm btn-primary" onclick="saveCommission(${companyId}, '${c.role}')" style="padding:6px 12px;font-size:12px;">Guardar</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="list-empty"><p>Error: ${err.message}</p></div>`;
  }
}

async function saveCommission(companyId, role) {
  const input = document.getElementById(`comm-${role}`);
  const pct = parseFloat(input.value);

  if (isNaN(pct) || pct < 0 || pct > 100) {
    App.showToast('Porcentaje inválido (0-100)', 'error');
    return;
  }

  try {
    await API.updateCommissionConfig(companyId, role, pct);
    App.showToast(`Comisión de ${role} actualizada a ${pct}%`, 'success');
  } catch (err) {
    App.showToast(err.message, 'error');
  }
}

async function loadCommissionSummary(companyId) {
  const container = document.getElementById('commission-summary');
  if (!container) return;

  try {
    const summary = await API.getCommissionSummary(companyId);

    if (summary.length === 0) {
      container.innerHTML = '<div class="list-empty"><div class="empty-icon">📊</div><p>No hay datos de comisiones aún. Cierra algunas sesiones de venta.</p></div>';
      return;
    }

    let html = '<div class="stats-grid">';

    summary.forEach(s => {
      const labels = { admin: 'Administrador', member: 'Miembro', cashier: 'Cajero' };
      const commTotal = parseFloat(s.total_commission || 0);
      html += `
        <div class="stat-card ${commTotal > 0 ? 'primary' : ''}">
          <div class="stat-icon">👤</div>
          <div class="stat-value">${commTotal.toFixed(2)}€</div>
          <div class="stat-label">${labels[s.role] || s.role}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
            ${s.items_sold} ventas · ${parseFloat(s.total_sales || 0).toFixed(2)}€ (${s.commission_pct}%)
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Total commissions
    const total = summary.reduce((sum, s) => sum + parseFloat(s.total_commission || 0), 0);
    html += `
      <div style="margin-top:16px;padding:12px;background:var(--surface);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:13px;color:var(--text-secondary);">Total Comisiones Pendientes</div>
        <div style="font-size:24px;font-weight:700;color:var(--primary);margin-top:4px;">${total.toFixed(2)}€</div>
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="list-empty"><p>Error: ${err.message}</p></div>`;
  }
}