async function renderSessions(el) {
  App.updateTitle(I18n.t('title.sessions'));

  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date();
  firstDay.setMonth(firstDay.getMonth() - 3);
  const fromDefault = firstDay.toISOString().slice(0, 10);

  el.innerHTML = `
    <div class="search-bar" style="margin-bottom:4px;">
      <span class="search-icon">📅</span>
      <input type="date" id="filter-date-from" value="${fromDefault}" style="flex:1;border:none;background:transparent;font-size:14px;outline:none;">
      <span style="padding:0 4px;color:var(--text-muted);">→</span>
      <input type="date" id="filter-date-to" value="${today}" style="flex:1;border:none;background:transparent;font-size:14px;outline:none;">
      <button id="btn-clear-date-filter" class="btn btn-ghost btn-sm" style="padding:4px 8px;" title="Limpiar filtro">✕</button>
    </div>
    <div class="search-bar" style="margin-bottom:8px;">
      <span class="search-icon">🔍</span>
      <input type="text" id="filter-search-session" placeholder="Buscar por nombre..." style="flex:1;border:none;background:transparent;font-size:14px;outline:none;">
    </div>
    <div class="section-title">Historial de Sesiones</div>
    <div id="sessions-list"></div>
  `;

  const loadFiltered = () => {
    const from = document.getElementById('filter-date-from')?.value;
    const to = document.getElementById('filter-date-to')?.value;
    loadSessions(from, to);
  };

  document.getElementById('filter-date-from')?.addEventListener('change', loadFiltered);
  document.getElementById('filter-date-to')?.addEventListener('change', loadFiltered);
  document.getElementById('btn-clear-date-filter')?.addEventListener('click', () => {
    const d = new Date();
    document.getElementById('filter-date-from').value = new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().slice(0, 10);
    document.getElementById('filter-date-to').value = today;
    loadFiltered();
  });

  let searchTimeout;
  document.getElementById('filter-search-session')?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadFiltered, 300);
  });

  loadSessions(fromDefault, today);
}

