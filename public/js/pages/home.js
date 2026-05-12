let homeCharts = {};

const WIDGETS = [
  { id: 'stats', label: 'Resumen global', icon: '💰', default: true },
  { id: 'monthly', label: 'Ventas del Mes (gráfico)', icon: '📈', default: true },
  { id: 'topProducts', label: 'Productos Más Vendidos', icon: '🏆', default: true },
  { id: 'dailyComparison', label: 'Comparativa por Día', icon: '📅', default: true },
  { id: 'advancedStats', label: 'Estadísticas Avanzadas', icon: '📊', default: true },
];

function getWidgetSettings() {
  try {
    const saved = localStorage.getItem('dashboardWidgets');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...Object.fromEntries(WIDGETS.map(w => [w.id, w.default])), ...parsed };
    }
  } catch {}
  return Object.fromEntries(WIDGETS.map(w => [w.id, w.default]));
}

function saveWidgetSettings(settings) {
  localStorage.setItem('dashboardWidgets', JSON.stringify(settings));
}

function isWidgetEnabled(id) {
  return getWidgetSettings()[id] !== false;
}

function destroyHomeCharts() {
  Object.values(homeCharts).forEach(c => { try { c.destroy(); } catch {} });
  homeCharts = {};
}

async function renderHome(el) {
  App.updateTitle('Inicio');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
      <button class="btn btn-ghost btn-sm" id="btn-customize-dashboard" style="font-size:12px;">⚙️ Personalizar</button>
    </div>

    <div id="widget-stats" ${!isWidgetEnabled('stats') ? 'style="display:none;"' : ''}>
      <div class="stats-grid" id="home-stats">
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
      </div>
    </div>

    <div class="chip-group" id="month-selector">
      ${generateMonthChips(year, month)}
    </div>

    <div id="widget-monthly" ${!isWidgetEnabled('monthly') ? 'style="display:none;"' : ''}>
      <div class="card">
        <div class="card-title">📈 Ventas del Mes</div>
        <div class="chart-container"><canvas id="chart-monthly"></canvas></div>
      </div>
    </div>

    <div id="widget-topProducts" ${!isWidgetEnabled('topProducts') ? 'style="display:none;"' : ''}>
      <div class="card">
        <div class="card-title">🏆 Productos Más Vendidos</div>
        <div class="chart-container"><canvas id="chart-top"></canvas></div>
      </div>
    </div>

    <div id="widget-dailyComparison" ${!isWidgetEnabled('dailyComparison') ? 'style="display:none;"' : ''}>
      <div class="card">
        <div class="card-title">📅 Comparativa por Día</div>
        <div class="chart-container"><canvas id="chart-daily"></canvas></div>
      </div>
    </div>

    <div id="widget-advancedStats" ${!isWidgetEnabled('advancedStats') ? 'style="display:none;"' : ''}>
      <div class="section-title" style="margin-top:16px;">📊 Estadísticas Avanzadas</div>
      <div id="advanced-stats">
        <div class="stats-grid">
          <div class="stat-card"><div class="spinner"></div></div>
          <div class="stat-card"><div class="spinner"></div></div>
        </div>
      </div>
      <div class="card" id="card-advanced-monthly" style="display:none;">
        <div class="card-title">📊 Tendencia Mensual (6 meses)</div>
        <div class="chart-container"><canvas id="chart-monthly-trend"></canvas></div>
      </div>
      <div class="card" id="card-advanced-sellers" style="display:none;">
        <div class="card-title">👥 Ventas por Vendedor</div>
        <div id="sellers-breakdown"></div>
      </div>
    </div>
  `;

  if (Object.values(getWidgetSettings()).every(v => v === false)) {
    el.innerHTML += '<div class="list-empty" style="margin-top:16px;"><div class="empty-icon">👁️</div><p>Todos los widgets están ocultos. Haz clic en ⚙️ Personalizar para mostrarlos.</p></div>';
  }

  loadHomeData(year, month);

  document.getElementById('month-selector')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#month-selector .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const [y, m] = chip.dataset.month.split('-');
    destroyHomeCharts();
    loadHomeData(parseInt(y), parseInt(m));
  });

  document.getElementById('btn-customize-dashboard')?.addEventListener('click', showCustomizeModal);
}

function showCustomizeModal() {
  const settings = getWidgetSettings();
  let itemsHtml = WIDGETS.map(w => `
    <div class="list-item" style="cursor:pointer;" data-widget-id="${w.id}">
      <div class="item-icon">${w.icon}</div>
      <div class="item-content">
        <div class="item-title">${w.label}</div>
      </div>
      <div class="item-right"><span class="toggle-indicator" style="font-size:20px;">${settings[w.id] ? '✅' : '☐'}</span></div>
    </div>
  `).join('');

  App.showModal(`
    <div class="modal-header">
      <h3>Personalizar Dashboard</h3>
      <button class="modal-close" onclick="App.hideModal()">✕</button>
    </div>
    <div style="padding:8px 0;">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;padding:0 16px;">Selecciona qué secciones mostrar:</div>
      ${itemsHtml}
    </div>
  `);

  function refreshDashboard() {
    App.hideModal();
    const pageContent = document.getElementById(Router.containerId);
    destroyHomeCharts();
    renderHome(pageContent);
  }

  document.querySelectorAll('#modal-content .list-item[data-widget-id]').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.widgetId;
      const settings = getWidgetSettings();
      settings[id] = !settings[id];
      saveWidgetSettings(settings);
      item.querySelector('.toggle-indicator').textContent = settings[id] ? '✅' : '☐';
    });
  });

  // Refresh on any modal close
  const modalOverlay = document.getElementById('modal-overlay');
  const origOnclick = modalOverlay.onclick;
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) refreshDashboard();
  };
  const closeBtn = document.querySelector('#modal-content .modal-close');
  if (closeBtn) {
    closeBtn.onclick = refreshDashboard;
  }
}

function generateMonthChips(year, currentMonth) {
  let html = '';
  for (let i = 0; i < 12; i++) {
    const m = currentMonth - i;
    let y = year;
    let mo = m;
    if (mo <= 0) { mo += 12; y -= 1; }
    const label = new Date(y, mo - 1, 1).toLocaleString('es', { month: 'short' });
    const active = (i === 0) ? 'active' : '';
    html += `<span class="chip ${active}" data-month="${y}-${String(mo).padStart(2,'0')}">${label} ${y}</span>`;
  }
  return html;
}

async function loadHomeData(year, month) {
  try {
    const [overview, monthly, top, daily, advanced] = await Promise.all([
      API.getOverview(),
      API.getMonthly(year, month),
      API.getTopProducts(5),
      API.getDailyComparison(20),
      API.getAdvancedStats()
    ]);

    if (isWidgetEnabled('stats')) renderHomeStats(overview);
    if (isWidgetEnabled('monthly')) renderMonthlyChart(monthly);
    if (isWidgetEnabled('topProducts')) renderTopProductsChart(top);
    if (isWidgetEnabled('dailyComparison')) renderDailyChart(daily);
    if (isWidgetEnabled('advancedStats')) renderAdvancedStats(advanced);
  } catch (err) {
    App.showToast('Error al cargar datos: ' + err.message, 'error');
  }
}

function renderAdvancedStats(data) {
  const container = document.getElementById('advanced-stats');
  if (!container) return;

  const thisWeek = data.thisWeek;
  const lastWeek = data.lastWeek;
  const diff = lastWeek.total > 0 ? ((thisWeek.total - lastWeek.total) / lastWeek.total * 100).toFixed(1) : 0;
  const trend = diff >= 0 ? '📈' : '📉';

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-value">${data.avgTicket.toFixed(2)}€</div>
        <div class="stat-label">Ticket Promedio</div>
      </div>
      <div class="stat-card ${diff >= 0 ? 'success' : 'warning'}">
        <div class="stat-icon">${trend}</div>
        <div class="stat-value">${thisWeek.total.toFixed(2)}€</div>
        <div class="stat-label">Esta semana (${diff}% vs anterior)</div>
      </div>
    </div>
  `;

  // Monthly trend chart
  if (data.monthlyTrends && data.monthlyTrends.length > 1) {
    const card = document.getElementById('card-advanced-monthly');
    card.style.display = 'block';
    const canvas = document.getElementById('chart-monthly-trend');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (homeCharts.monthlyTrend) { try { homeCharts.monthlyTrend.destroy(); } catch {} }
      const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      homeCharts.monthlyTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.monthlyTrends.map(d => {
            const [y, m] = d.month.split('-');
            return `${monthNames[parseInt(m)-1]} ${y}`;
          }),
          datasets: [{
            label: 'Ingresos',
            data: data.monthlyTrends.map(d => d.total),
            borderColor: '#0381fe',
            backgroundColor: 'rgba(3, 129, 254, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#0381fe',
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => v + '€' } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  }

  // Sellers breakdown
  if (data.bySeller && data.bySeller.length > 0) {
    const card = document.getElementById('card-advanced-sellers');
    card.style.display = 'block';
    const list = document.getElementById('sellers-breakdown');
    const total = data.bySeller.reduce((s, v) => s + v.total, 0);
    let html = '';
    data.bySeller.forEach(s => {
      const pct = ((s.total / total) * 100).toFixed(1);
      html += `
        <div class="sale-item">
          <div class="sale-info">
            <div class="sale-name">${s.name}</div>
            <div class="sale-meta">${s.items} productos · ${pct}% del total</div>
          </div>
          <div class="sale-price">${s.total.toFixed(2)}€</div>
        </div>
      `;
    });
    list.innerHTML = html;
  }
}

function renderHomeStats(overview) {
  document.getElementById('home-stats').innerHTML = `
    <div class="stat-card primary">
      <div class="stat-icon">💰</div>
      <div class="stat-value">${overview.totalSales.toFixed(2)}€</div>
      <div class="stat-label">Ventas Totales</div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon">📦</div>
      <div class="stat-value">${overview.totalItems}</div>
      <div class="stat-label">Productos Vendidos</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon">📋</div>
      <div class="stat-value">${overview.totalSessions}</div>
      <div class="stat-label">Sesiones</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🏢</div>
      <div class="stat-value">${overview.companies}</div>
      <div class="stat-label">Empresas</div>
    </div>
  `;
}

function renderMonthlyChart(data) {
  const canvas = document.getElementById('chart-monthly');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (!data.dailySales || data.dailySales.length === 0) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary)">No hay datos este mes</p>';
    return;
  }

  homeCharts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.dailySales.map(d => {
        const dt = new Date(d.session_date);
        return `${dt.getDate()} ${dt.toLocaleString('es',{month:'short'})}`;
      }),
      datasets: [{
        label: 'Ingresos (€)',
        data: data.dailySales.map(d => d.amount),
        backgroundColor: 'rgba(18, 89, 243, 0.7)',
        borderColor: 'rgba(18, 89, 243, 1)',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v + '€' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderTopProductsChart(data) {
  const canvas = document.getElementById('chart-top');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (!data || data.length === 0) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary)">Aún no hay productos</p>';
    return;
  }

  const colors = ['#1259F3','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const top = data.slice(0, 8);

  homeCharts.top = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: top.map(p => p.product_name),
      datasets: [{
        data: top.map(p => p.total_revenue),
        backgroundColor: colors.slice(0, top.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, font: { size: 11 } }
        }
      }
    }
  });
}

function renderDailyChart(data) {
  const canvas = document.getElementById('chart-daily');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (!data || data.length === 0) {
    canvas.parentElement.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary)">No hay sesiones registradas</p>';
    return;
  }

  const recent = data.slice(0, 15).reverse();

  homeCharts.daily = new Chart(ctx, {
    type: 'line',
    data: {
      labels: recent.map(d => {
        const dt = new Date(d.session_date);
        return `${dt.getDate()}/${dt.getMonth()+1}`;
      }),
      datasets: [{
        label: 'Total (€)',
        data: recent.map(d => d.total_amount),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v + '€' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}
