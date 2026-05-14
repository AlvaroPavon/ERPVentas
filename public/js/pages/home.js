let homeCharts = {};
let selectedCompanyId = null;
let userCompanies = [];

const WIDGETS = [
  { id: 'stats', labelKey: 'widget.stats', icon: '💰', default: true },
  { id: 'monthly', labelKey: 'widget.monthly', icon: '📈', default: true },
  { id: 'topProducts', labelKey: 'widget.topProducts', icon: '🏆', default: true },
  { id: 'dailyComparison', labelKey: 'widget.dailyComparison', icon: '📅', default: true },
  { id: 'advancedStats', labelKey: 'widget.advancedStats', icon: '📊', default: true },
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

function isAdminOrOwner(companies) {
  return companies.some(c => c.role === 'admin' || c.role === 'owner');
}

async function renderHome(el) {
  App.updateTitle(I18n.t('dashboard.title'));

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Fetch user companies for the company selector
  userCompanies = [];
  selectedCompanyId = null;
  let hasPrivilegedRole = false;
  try {
    userCompanies = await API.getCompanies();
    hasPrivilegedRole = isAdminOrOwner(userCompanies);
  } catch (err) {
    console.error('Failed to fetch companies:', err);
  }

  const companySelectorHtml = hasPrivilegedRole && userCompanies.length > 0 ? `
    <div class="company-selector">
      <select id="company-select" class="company-select" style="font-size:12px;padding:4px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
        <option value="">${I18n.t('dashboard.allCompanies')}</option>
        ${userCompanies.map(c => `<option value="${c.id}" ${selectedCompanyId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>
  ` : '';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;" class="dashboard-toolbar">
      <div style="display:flex;align-items:center;gap:8px;">
        ${companySelectorHtml}
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-customize-dashboard" style="font-size:12px;">⚙️ ${I18n.t('dashboard.customize')}</button>
    </div>

    <div id="widget-stats" ${!isWidgetEnabled('stats') ? 'style="display:none;"' : ''}>
      <div class="stats-grid" id="home-stats">
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
        <div class="stat-card"><div class="spinner"></div></div>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;" id="month-selector">
      <select id="month-picker" style="flex:1;font-size:14px;padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);">
        ${generateMonthOptions(year, month)}
      </select>
    </div>

    <div id="widget-monthly" ${!isWidgetEnabled('monthly') ? 'style="display:none;"' : ''}>
      <div class="card">
        <div class="card-title">📈 ${I18n.t('chart.monthlySales')}</div>
        <div class="chart-container"><canvas id="chart-monthly"></canvas></div>
      </div>
    </div>

    <div id="widget-topProducts" ${!isWidgetEnabled('topProducts') ? 'style="display:none;"' : ''}>
      <div class="card">
        <div class="card-title">🏆 ${I18n.t('chart.topProducts')}</div>
        <div class="chart-container"><canvas id="chart-top"></canvas></div>
      </div>
    </div>

    <div id="widget-dailyComparison" ${!isWidgetEnabled('dailyComparison') ? 'style="display:none;"' : ''}>
      <div class="card">
        <div class="card-title">📅 ${I18n.t('chart.dailyComparison')}</div>
        <div class="chart-container"><canvas id="chart-daily"></canvas></div>
      </div>
    </div>

    <div id="widget-advancedStats" ${!isWidgetEnabled('advancedStats') ? 'style="display:none;"' : ''}>
      <div class="section-title" style="margin-top:16px;">📊 ${I18n.t('widget.advancedStats')}</div>
      <div id="advanced-stats">
        <div class="stats-grid">
          <div class="stat-card"><div class="spinner"></div></div>
          <div class="stat-card"><div class="spinner"></div></div>
        </div>
      </div>
      <div class="card" id="card-advanced-monthly" style="display:none;">
        <div class="card-title">📊 ${I18n.t('chart.monthlyTrend')}</div>
        <div class="chart-container"><canvas id="chart-monthly-trend"></canvas></div>
      </div>
      <div class="card" id="card-advanced-sellers" style="display:none;">
        <div class="card-title">👥 ${I18n.t('chart.sellersBreakdown')}</div>
        <div id="sellers-breakdown"></div>
      </div>
    </div>
  `;

  if (Object.values(getWidgetSettings()).every(v => v === false)) {
    el.innerHTML += `<div class="list-empty" style="margin-top:16px;"><div class="empty-icon">👁️</div><p>${I18n.t('dashboard.noWidgets')}</p></div>`;
  }

  loadHomeData(year, month, selectedCompanyId);

  document.getElementById('month-picker')?.addEventListener('change', (e) => {
    const [y, m] = e.target.value.split('-');
    destroyHomeCharts();
    loadHomeData(parseInt(y), parseInt(m), selectedCompanyId);
  });

  document.getElementById('btn-customize-dashboard')?.addEventListener('click', showCustomizeModal);

  // Company selector change handler
  document.getElementById('company-select')?.addEventListener('change', (e) => {
    selectedCompanyId = e.target.value || null;
    destroyHomeCharts();
    loadHomeData(year, month, selectedCompanyId);
  });
}

function showCustomizeModal() {
  const settings = getWidgetSettings();
  let itemsHtml = WIDGETS.map(w => `
    <div class="list-item" style="cursor:pointer;" data-widget-id="${w.id}">
      <div class="item-icon">${w.icon}</div>
      <div class="item-content">
        <div class="item-title">${I18n.t(w.labelKey)}</div>
      </div>
      <div class="item-right"><span class="toggle-indicator" style="font-size:20px;">${settings[w.id] ? '✅' : '☐'}</span></div>
    </div>
  `).join('');

  App.showModal(`
    <div class="modal-header">
      <h3>${I18n.t('modal.customizeDashboard')}</h3>
      <button class="modal-close" onclick="App.hideModal()">✕</button>
    </div>
    <div style="padding:8px 0;">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;padding:0 16px;">${I18n.t('modal.selectSections')}</div>
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

function generateMonthOptions(year, currentMonth) {
  const monthNames = I18n.t('month.short');
  let opts = '';
  for (let i = 0; i < 12; i++) {
    const m = currentMonth - i;
    let y = year;
    let mo = m;
    if (mo <= 0) { mo += 12; y -= 1; }
    const label = monthNames[mo - 1] || '';
    const selected = (i === 0) ? 'selected' : '';
    opts += `<option value="${y}-${String(mo).padStart(2,'0')}" ${selected}>${label} ${y}</option>`;
  }
  return opts;
}

async function loadHomeData(year, month, companyId) {
  try {
    const [overview, monthly, top, daily, advanced] = await Promise.all([
      API.getOverview(companyId),
      API.getMonthly(year, month, companyId),
      API.getTopProducts(5, companyId),
      API.getDailyComparison(20, companyId),
      API.getAdvancedStats(companyId)
    ]);

    if (isWidgetEnabled('stats')) renderHomeStats(overview, monthly);
    if (isWidgetEnabled('monthly')) renderMonthlyChart(monthly);
    if (isWidgetEnabled('topProducts')) renderTopProductsChart(top);
    if (isWidgetEnabled('dailyComparison')) renderDailyChart(daily);
    if (isWidgetEnabled('advancedStats')) renderAdvancedStats(advanced);
  } catch (err) {
    App.showToast(I18n.t('common.error') + ': ' + err.message, 'error');
  }
}

function renderAdvancedStats(data) {
  const container = document.getElementById('advanced-stats');
  if (!container) return;

  const thisWeek = data.thisWeek || { total: 0, sessions: 0, items: 0 };
  const lastWeek = data.lastWeek || { total: 0, sessions: 0, items: 0 };
  const avgTicket = data.avgTicket || 0;
  const diff = lastWeek.total > 0 ? parseFloat(((thisWeek.total - lastWeek.total) / lastWeek.total * 100).toFixed(1)) : 0;
  const trend = diff >= 0 ? '📈' : '📉';

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-value">${avgTicket.toFixed(2)}€</div>
        <div class="stat-label">${I18n.t('stats.averageTicket')}</div>
      </div>
      <div class="stat-card ${diff >= 0 ? 'success' : 'warning'}">
        <div class="stat-icon">${trend}</div>
        <div class="stat-value">${thisWeek.total.toFixed(2)}€</div>
        <div class="stat-label">${I18n.t('stats.thisWeek', { diff })}</div>
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
      const monthNames = I18n.t('month.short');
      homeCharts.monthlyTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.monthlyTrends.map(d => {
            const [y, m] = d.month.split('-');
            return `${monthNames[parseInt(m)-1]} ${y}`;
          }),
          datasets: [{
            label: I18n.t('chart.income'),
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
            <div class="sale-meta">${s.items} ${I18n.t('sales.items')} · ${I18n.t('sales.percentOfTotal', { pct })}</div>
          </div>
          <div class="sale-price">${s.total.toFixed(2)}€</div>
        </div>
      `;
    });
    list.innerHTML = html;
  }
}