async function loadSessions(from, to) {
  const list = document.getElementById('sessions-list');
  if (!list) return;

  try {
    let sessions = await API.getSessions();

    // Apply filters
    const searchTerm = document.getElementById('filter-search-session')?.value?.toLowerCase().trim();
    if (from) sessions = sessions.filter(s => s.session_date >= from);
    if (to) sessions = sessions.filter(s => s.session_date <= to);
    if (searchTerm) sessions = sessions.filter(s => s.name.toLowerCase().includes(searchTerm));

    if (sessions.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">📋</div><p>No hay sesiones en este rango de fechas</p></div>';
      return;
    }

    document.querySelector('.section-title').textContent = `Historial de Sesiones (${sessions.length})`;

    let html = '';
    sessions.forEach(s => {
      const date = new Date(s.session_date).toLocaleDateString('es', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const status = s.is_closed ? '<span class="badge badge-success">Cerrada</span>' : '<span class="badge badge-warning">Activa</span>';
      const notesIcon = s.notes ? '<span title="Tiene notas">📝</span>' : '';
      html += `
        <div class="list-item" data-session-id="${s.id}">
          <div class="item-icon">${s.is_closed ? '✅' : '📋'}</div>
          <div class="item-content">
            <div class="item-title">${s.name} ${status} ${notesIcon}</div>
            <div class="item-subtitle">${date} · ${s.company_name} · ${s.item_count} productos</div>
          </div>
          <div class="item-right">
            <div class="item-amount">${s.total_amount.toFixed(2)}€</div>
            <div class="item-date">${s.created_by_name}</div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
    list.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.sessionId;
        showSessionDetail(id);
      });
    });
  } catch (err) {
    document.getElementById('sessions-list').innerHTML =
      `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}

async function showSessionDetail(sessionId) {
  try {
    const data = await API.getSession(sessionId);
    const s = data.session;

    const date = new Date(s.session_date).toLocaleDateString('es', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <button class="btn btn-ghost btn-sm" id="btn-back-sessions-detail">← Volver</button>
        <div style="flex:1;text-align:center;font-weight:600;">${s.name}</div>
      </div>
      ${s.notes ? `<div style="font-size:12px;color:var(--text-secondary);background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm);margin-bottom:12px;">📝 ${s.notes}</div>` : ''}

      <div class="session-total">
        <div class="total-label">Total</div>
        <div class="total-value">${data.summary.total_amount.toFixed(2)}€</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${data.summary.total_items}</div>
          <div class="stat-label">Productos</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏷️</div>
          <div class="stat-value">${data.summary.unique_products}</div>
          <div class="stat-label">Únicos</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${data.summary.unique_sellers}</div>
          <div class="stat-label">Vendedores</div>
        </div>
        <div class="stat-card ${s.is_closed ? 'success' : 'warning'}">
          <div class="stat-icon">${s.is_closed ? '✅' : '⏳'}</div>
          <div class="stat-value">${s.is_closed ? 'Cerrada' : 'Activa'}</div>
          <div class="stat-label">Estado</div>
        </div>
      </div>
    `;

    if (data.bySeller && data.bySeller.length > 0) {
      html += '<div class="section-title">Por vendedor</div>';
      data.bySeller.forEach(bs => {
        html += `
          <div class="list-item" style="cursor:default;">
            <div class="item-icon">👤</div>
            <div class="item-content">
              <div class="item-title">${bs.name}</div>
              <div class="item-subtitle">${bs.items} productos</div>
            </div>
            <div class="item-right"><div class="item-amount">${bs.total.toFixed(2)}€</div></div>
          </div>
        `;
      });
    }

    html += '<div class="section-title">Productos vendidos</div>';

    if (data.sales.length === 0) {
      html += '<div class="list-empty"><div class="empty-icon">🛒</div><p>No hay productos en esta sesión</p></div>';
    } else {
      data.sales.forEach(sale => {
        const imgHtml = sale.image_url ? `<img src="${sale.image_url}" style="width:36px;height:36px;border-radius:var(--radius-sm);object-fit:cover;margin-right:8px;flex-shrink:0;">` : '';
        html += `
          <div class="sale-item">
            ${imgHtml}
            <div class="sale-info">
              <div class="sale-name">${sale.product_name}</div>
              <div class="sale-meta">${sale.sold_by_name || '—'} · ${sale.quantity}x</div>
            </div>
            <div class="sale-price">${(sale.price * sale.quantity).toFixed(2)}€</div>
          </div>
        `;
      });
    }

    const isOpen = !s.is_closed;
    html += `
      <div class="pdf-actions" style="margin-top:16px;">
        <button class="btn btn-success" id="btn-pdf-detail">📄 PDF</button>
        <button class="btn btn-outline" id="btn-csv-detail">📊 CSV</button>
        <button class="btn btn-outline" id="btn-xlsx-detail">📗 Excel</button>
        ${isOpen ? `<button class="btn btn-primary" id="btn-continue-selling" data-session-id="${s.id}">➕ Seguir vendiendo</button>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-outline" id="btn-edit-session" style="flex:1;">✏️ Editar sesión</button>
        <button class="btn btn-danger" id="btn-delete-session" style="flex:1;">🗑️ Eliminar</button>
      </div>
    `;

    const mainContent = document.getElementById(Router.containerId);
    mainContent.innerHTML = html;

    document.getElementById('btn-back-sessions-detail')?.addEventListener('click', () => {
      renderSessions(mainContent);
    });

    document.getElementById('btn-pdf-detail')?.addEventListener('click', () => {
      generatePDFFromData(data);
    });

    document.getElementById('btn-csv-detail')?.addEventListener('click', () => {
      API.downloadSessionCSV(s.id).catch(err => App.showToast(err.message, 'error'));
    });
    document.getElementById('btn-xlsx-detail')?.addEventListener('click', () => {
      API.downloadSessionXLSX(s.id).catch(err => App.showToast(err.message, 'error'));
    });

    document.getElementById('btn-edit-session')?.addEventListener('click', () => {
      App.showModal(`
        <div class="modal-header">
          <h3>Editar Sesión</h3>
          <button class="modal-close" onclick="App.hideModal()">✕</button>
        </div>
        <form id="form-edit-session">
          <div class="input-group">
            <label>Nombre de la sesión</label>
            <input type="text" id="edit-session-name" value="${s.name.replace(/"/g, '&quot;')}" required>
          </div>
          <div class="input-group">
            <label>Fecha</label>
            <input type="date" id="edit-session-date" value="${s.session_date}" required>
          </div>
          <div class="input-group">
            <label>Notas</label>
            <textarea id="edit-session-notes" placeholder="Notas del día...">${(s.notes || '').replace(/"/g, '&quot;')}</textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Guardar Cambios</button>
        </form>
      `);

      document.getElementById('form-edit-session').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('edit-session-name').value;
        const session_date = document.getElementById('edit-session-date').value;
        const notes = document.getElementById('edit-session-notes').value;
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner spinner-white"></span>';
        try {
          await API.updateSession(s.id, { name, session_date, notes });
          App.hideModal();
          App.showToast('Sesión actualizada', 'success');
          showSessionDetail(s.id);
        } catch (err) {
          App.showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Guardar Cambios';
        }
      });
    });

    document.getElementById('btn-delete-session')?.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar la sesión "${s.name}"? Esta acción no se puede deshacer.`)) return;
      try {
        await API.deleteSession(s.id);
        App.showToast('Sesión eliminada', 'success');
        renderSessions(mainContent);
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-continue-selling')?.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-page="sales"]').classList.add('active');
      Router.go('sales', {});
      setTimeout(() => {
        loadSessionDetails(s.id);
      }, 100);
    });
  } catch (err) {
    App.showToast('Error: ' + err.message, 'error');
  }
}

function generatePDFFromData(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const s = data.session;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(s.name, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const date = new Date(s.session_date).toLocaleDateString('es');
  doc.text(`Fecha: ${date}`, pageWidth / 2, 28, { align: 'center' });

  const tableData = data.sales.map(sale => [
    sale.product_name,
    sale.quantity + 'x',
    sale.price.toFixed(2) + '€',
    (sale.price * sale.quantity).toFixed(2) + '€',
    sale.sold_by_name || '—'
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Producto', 'Cant', 'Precio', 'Total', 'Vendedor']],
    body: tableData,
    foot: [['', '', '', `Total: ${data.summary.total_amount.toFixed(2)}€`, '']],
    theme: 'grid',
    headStyles: { fillColor: [18, 89, 243], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  const today = new Date().toLocaleString('es');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generado el ${today} · Notas de Venta`, pageWidth / 2, 285, { align: 'center' });

  doc.save(`${s.name.replace(/\s+/g, '_')}_${s.session_date}.pdf`);
  App.showToast('PDF generado', 'success');
}
