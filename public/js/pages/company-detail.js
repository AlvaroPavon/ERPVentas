async function renderCompanyDetail(el, params) {
  const companyId = params.id;
  App.updateTitle('Empresa');

  el.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

  try {
    const company = await API.getCompany(companyId);

    const isMember = company.users.some(u => u.id === App.user.id);
    const isAdmin = company.users.some(u => u.id === App.user.id && (u.role === 'admin' || u.role === 'owner'));

    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <button class="btn btn-ghost btn-sm" id="btn-back-companies">← Empresas</button>
      </div>

      <div class="card" style="text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">🏢</div>
        <h2 style="font-size:20px;font-weight:700;">${company.name}</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${company.description || 'Sin descripción'}</p>
        <div style="margin-top:8px;">
          <span class="badge badge-primary">${company.user_count} miembros</span>
          ${company.users.find(u => u.id === company.created_by) ? '<span class="badge badge-warning">Creador</span>' : ''}
        </div>
      </div>
    `;

    // Users section
    html += '<div class="section-title">Miembros</div>';
    company.users.forEach(u => {
      let roleBadge;
      if (u.role === 'owner') roleBadge = '<span class="badge badge-warning">Propietario</span>';
      else if (u.role === 'admin') roleBadge = '<span class="badge badge-primary">Admin</span>';
      else roleBadge = '<span class="badge badge-success">Miembro</span>';
      const isMe = u.id === App.user.id ? ' (Tú)' : '';
      const avatarHtml = u.avatar ? `<img src="${u.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : '<div class="item-icon">👤</div>';
      html += `
        <div class="list-item" data-user-id="${u.id}" style="cursor:pointer;">
          ${avatarHtml}
          <div class="item-content">
            <div class="item-title">${u.name}${isMe} ${roleBadge}</div>
            <div class="item-subtitle">${u.email}</div>
          </div>
          <div class="item-right"><span style="font-size:18px;">›</span></div>
        </div>
      `;
    });

    // Add user (admin only)
    if (isAdmin) {
      html += `
        <button class="btn btn-primary" id="btn-add-user" style="margin-bottom:12px;">+ Añadir Usuario</button>
      `;
    }

    // Role management (owner only)
    const myMembership = company.users.find(u => u.id === App.user.id);
    if (myMembership && myMembership.role === 'owner') {
      html += `
        <div class="section-title">Roles y Permisos</div>
        <div id="role-management">
          <div style="text-align:center;padding:8px;"><div class="spinner"></div></div>
        </div>
      `;
    }

    // Sessions
    html += '<div class="section-title">Sesiones de Venta</div>';
    if (company.sessions.length === 0) {
      html += '<div class="list-empty"><div class="empty-icon">📋</div><p>No hay sesiones registradas</p></div>';
    } else {
      company.sessions.forEach(s => {
        const date = new Date(s.session_date).toLocaleDateString('es');
        const status = s.is_closed ? '<span class="badge badge-success">Cerrada</span>' : '<span class="badge badge-warning">Activa</span>';
        html += `
          <div class="list-item" data-session-id="${s.id}">
            <div class="item-icon">📋</div>
            <div class="item-content">
              <div class="item-title">${s.name} ${status}</div>
              <div class="item-subtitle">${date} · ${s.created_by_name} · ${s.item_count} productos</div>
            </div>
            <div class="item-right">
              <div class="item-amount">${s.total_amount.toFixed(2)}€</div>
            </div>
          </div>
        `;
      });
    }

    if (!isMember) {
      const reqStatus = company.joinRequest?.status;
      if (reqStatus === 'pending') {
        html += `
          <div class="card" style="margin-top:12px;text-align:center;background:var(--warning-bg);">
            <p style="font-size:13px;color:var(--warning);">⏳ Solicitud de unión pendiente. Espera a que el administrador la acepte.</p>
          </div>
        `;
      } else if (reqStatus === 'rejected') {
        html += `
          <div class="card" style="margin-top:12px;text-align:center;background:var(--danger-bg);">
            <p style="font-size:13px;color:var(--danger);">❌ Tu solicitud de unión fue rechazada.</p>
          </div>
        `;
      } else {
        html += `
          <div class="card" style="margin-top:12px;text-align:center;background:var(--primary-bg);">
            <p style="font-size:13px;">No eres miembro de esta empresa.</p>
            <button class="btn btn-primary" id="btn-request-join" style="margin-top:8px;">Solicitar Unirse</button>
          </div>
        `;
      }
    }

    // Products section
    html += '<div class="section-title">Catálogo de Productos</div>';
    html += `<div id="products-section">
      <div style="text-align:center;padding:12px;"><div class="spinner"></div></div>
    </div>`;

    // Pending requests section (owner/admin only)
    if (isAdmin && company.joinRequest !== undefined) {
      html += `<div id="pending-requests-section" style="display:none;">
        <div class="section-title">Solicitudes Pendientes</div>
        <div id="pending-requests-list"><div class="spinner"></div></div>
      </div>`;
    }

    el.innerHTML = html;

    // Back button
    document.getElementById('btn-back-companies')?.addEventListener('click', () => {
      location.hash = 'companies';
      Router.go('companies', {});
    });

    // Request join
    document.getElementById('btn-request-join')?.addEventListener('click', async () => {
      try {
        await API.requestJoinCompany(companyId);
        App.showToast('Solicitud enviada al administrador', 'success');
        renderCompanyDetail(el, params);
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });

    // Load pending requests if admin
    if (isAdmin) {
      loadPendingRequests(companyId, el, params);
    }

    // Load products
    loadProducts(companyId, isAdmin);

    // Load role management (owner only)
    if (myMembership && myMembership.role === 'owner') {
      loadRoleManagement(companyId);
    }

    // Add product (admin only)
    if (isAdmin) {
      document.getElementById('btn-add-product')?.addEventListener('click', () => {
        App.showModal(`
          <div class="modal-header">
            <h3>Añadir Producto al Catálogo</h3>
            <button class="modal-close" onclick="App.hideModal()">✕</button>
          </div>
          <form id="form-add-product">
            <div class="input-group">
              <label>Nombre del producto</label>
              <input type="text" id="prod-name" placeholder="Ej: Cartera" required>
            </div>
            <div class="input-group">
              <label>Precio base (€)</label>
              <input type="number" id="prod-price" step="0.01" min="0" placeholder="0.00" required>
            </div>
            <div class="input-group">
              <label>Categoría (opcional)</label>
              <input type="text" id="prod-category" placeholder="Ej: Accesorios">
            </div>
            <div style="margin-top:12px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;cursor:pointer;">
                <input type="checkbox" id="toggle-multi-prices"> Precios múltiples (ej: unidad, pack, mayor)
              </label>
            </div>
            <div id="multi-price-section" style="display:none;margin-top:8px;">
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Añade variantes de precio:</div>
              <div id="price-tiers-list">
                <div class="price-tier-row" style="display:flex;gap:4px;margin-bottom:4px;">
                  <input type="text" class="tier-name" placeholder="Ej: Unidad" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--text);">
                  <input type="number" class="tier-price" placeholder="Precio" step="0.01" min="0" style="width:90px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--text);">
                  <input type="number" class="tier-qty" placeholder="Cant" value="1" min="1" style="width:65px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--text);">
                </div>
              </div>
              <button type="button" id="btn-add-tier" class="btn btn-sm btn-ghost" style="font-size:12px;padding:4px 8px;">+ Añadir variante</button>
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px;">Añadir Producto</button>
          </form>
        `);

        document.getElementById('toggle-multi-prices')?.addEventListener('change', function() {
          document.getElementById('multi-price-section').style.display = this.checked ? 'block' : 'none';
        });

        document.getElementById('btn-add-tier')?.addEventListener('click', () => {
          const list = document.getElementById('price-tiers-list');
          const row = document.createElement('div');
          row.className = 'price-tier-row';
          row.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';
          row.innerHTML = `
            <input type="text" class="tier-name" placeholder="Ej: Pack 6" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--text);">
            <input type="number" class="tier-price" placeholder="Precio" step="0.01" min="0" style="width:90px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--text);">
            <input type="number" class="tier-qty" placeholder="Cant" value="1" min="1" style="width:65px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--text);">
            <button type="button" class="btn-remove-tier" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;font-size:16px;">✕</button>
          `;
          row.querySelector('.btn-remove-tier').addEventListener('click', () => row.remove());
          list.appendChild(row);
        });

        document.getElementById('form-add-product').addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = document.getElementById('prod-name').value;
          const price = document.getElementById('prod-price').value;
          const category = document.getElementById('prod-category').value;
          const multiPrices = document.getElementById('toggle-multi-prices').checked;
          let prices = null;
          if (multiPrices) {
            prices = [];
            document.querySelectorAll('.price-tier-row').forEach(row => {
              const tName = row.querySelector('.tier-name')?.value?.trim();
              const tPrice = parseFloat(row.querySelector('.tier-price')?.value);
              const tQty = parseInt(row.querySelector('.tier-qty')?.value) || 1;
              if (tName && !isNaN(tPrice) && tPrice >= 0) {
                prices.push({ name: tName, price: tPrice, quantity: tQty });
              }
            });
            if (prices.length === 0) prices = null;
          }
          try {
            await API.createProduct(companyId, name, parseFloat(price), category, null, prices);
            App.hideModal();
            App.showToast('Producto añadido al catálogo', 'success');
            loadProducts(companyId, isAdmin);
          } catch (err) {
            App.showToast(err.message, 'error');
          }
        });
      });
    }

    // Add user
    document.getElementById('btn-add-user')?.addEventListener('click', () => {
      App.showModal(`
        <div class="modal-header">
          <h3>Añadir Usuario</h3>
          <button class="modal-close" onclick="App.hideModal()">✕</button>
        </div>
        <form id="form-add-user">
          <div class="input-group">
            <label>Email del usuario</label>
            <input type="email" id="add-user-email" placeholder="usuario@email.com" required>
          </div>
          <div class="input-group">
            <label>Rol</label>
            <select id="add-user-role">
              <option value="member">Miembro</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Añadir</button>
        </form>
      `);

      document.getElementById('form-add-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('add-user-email').value;
        const role = document.getElementById('add-user-role').value;
        try {
          await API.addUserToCompany(companyId, email, role);
          App.hideModal();
          App.showToast('Usuario añadido', 'success');
          renderCompanyDetail(el, params);
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });

    // Session clicks
    el.querySelectorAll('[data-session-id]').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.sessionId;
        showSessionDetail(id);
      });
    });

    // User profile clicks
    el.querySelectorAll('[data-user-id]').forEach(item => {
      item.addEventListener('click', async () => {
        const userId = item.dataset.userId;
        try {
          const user = await API.getPublicUser(userId);
          const avatarHtml = user.avatar
            ? `<img src="${user.avatar}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--primary);">`
            : `<div style="width:64px;height:64px;border-radius:50%;background:var(--primary-gradient);color:white;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto;">👤</div>`;
          const joined = company.users.find(u => u.id === user.id)?.joined_at || '';
          const joinedDate = joined ? new Date(joined).toLocaleDateString('es') : '';
          App.showModal(`
            <div class="modal-header">
              <h3>Perfil de Usuario</h3>
              <button class="modal-close" onclick="App.hideModal()">✕</button>
            </div>
            <div style="text-align:center;padding:16px 0;">
              ${avatarHtml}
              <h3 style="margin-top:12px;font-size:18px;">${user.name}</h3>
              <p style="color:var(--text-secondary);font-size:13px;">${user.email}</p>
              ${joinedDate ? `<p style="color:var(--text-tertiary);font-size:12px;margin-top:4px;">Miembro desde ${joinedDate}</p>` : ''}
              <p style="color:var(--text-tertiary);font-size:11px;margin-top:8px;">Usuario desde ${new Date(user.created_at).toLocaleDateString('es')}</p>
            </div>
          `);
        } catch (err) {
          App.showToast('Error al cargar perfil', 'error');
        }
      });
    });

  } catch (err) {
    el.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}

