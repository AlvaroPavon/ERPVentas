async function renderJoinRequests(el) {
  App.updateTitle(I18n.t('title.joinRequests'));

  const [sent, received] = await Promise.all([
    API.getMyRequests().catch(() => []),
    API.getIncomingRequests().catch(() => [])
  ]);

  let html = '';

  // Sent requests
  html += '<div class="section-title">Solicitudes Enviadas</div>';
  if (sent.length === 0) {
    html += '<div class="list-empty"><div class="empty-icon">📨</div><p>No has enviado ninguna solicitud</p></div>';
  } else {
    sent.forEach(r => {
      const statusIcon = r.status === 'accepted' ? '✅' : r.status === 'rejected' ? '❌' : '⏳';
      const statusBadge = r.status === 'accepted' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning';
      const statusLabel = r.status === 'accepted' ? 'Aceptada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente';
      const date = new Date(r.created_at).toLocaleDateString('es');
      html += `
        <div class="list-item join-request-item" data-company-id="${r.company_id}" style="cursor:pointer;">
          <div class="item-icon">${statusIcon}</div>
          <div class="item-content">
            <div class="item-title">${r.company_name}</div>
            <div class="item-subtitle">${date} · <span class="badge ${statusBadge}">${statusLabel}</span></div>
          </div>
          <div class="item-right"><span style="font-size:18px;">›</span></div>
        </div>
      `;
    });
  }

  // Received requests (for companies where user is admin/owner)
  if (received.length > 0) {
    html += '<div class="section-title" style="margin-top:16px;">Solicitudes Recibidas</div>';
    received.forEach(r => {
      const date = new Date(r.created_at).toLocaleDateString('es');
      const statusLabel = r.status === 'accepted' ? 'Aceptada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente';
      const statusBadge = r.status === 'accepted' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning';
      const avatarHtml = r.user_avatar
        ? `<img src="${r.user_avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
        : '<div class="item-icon">👤</div>';
      html += `
        <div class="list-item" style="cursor:pointer;" data-company-id="${r.company_id}">
          <div class="join-user-avatar" data-user-id="${r.user_id}" style="flex-shrink:0;cursor:pointer;" title="Ver perfil">${avatarHtml}</div>
          <div class="item-content">
            <div class="item-title"><span class="join-user-name" data-user-id="${r.user_id}" style="cursor:pointer;color:var(--primary);">${r.user_name}</span> → ${r.company_name}</div>
            <div class="item-subtitle">${r.email} · ${date} · <span class="badge ${statusBadge}">${statusLabel}</span></div>
          </div>
          ${r.status === 'pending' ? `
            <div class="item-right" style="display:flex;gap:4px;">
              <button class="btn btn-sm btn-success accept-incoming" data-request-id="${r.id}" data-company-id="${r.company_id}">✔</button>
              <button class="btn btn-sm btn-danger reject-incoming" data-request-id="${r.id}" data-company-id="${r.company_id}">✕</button>
            </div>
          ` : ''}
        </div>
      `;
    });
  }

  el.innerHTML = html;

  // Navigate to company detail on item click (sent & received)
  el.querySelectorAll('.list-item[data-company-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.accept-incoming') || e.target.closest('.reject-incoming') || e.target.closest('.join-user-avatar') || e.target.closest('.join-user-name')) return;
      const cid = item.dataset.companyId;
      location.hash = `company/${cid}`;
      Router.go('company', { id: cid });
    });
  });

  // Show user profile on user click (received)
  const showUserProfile = async (userId) => {
    try {
      const user = await API.getPublicUser(userId);
      const avatarHtml = user.avatar
        ? `<img src="${user.avatar}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px;">`
        : '<div style="font-size:48px;text-align:center;margin-bottom:8px;">👤</div>';
      App.showModal(`
        <div class="modal-header">
          <h3>Perfil de Usuario</h3>
          <button class="modal-close" onclick="App.hideModal()">✕</button>
        </div>
        <div style="text-align:center;padding:16px;">
          ${avatarHtml}
          <div style="font-size:18px;font-weight:600;">${user.name}</div>
          <div style="color:var(--text-secondary);font-size:14px;">${user.email}</div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">
            Registrado el ${new Date(user.created_at).toLocaleDateString('es')}
          </div>
        </div>
      `);
    } catch (err) {
      App.showToast('Error al cargar perfil', 'error');
    }
  };

  el.querySelectorAll('.join-user-avatar, .join-user-name').forEach(el_ => {
    el_.addEventListener('click', (e) => {
      e.stopPropagation();
      showUserProfile(el_.dataset.userId);
    });
  });

  // Handle accept/reject for incoming requests
  el.querySelectorAll('.accept-incoming').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.acceptJoinRequest(btn.dataset.companyId, btn.dataset.requestId);
        App.showToast('Solicitud aceptada', 'success');
        renderJoinRequests(el);
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });
  });

  el.querySelectorAll('.reject-incoming').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.rejectJoinRequest(btn.dataset.companyId, btn.dataset.requestId);
        App.showToast('Solicitud rechazada', 'success');
        renderJoinRequests(el);
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });
  });
}
