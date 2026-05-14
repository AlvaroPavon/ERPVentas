let inventoryCharts = {};

async function renderInventory(el, params) {
  App.updateTitle(I18n.t('title.inventory'));

  const companyId = params.id;
  if (!companyId) {
    el.innerHTML = '<div class="list-empty"><div class="empty-icon">🏢</div><p>Selecciona una empresa desde el menú de empresas</p></div>';
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
      <button class="btn btn-ghost btn-sm" id="btn-back-companies">← Empresas</button>
      <div style="flex:1;text-align:center;font-weight:600;">${companyName}</div>
    </div>

    <div id="inventory-alerts" style="margin-bottom:12px;"></div>

    <div class="section-title">📦 Stock Actual</div>
    <div id="inventory-list"></div>

    <div style="display:flex;gap:8px;margin-top:16px;">
      <button class="btn btn-outline" id="btn-export-catalog-csv" style="flex:1;">📊 Exportar CSV</button>
      <button class="btn btn-outline" id="btn-export-catalog-xlsx" style="flex:1;">📗 Exportar Excel</button>
    </div>
  `;

  loadInventory(companyId);

  document.getElementById('btn-back-companies')?.addEventListener('click', () => {
    location.hash = 'companies';
    Router.go('companies', {});
  });

  document.getElementById('btn-export-catalog-csv')?.addEventListener('click', () => {
    API.downloadBlob(`/api/companies/${companyId}/export/csv`, `catalogo_${companyId}.csv`).catch(err => App.showToast(err.message, 'error'));
  });

  document.getElementById('btn-export-catalog-xlsx')?.addEventListener('click', () => {
    API.downloadBlob(`/api/companies/${companyId}/export/xlsx`, `catalogo_${companyId}.xlsx`).catch(err => App.showToast(err.message, 'error'));
  });
}

async function loadInventory(companyId) {
  const list = document.getElementById('inventory-list');
  const alertsEl = document.getElementById('inventory-alerts');
  try {
    const inventory = await API.getInventory(companyId);

    // Check for low stock alerts
    const lowStock = inventory.filter(i => i.stock <= (i.min_stock || 0) && i.stock > 0);
    const outOfStock = inventory.filter(i => i.stock <= 0);

    if (lowStock.length > 0 || outOfStock.length > 0) {
      let alertHtml = '<div style="font-size:12px;color:var(--warning);margin-bottom:8px;padding:8px 12px;background:var(--warning-bg);border-radius:var(--radius-sm);">';
      alertHtml += '⚠️ ';
      const alerts = [];
      if (outOfStock.length > 0) alerts.push(`${outOfStock.length} productos sin stock`);
      if (lowStock.length > 0) alerts.push(`${lowStock.length} productos con stock bajo`);
      alertHtml += alerts.join(' · ');
      alertHtml += '</div>';
      alertsEl.innerHTML = alertHtml;
    }

    if (inventory.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">📦</div><p>No hay productos en el catálogo. Añade productos primero.</p></div>';
      return;
    }

    let html = '';
    inventory.forEach(item => {
      const isLow = item.stock <= (item.min_stock || 0);
      const stockColor = item.stock <= 0 ? 'var(--danger)' : (isLow ? 'var(--warning)' : 'var(--success)');

      html += `
        <div class="list-item">
          <div class="item-icon" style="background:${isLow ? 'var(--warning-bg)' : 'var(--surface-2)'};border-radius:var(--radius-sm);padding:4px;">
            ${item.image_url ? `<img src="${item.image_url}" style="width:32px;height:32px;border-radius:var(--radius-sm);object-fit:cover;">` : '📦'}
          </div>
          <div class="item-content">
            <div class="item-title">${item.product_name}</div>
            <div class="item-subtitle">${item.category || 'Sin categoría'} · Mín: ${item.min_stock || 0}</div>
          </div>
          <div class="item-right" style="text-align:right;">
            <div class="item-amount" style="color:${stockColor};font-weight:700;">${item.stock}</div>
            <div style="font-size:11px;color:var(--text-muted);">uds</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-sm btn-success" onclick="quickStockAction(${companyId}, ${item.product_id}, 'add')" title="Añadir stock" style="padding:4px 8px;font-size:14px;">+</button>
            <button class="btn btn-sm btn-danger" onclick="quickStockAction(${companyId}, ${item.product_id}, 'remove')" title="Retirar stock" style="padding:4px 8px;font-size:14px;">−</button>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
  } catch (err) {
    list.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}

function quickStockAction(companyId, productId, action) {
  const qty = prompt(action === 'add' ? 'Cantidad a añadir:' : 'Cantidad a retirar:');
  if (!qty || parseInt(qty) <= 0) return;

  const notes = prompt('Notas (opcional):') || '';

  if (action === 'add') {
    API.addStock(companyId, productId, parseInt(qty), notes).then(() => {
      App.showToast('Stock añadido', 'success');
      const el = document.getElementById(Router.containerId);
      renderInventory(el, { id: companyId });
    }).catch(err => App.showToast(err.message, 'error'));
  } else {
    API.removeStock(companyId, productId, parseInt(qty), notes).then(() => {
      App.showToast('Stock retirado', 'success');
      const el = document.getElementById(Router.containerId);
      renderInventory(el, { id: companyId });
    }).catch(err => App.showToast(err.message, 'error'));
  }
}