async function loadPendingRequests(companyId, el, params) {
  try {
    const requests = await API.getJoinRequests(companyId);
    const section = document.getElementById('pending-requests-section');
    const list = document.getElementById('pending-requests-list');
    if (!section || !list) return;

    if (requests.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    let html = '';
    requests.forEach(r => {
      html += `
        <div class="list-item" style="cursor:default;">
          <div class="item-icon">👤</div>
          <div class="item-content">
            <div class="item-title">${r.name}</div>
            <div class="item-subtitle">${r.email}</div>
          </div>
          <div class="item-right" style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-success accept-request" data-request-id="${r.id}">✔</button>
            <button class="btn btn-sm btn-danger reject-request" data-request-id="${r.id}">✕</button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;

    list.querySelectorAll('.accept-request').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.acceptJoinRequest(companyId, btn.dataset.requestId);
          App.showToast('Solicitud aceptada', 'success');
          loadPendingRequests(companyId, el, params);
          renderCompanyDetail(el, params);
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });

    list.querySelectorAll('.reject-request').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.rejectJoinRequest(companyId, btn.dataset.requestId);
          App.showToast('Solicitud rechazada', 'success');
          loadPendingRequests(companyId, el, params);
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    console.error('Error loading pending requests:', err);
  }
}

async function loadProducts(companyId, isAdmin) {
  const section = document.getElementById('products-section');
  if (!section) return;
  try {
    const products = await API.getCompanyProducts(companyId);
    if (products.length === 0) {
      section.innerHTML = `
        <div class="list-empty" style="padding:16px;">
          <p style="font-size:13px;">No hay productos en el catálogo</p>
          ${isAdmin ? '<button class="btn btn-sm btn-primary" id="btn-add-product" style="margin-top:8px;">+ Añadir Producto</button>' : ''}
        </div>
      `;
      return;
    }
    let html = '';
    products.forEach(p => {
      let subtitle = `${p.price.toFixed(2)}€${p.category ? ' · ' + p.category : ''}`;
      let tiersHtml = '';
      if (p.prices && p.prices.length > 0) {
        subtitle = `${p.price.toFixed(2)}€ (base)${p.category ? ' · ' + p.category : ''}`;
        tiersHtml = `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">`;
        p.prices.forEach(t => {
          tiersHtml += `<span style="font-size:10px;background:var(--surface-2);padding:2px 6px;border-radius:8px;color:var(--text-secondary);">${t.name}: ${t.price.toFixed(2)}€ (×${t.quantity})</span>`;
        });
        tiersHtml += `</div>`;
      }
      html += `
        <div class="list-item" style="cursor:default;flex-wrap:wrap;">
          <div class="item-icon">🏷️</div>
          <div class="item-content" style="flex:1;min-width:0;">
            <div class="item-title">${p.name}</div>
            <div class="item-subtitle">${subtitle}</div>
            ${tiersHtml}
          </div>
          ${isAdmin ? `<div class="item-right"><button class="btn btn-sm btn-danger" data-product-id="${p.id}" style="padding:4px 8px;font-size:11px;" onclick="if(confirm('¿Eliminar producto?')){API.deleteProduct(${p.id}).then(()=>loadProducts(${companyId},${isAdmin})).catch(e=>App.showToast(e.message,'error'));}">✕</button></div>` : ''}
        </div>
      `;
    });
    if (isAdmin) {
      html += `<button class="btn btn-sm btn-primary" id="btn-add-product" style="margin-top:4px;">+ Añadir Producto</button>`;
    }
    section.innerHTML = html;
  } catch (err) {
    section.innerHTML = `<div class="list-empty"><p>Error: ${err.message}</p></div>`;
  }
}

