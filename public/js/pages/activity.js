const activityIcons = {
  create_session: '📋',
  add_sale: '💰',
  close_session: '🔒',
  create_company: '🏢',
};

async function renderActivity(el) {
  App.updateTitle(I18n.t('title.activity'));

  el.innerHTML = `
    <div class="section-title">Registro de Actividad</div>
    <div id="activity-list"><div style="text-align:center;padding:40px;"><div class="spinner"></div></div></div>
    <div id="activity-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:12px;"></div>
  `;

  loadActivityPage(1);
}

async function loadActivityPage(page) {
  const list = document.getElementById('activity-list');
  const pagination = document.getElementById('activity-pagination');
  if (!list) return;

  try {
    const data = await API.getActivity(page);

    if (data.logs.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">📄</div><p>I18n.t('page.activity.noActivity') aún</p></div>';
      pagination.innerHTML = '';
      return;
    }

    let html = '';
    data.logs.forEach(log => {
      const icon = activityIcons[log.action] || '📄';
      const time = new Date(log.created_at).toLocaleString('es', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      html += `
        <div class="list-item" style="cursor:default;">
          <div class="item-icon">${icon}</div>
          <div class="item-content">
            <div class="item-title">${log.description}</div>
            <div class="item-subtitle">${log.user_name} · ${time}</div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;

    const totalPages = Math.ceil(data.total / data.limit);
    if (totalPages > 1) {
      let pagesHtml = '';
      for (let i = 1; i <= totalPages; i++) {
        pagesHtml += `<button class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-outline'}" data-activity-page="${i}">${i}</button>`;
      }
      pagination.innerHTML = pagesHtml;
      pagination.querySelectorAll('[data-activity-page]').forEach(btn => {
        btn.addEventListener('click', () => loadActivityPage(parseInt(btn.dataset.activityPage)));
      });
    } else {
      pagination.innerHTML = '';
    }
  } catch (err) {
    list.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}
