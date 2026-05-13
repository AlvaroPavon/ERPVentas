const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders } = require('./helpers');

describe('🧪 Tests Básicos de la App', () => {
  beforeEach(() => resetDb());

  it('debería tener el servidor corriendo y respondiendo', async () => {
    const app = require('../server');
    const res = await request(app).get('/api/auth/me');
    // Sin auth devuelve 401, lo que confirma que el servidor responde
    expect(res.status).toBe(401);
  });

  it('debería servir la página SPA en la raíz', async () => {
    const app = require('../server');
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});