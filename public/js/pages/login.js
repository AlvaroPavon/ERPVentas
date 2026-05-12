function renderLogin(el) {
  el.innerHTML = `
    <div class="auth-form">
      <div class="logo-area">
        <div class="logo-icon">💰</div>
        <h1>Notas de Venta</h1>
        <p>Tu gestor de ventas para mercadillos</p>
      </div>
      <form id="login-form">
        <div class="input-group">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="tu@email.com" autocomplete="email" required>
        </div>
        <div class="input-group">
          <label>Contraseña</label>
          <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block">Iniciar Sesión</button>
      </form>
      <div class="form-footer">
        ¿No tienes cuenta? <a href="#" data-nav="register">Crear cuenta</a>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-white"></span>';

    try {
      const data = await API.login(email, password);
      API.setToken(data.token);
      App.user = data.user;
      App.showMainApp();
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-page="home"]').classList.add('active');
      location.hash = 'home';
      Router.go('home', {});
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  });
}
