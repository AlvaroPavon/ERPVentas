async function renderProfile(el) {
  App.updateTitle('Perfil');

  const avatarSrc = App.user?.avatar || '';
  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar" id="profile-avatar-container">
        ${avatarSrc ? `<img src="${avatarSrc}" alt="Avatar">` : '👤'}
        <div class="profile-avatar-edit" id="btn-change-avatar">📷 Cambiar</div>
      </div>
      <input type="file" id="avatar-input" class="file-input-hidden" accept="image/*">
      <div class="profile-name" id="profile-name-display">${App.user?.name || ''}</div>
      <div class="profile-email" id="profile-email-display">${App.user?.email || ''}</div>
    </div>

    <div class="section-title">Información Personal</div>
    <form id="form-update-profile">
      <div class="input-group">
        <label>Nombre</label>
        <input type="text" id="prof-name" value="${App.user?.name || ''}" required>
      </div>
      <div class="input-group">
        <label>Email</label>
        <input type="email" id="prof-email" value="${App.user?.email || ''}" required>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Guardar Cambios</button>
    </form>

    <div class="section-title" style="margin-top:20px;">Cambiar Contraseña</div>
    <form id="form-change-password">
      <div class="input-group">
        <label>Contraseña Actual</label>
        <input type="password" id="pw-current" placeholder="••••••••" required>
      </div>
      <div class="input-group">
        <label>Nueva Contraseña</label>
        <input type="password" id="pw-new" placeholder="••••••••" required>
        <div class="input-hint">Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial</div>
      </div>
      <button type="submit" class="btn btn-outline btn-block">Cambiar Contraseña</button>
    </form>

    <div class="section-title" style="margin-top:20px;">Apariencia</div>
    <div class="list-item" id="btn-toggle-auto-dark" style="cursor:pointer;">
      <div class="item-icon">🌓</div>
      <div class="item-content">
        <div class="item-title">Modo oscuro automático</div>
        <div class="item-subtitle" id="auto-dark-status">De 20:00 a 07:00</div>
      </div>
      <div class="item-right"><span id="auto-dark-icon" style="font-size:18px;">${App.autoDarkMode ? '✅' : '☐'}</span></div>
    </div>

    <div class="section-title" style="margin-top:20px;">Notificaciones</div>
    <div class="list-item" id="btn-toggle-push" style="cursor:pointer;">
      <div class="item-icon">🔔</div>
      <div class="item-content">
        <div class="item-title">Recordatorios</div>
        <div class="item-subtitle" id="push-status-text">Verificando...</div>
      </div>
      <div class="item-right"><span id="push-toggle-icon" style="font-size:18px;">⋯</span></div>
    </div>

    <div class="section-title" style="margin-top:20px;">Historial</div>
    <div class="list-item" id="btn-view-activity" style="cursor:pointer;">
      <div class="item-icon">📄</div>
      <div class="item-content">
        <div class="item-title">Registro de Actividad</div>
        <div class="item-subtitle">Ver todas las acciones registradas</div>
      </div>
      <div class="item-right"><span style="font-size:18px;">›</span></div>
    </div>

    <div class="section-title" style="margin-top:20px;">Datos</div>
    <div class="list-item" id="btn-download-backup" style="cursor:pointer;">
      <div class="item-icon">💾</div>
      <div class="item-content">
        <div class="item-title">Descargar Backup</div>
        <div class="item-subtitle">Copia de seguridad completa de la base de datos</div>
      </div>
      <div class="item-right"><span style="font-size:18px;">›</span></div>
    </div>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
      <button class="btn btn-danger btn-block" id="btn-logout">🚪 Cerrar Sesión</button>
    </div>
  `;

  document.getElementById('form-update-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof-name').value;
    const email = document.getElementById('prof-email').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-white"></span>';
    try {
      const user = await API.updateProfile(name, email);
      App.user = user;
      document.getElementById('profile-name-display').textContent = user.name;
      document.getElementById('profile-email-display').textContent = user.email;
      document.getElementById('header-user').textContent = user.name;
      App.showToast('Perfil actualizado', 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Cambios';
    }
  });

  document.getElementById('form-change-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('pw-current').value;
    const newPassword = document.getElementById('pw-new').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-white"></span>';
    try {
      await API.changePassword(currentPassword, newPassword);
      App.showToast('Contraseña cambiada correctamente', 'success');
      document.getElementById('pw-current').value = '';
      document.getElementById('pw-new').value = '';
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Cambiar Contraseña';
    }
  });

  // Push notifications
  let pushSubscribed = false;
  let pushEndpoint = null;

  async function checkPushStatus() {
    const statusText = document.getElementById('push-status-text');
    const toggleIcon = document.getElementById('push-toggle-icon');
    try {
      const status = await API.pushStatus();
      pushSubscribed = status.subscribed;
      statusText.textContent = pushSubscribed ? 'Notificaciones activadas' : 'Activar recordatorios diarios';
      toggleIcon.textContent = pushSubscribed ? '🔕' : '🔔';
    } catch {
      statusText.textContent = 'No disponible';
      toggleIcon.textContent = '❌';
    }
  }
  checkPushStatus();

  document.getElementById('btn-toggle-push')?.addEventListener('click', async () => {
    if (pushSubscribed) {
      // Unsubscribe
      if (pushEndpoint) {
        try {
          await API.pushUnsubscribe(pushEndpoint);
          const registration = await navigator.serviceWorker.ready;
          const subs = await registration.pushManager.getSubscription();
          if (subs) await subs.unsubscribe();
        } catch (e) {}
      }
      pushSubscribed = false;
      pushEndpoint = null;
      document.getElementById('push-status-text').textContent = 'Activar recordatorios diarios';
      document.getElementById('push-toggle-icon').textContent = '🔔';
      App.showToast('Notificaciones desactivadas', 'success');
    } else {
      // Subscribe
      try {
        if (!('Notification' in window)) {
          App.showToast('Notificaciones no soportadas en este navegador', 'warning');
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          App.showToast('Permiso denegado', 'warning');
          return;
        }

        const keyData = await API.getVapidKey();
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyData.publicKey,
        });
        const subJson = subscription.toJSON();
        await API.pushSubscribe(subJson.endpoint, { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth });
        pushSubscribed = true;
        pushEndpoint = subJson.endpoint;
        document.getElementById('push-status-text').textContent = 'Notificaciones activadas';
        document.getElementById('push-toggle-icon').textContent = '🔕';
        App.showToast('Recordatorios activados', 'success');

        // Send test notification
        API.pushTest().catch(() => {});
      } catch (err) {
        App.showToast('Error: ' + err.message, 'error');
      }
    }
  });

  document.getElementById('btn-toggle-auto-dark')?.addEventListener('click', () => {
    App.autoDarkMode = !App.autoDarkMode;
    localStorage.setItem('autoDarkMode', App.autoDarkMode);
    if (App.autoDarkMode) {
      App.darkMode = App.isDarkTime();
      localStorage.removeItem('darkMode');
    }
    App.applyDarkMode();
    App.startAutoDarkCheck();
    document.getElementById('auto-dark-icon').textContent = App.autoDarkMode ? '✅' : '☐';
    App.showToast(App.autoDarkMode ? 'Auto programado' : 'Manual', 'success');
  });

  document.getElementById('btn-view-activity')?.addEventListener('click', () => {
    location.hash = 'activity';
    Router.go('activity', {});
  });

  document.getElementById('btn-download-backup')?.addEventListener('click', () => {
    API.downloadBackup().catch(err => App.showToast(err.message, 'error'));
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) {
      App.logout();
    }
  });

  // Avatar upload
  document.getElementById('btn-change-avatar')?.addEventListener('click', () => {
    document.getElementById('avatar-input').click();
  });

  document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        await API.updateAvatar(dataUrl);
        App.user.avatar = dataUrl;
        document.getElementById('profile-avatar-container').innerHTML =
          `<img src="${dataUrl}" alt="Avatar"><div class="profile-avatar-edit" id="btn-change-avatar">📷 Cambiar</div>`;
        App.updateHeader();
        App.showToast('Foto actualizada', 'success');
        document.getElementById('btn-change-avatar').addEventListener('click', () => {
          document.getElementById('avatar-input').click();
        });
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  });
}
