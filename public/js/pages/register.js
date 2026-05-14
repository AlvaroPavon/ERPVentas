function renderRegister(el) {
  el.innerHTML = `
    <div class="auth-form">
      <div class="logo-area">
        <div class="logo-icon">💰</div>
        <h1>Crear Cuenta</h1>
        <p>Regístrate para empezar a vender</p>
      </div>
      <form id="register-form">
        <div class="input-group">
          <label>Nombre</label>
          <input type="text" id="reg-name" placeholder="Tu nombre" required>
        </div>
        <div class="input-group">
          <label>Email</label>
          <input type="email" id="reg-email" placeholder="tu@email.com" autocomplete="email" required>
        </div>
        <div class="input-group">
          <label>Contraseña</label>
          <input type="password" id="reg-password" placeholder="••••••••" autocomplete="new-password" required>
          <div class="input-hint">Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial</div>
        </div>
        <div class="input-group">
          <label>Confirmar Contraseña</label>
          <input type="password" id="reg-confirm" placeholder="••••••••" autocomplete="new-password" required>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block">Crear Cuenta</button>
      </form>
      <div class="form-footer">
        ¿Ya tienes cuenta? <a href="#" data-nav="login">Iniciar sesión</a>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
      App.showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-white"></span>';

    try {
      const data = await API.register(name, email, password);
      API.setToken(data.token);
      App.user = data.user;
      const lang = data.user.language || 'es';
      if (typeof I18n?.load !== 'function') {
        console.warn('I18n not loaded, creating inline fallback');
        window.I18n = { translations: {}, currentLang: 'es', fallbackLang: 'es', t: k => k, load: async () => {} };
      }
      await I18n.load(lang);
      App.showMainApp();
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-page="home"]').classList.add('active');
      location.hash = 'home';
      Router.go('home', {});
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear Cuenta';
    }
  });
}