async function loadRoleManagement(companyId) {
  const container = document.getElementById('role-management');
  if (!container) return;

  try {
    const data = await API.getCompanyPermissions(companyId);
    const availablePerms = ['manage_members','manage_products','manage_sessions','add_sales','delete_sales','view_reports'];
    const permLabels = {
      manage_members: 'Gestionar miembros',
      manage_products: 'Gestionar productos',
      manage_sessions: 'Gestionar sesiones',
      add_sales: 'Añadir ventas',
      delete_sales: 'Eliminar ventas',
      view_reports: 'Ver informes',
    };

    let html = '';
    data.allRoles.filter(r => r !== 'owner').forEach(role => {
      const perms = data.roles[role] || [];
      const roleLabel = { admin: 'Admin', member: 'Miembro', cashier: 'Cajero' }[role] || role;
      html += `
        <div style="margin-bottom:12px;padding:12px;background:var(--surface);border-radius:var(--radius-md);">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px;">${roleLabel}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;" data-role="${role}">
            ${availablePerms.map(p => `
              <span class="chip ${perms.includes(p) ? 'active' : ''}" data-perm="${p}" style="font-size:11px;padding:4px 10px;">${permLabels[p] || p}</span>
            `).join('')}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // Handle chip clicks
    container.querySelectorAll('[data-role]').forEach(group => {
      const role = group.dataset.role;
      group.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', async () => {
          chip.classList.toggle('active');
          const perms = [...group.querySelectorAll('.chip.active')].map(c => c.dataset.perm);
          try {
            await API.updateRolePermissions(companyId, role, perms);
            App.showToast(`Permisos de "${role}" actualizados`, 'success');
          } catch (err) {
            chip.classList.toggle('active'); // revert
            App.showToast(err.message, 'error');
          }
        });
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="list-empty"><p>Error: ${err.message}</p></div>`;
  }
}
