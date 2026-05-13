const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('🔐 Autenticación', () => {
  beforeEach(() => resetDb());

  describe('POST /api/auth/register', () => {
    it('debería registrar un usuario nuevo correctamente', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Juan Pérez',
          email: 'juan@test.com',
          password: 'Test1234!'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.name).toBe('Juan Pérez');
      expect(res.body.user.email).toBe('juan@test.com');
    });

    it('debería rechazar email ya registrado', async () => {
      const app = require('../server');
      await createTestUser({ email: 'existe@test.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Otro',
          email: 'existe@test.com',
          password: 'Test1234!'
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('debería rechazar email sin formato válido', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'no-es-email',
          password: 'Test1234!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Email');
    });

    it('debería rechazar contraseña débil (menos de 8 caracteres)', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test2@test.com',
          password: 'abc'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Mínimo');
    });

    it('debería rechazar contraseña sin mayúscula', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test3@test.com',
          password: 'abcdefgh1!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('mayúscula');
    });

    it('debería rechazar contraseña sin número', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test4@test.com',
          password: 'Abcdefgh!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('número');
    });

    it('debería rechazar contraseña sin carácter especial', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test5@test.com',
          password: 'Abcdefgh1'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('especial');
    });

    it('debería rechazar sin nombre', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'sinnombre@test.com',
          password: 'Test1234!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('nombre');
    });
  });

  describe('POST /api/auth/login', () => {
    it('debería iniciar sesión con credenciales correctas', async () => {
      const app = require('../server');
      await createTestUser({ email: 'login@test.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'Test1234!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('login@test.com');
    });

    it('debería rechazar contraseña incorrecta', async () => {
      const app = require('../server');
      await createTestUser({ email: 'wrong@test.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.com', password: 'ContraseñaIncorrecta!' });

      expect(res.status).toBe(401);
    });

    it('debería rechazar usuario inexistente', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noexiste@test.com', password: 'Test1234!' });

      expect(res.status).toBe(401);
    });

    it('debería rechazar sin email y contraseña', async () => {
      const app = require('../server');
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('debería devolver el perfil del usuario autenticado', async () => {
      const app = require('../server');
      const user = await createTestUser({ email: 'me@test.com' });
      const token = generateAuthToken(user);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@test.com');
    });

    it('debería rechazar sin token', async () => {
      const app = require('../server');
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('debería rechazar con token inválido', async () => {
      const app = require('../server');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token-invalido-basura');

      expect(res.status).toBe(401);
    });
  });
});