function renderHomeStats(overview, monthly) {
  // Build growth indicator HTML
  let growthHtml = '';
  const growth = monthly?.stats?.growth;
  const trend = monthly?.stats?.trend;

  if (growth === null || growth === undefined) {
    // NULL growth means new period or no previous data
    growthHtml = `<div class="stat-growth new">🆕 ${I18n.t('stats.newPeriod')}</div>`;
  } else if (growth > 0) {
    growthHtml = `<div class="stat-growth up">↑ ${growth}%</div>`;
  } else if (growth < 0) {
    growthHtml = `<div class="stat-growth down">↓ ${Math.abs(growth)}%</div>`;
  } else {
    // growth === 0 — no change
    growthHtml = `<div class="stat-growth neutral">→ 0%</div>`;
  }

  document.getElementById('home-stats').innerHTML = `
    <div class="stat-card primary">
      <div class="stat-icon">💰</div>
      <div class="stat-value">${overview.totalSales.toFixed(2)}€</div>
      <div class="stat-label">${I18n.t('stats.totalSales')}</div>
      ${growthHtml}
    </div>
    <div class="stat-card success">
      <div class="stat-icon">📦</div>
      <div class="stat-value">${overview.totalItems}</div>
      <div class="stat-label">${I18n.t('stats.totalItems')}</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon">📋</div>
      <div class="stat-value">${overview.totalSessions}</div>
      <div class="stat-label">${I18n.t('stats.sessions')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🏢</div>
      <div class="stat-value">${overview.companies}</div>
      <div class="stat-label">${I18n.t('stats.companies')}</div>
    </div>
  `;
}

function renderMonthlyChart(data) {
  const canvas = document.getElementById('chart-monthly');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (!data.dailySales || data.dailySales.length === 0) {
    canvas.parentElement.innerHTML = `<p style="text-align:center;padding:20px;color:var(--text-secondary)">${I18n.t('noData.month')}</p>`;
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
        label: I18n.t('chart.income') + ' (€)',
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
    canvas.parentElement.innerHTML = `<p style="text-align:center;padding:20px;color:var(--text-secondary)">${I18n.t('noData.products')}</p>`;
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
    canvas.parentElement.innerHTML = `<p style="text-align:center;padding:20px;color:var(--text-secondary)">${I18n.t('noData.sessions')}</p>`;
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
        label: I18n.t('chart.totalEuro'),
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
