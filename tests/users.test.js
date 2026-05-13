const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders } = require('./helpers');

describe('👤 Usuarios', () => {
  beforeEach(() => resetDb());

  let authUser;

  beforeEach(() => {
    authUser = createTestUser({ email: 'perfil@test.com' });
  });

  describe('GET /api/users/profile', () => {
    it('debería devolver el perfil del usuario autenticado', async () => {
      const app = require('../server');

      const res = await request(app)
        .get('/api/users/profile')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(authUser.id);
      expect(res.body.name).toBe(authUser.name);
      expect(res.body.email).toBe('perfil@test.com');
    });

    it('debería rechazar sin autenticación', async () => {
      const app = require('../server');
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('debería actualizar el nombre', async () => {
      const app = require('../server');

      const res = await request(app)
        .put('/api/users/profile')
        .set(authHeaders(authUser))
        .send({ name: 'Nuevo Nombre' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nuevo Nombre');
    });

    it('debería actualizar el email', async () => {
      const app = require('../server');

      const res = await request(app)
        .put('/api/users/profile')
        .set(authHeaders(authUser))
        .send({ email: 'nuevo@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('nuevo@test.com');
    });

    it('debería rechazar email duplicado', async () => {
      const app = require('../server');
      createTestUser({ email: 'otro@test.com' });

      const res = await request(app)
        .put('/api/users/profile')
        .set(authHeaders(authUser))
        .send({ email: 'otro@test.com' });

      expect(res.status).toBe(409);
    });
  });

  describe('PUT /api/users/password', () => {
    it('debería cambiar la contraseña', async () => {
      const app = require('../server');

      const res = await request(app)
        .put('/api/users/password')
        .set(authHeaders(authUser))
        .send({ currentPassword: 'Test1234!', newPassword: 'NuevaPass1!' });

      expect(res.status).toBe(200);
    });

    it('debería rechazar contraseña actual incorrecta', async () => {
      const app = require('../server');

      const res = await request(app)
        .put('/api/users/password')
        .set(authHeaders(authUser))
        .send({ currentPassword: 'Incorrecta!!!', newPassword: 'NuevaPass1!' });

      expect(res.status).toBe(401);
    });

    it('debería rechazar nueva contraseña débil', async () => {
      const app = require('../server');

      const res = await request(app)
        .put('/api/users/password')
        .set(authHeaders(authUser))
        .send({ currentPassword: 'Test1234!', newPassword: 'debil' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/avatar', () => {
    it('debería actualizar el avatar', async () => {
      const app = require('../server');
      const fakeBase64 = 'data:image/png;base64,iVBORw0KGgo=';

      const res = await request(app)
        .put('/api/users/avatar')
        .set(authHeaders(authUser))
        .send({ avatar: fakeBase64 });

      expect(res.status).toBe(200);
      expect(res.body.avatar).toBe(fakeBase64);
    });
  });

  describe('GET /api/users/:id/public', () => {
    // NOTA: En tu código, GET /api/users/:id/public NO tiene authMiddleware.
    // Pero server.js carga users.js con authMiddleware global.
    // Verificamos el comportamiento real: requiere auth.
    it('debería devolver perfil público (requiere auth como está montado)', async () => {
      const app = require('../server');
      const user = createTestUser({ email: 'publico@test.com', name: 'Usuario Público' });

      const res = await request(app)
        .get(`/api/users/${user.id}/public`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.id);
    });

    it('debería devolver 404 para usuario inexistente', async () => {
      const app = require('../server');
      const res = await request(app)
        .get('/api/users/99999/public')
        .set(authHeaders(authUser));

      expect(res.status).toBe(404);
    });
  });
});